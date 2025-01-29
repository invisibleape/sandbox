import SignClient from '@walletconnect/sign-client';
import { SessionTypes } from '@walletconnect/types';
import { getSdkError } from '@walletconnect/utils';
import { ethers } from 'ethers';
import { createProvider } from './providers';
import { Network } from '../types';
import { supabase } from './supabase';
import { signWithBackend } from './signing';

interface WalletConnectSession {
  uri: string;
  walletId: string;
  network: Network;
  privateKey: string;
  autoSign?: boolean;
}

let signClient: SignClient | null = null;
let initializationPromise: Promise<SignClient> | null = null;
let initializationAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

function emitLog(log: { type: 'info' | 'success' | 'error' | 'pending'; message: string }) {
  window.dispatchEvent(
    new CustomEvent('walletconnect:log', {
      detail: {
        ...log,
        id: crypto.randomUUID(),
        timestamp: Date.now()
      }
    })
  );
}

async function getSignClient(): Promise<SignClient> {
  if (signClient) return signClient;
  
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    while (initializationAttempts < MAX_RETRY_ATTEMPTS) {
      try {
        emitLog({
          type: 'info',
          message: `Initializing WalletConnect client (attempt ${initializationAttempts + 1}/${MAX_RETRY_ATTEMPTS})...`
        });

        const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
        if (!projectId) {
          throw new Error('WalletConnect Project ID not configured');
        }

        // Add retry delay after first attempt
        if (initializationAttempts > 0) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, initializationAttempts)));
        }

        const client = await SignClient.init({
          projectId,
          relayUrl: 'wss://relay.walletconnect.com',
          metadata: {
            name: 'Token Gating Test Dashboard',
            description: 'Admin dashboard for wallet management',
            url: window.location.origin,
            icons: ['https://avatars.githubusercontent.com/u/37784886']
          }
        });

        if (!client.core?.crypto) {
          throw new Error('WalletConnect core not properly initialized');
        }

        emitLog({
          type: 'success',
          message: 'WalletConnect client initialized successfully'
        });

        signClient = client;
        return client;
      } catch (error) {
        initializationAttempts++;
        
        console.error('Failed to initialize WalletConnect SignClient:', {
          error,
          attempt: initializationAttempts,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        
        emitLog({
          type: 'error',
          message: `Client initialization attempt ${initializationAttempts} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });

        if (initializationAttempts >= MAX_RETRY_ATTEMPTS) {
          initializationPromise = null;
          initializationAttempts = 0;
          throw error;
        }

        emitLog({
          type: 'info',
          message: `Retrying initialization in ${RETRY_DELAY * Math.pow(2, initializationAttempts)}ms...`
        });
      }
    }

    initializationAttempts = 0;
    throw new Error('Failed to initialize WalletConnect client after maximum retries');
  })();

  return initializationPromise;
}

function formatChainId(chainId: number): string {
  return `eip155:${chainId}`;
}

async function sendResponse(
  client: SignClient,
  topic: string,
  id: number,
  result?: any,
  error?: { code: number; message: string }
): Promise<void> {
  try {
    const response = {
      topic,
      response: {
        id,
        jsonrpc: '2.0',
        ...(error ? { error } : { result })
      }
    };

    await client.respond(response);
  } catch (err) {
    console.error('Failed to send response:', err);
    throw err;
  }
}

export async function connectWalletConnect(session: WalletConnectSession): Promise<void> {
  try {
    emitLog({
      type: 'info',
      message: `Connecting wallet to ${session.network.name}...`
    });
    
    const provider = await createProvider(session.network);
    const wallet = new ethers.Wallet(session.privateKey, provider);
    const chainId = await wallet.provider.getNetwork().then(n => Number(n.chainId));
    
    emitLog({
      type: 'info',
      message: `Connected to chain ID: ${chainId}`
    });

    const client = await getSignClient();

    emitLog({
      type: 'info',
      message: 'Pairing with WalletConnect...'
    });

    const { topic } = await client.pair({ uri: session.uri });

    client.on('session_request', async (event) => {
      try {
        // Validate event structure
        if (!event?.params?.request || !event.topic || typeof event.params.id === 'undefined') {
          throw new Error('Invalid session request format');
        }

        const { topic, params } = event;
        const { id, request } = params;

        // Ensure id is converted to string safely
        const requestId = id.toString();

        window.dispatchEvent(
          new CustomEvent('walletconnect:request', {
            detail: {
              id: requestId,
              method: request.method,
              params: request.params || [],
              timestamp: Date.now(),
              pending: true
            }
          })
        );

        emitLog({
          type: 'info',
          message: `Processing request: ${request.method}`
        });

        let result;

        if (session.autoSign) {
          try {
            result = await processRequest(request, wallet, provider, session.walletId);
            
            // Format result as hex string if it's a Buffer or Uint8Array
            if (result instanceof Uint8Array || Buffer.isBuffer(result)) {
              result = '0x' + Buffer.from(result).toString('hex');
            }

            await sendResponse(client, topic, id, result);

            window.dispatchEvent(
              new CustomEvent('walletconnect:response', {
                detail: {
                  id: requestId,
                  success: true
                }
              })
            );

            emitLog({
              type: 'success',
              message: `Auto-signed request: ${request.method}`
            });
          } catch (error) {
            console.error('Auto-sign request failed:', error);
            
            emitLog({
              type: 'error',
              message: `Auto-sign failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            });

            await sendResponse(client, topic, id, undefined, {
              code: -32000,
              message: error instanceof Error ? error.message : 'Request failed'
            });

            window.dispatchEvent(
              new CustomEvent('walletconnect:response', {
                detail: {
                  id: requestId,
                  success: false
                }
              })
            );
          }
        } else {
          const signaturePromise = new Promise((resolve, reject) => {
            const handleSignature = async (event: CustomEvent<{ id: string; approve: boolean }>) => {
              if (event.detail.id === requestId) {
                window.removeEventListener('walletconnect:signature' as any, handleSignature);
                
                try {
                  if (event.detail.approve) {
                    result = await processRequest(request, wallet, provider, session.walletId);
                    
                    // Format result as hex string if it's a Buffer or Uint8Array
                    if (result instanceof Uint8Array || Buffer.isBuffer(result)) {
                      result = '0x' + Buffer.from(result).toString('hex');
                    }

                    await sendResponse(client, topic, id, result);

                    window.dispatchEvent(
                      new CustomEvent('walletconnect:response', {
                        detail: {
                          id: requestId,
                          success: true
                        }
                      })
                    );

                    emitLog({
                      type: 'success',
                      message: `Request approved: ${request.method}`
                    });

                    resolve(result);
                  } else {
                    await sendResponse(client, topic, id, undefined, {
                      code: 4001,
                      message: 'User rejected the request'
                    });

                    window.dispatchEvent(
                      new CustomEvent('walletconnect:response', {
                        detail: {
                          id: requestId,
                          success: false
                        }
                      })
                    );

                    emitLog({
                      type: 'info',
                      message: `Request rejected: ${request.method}`
                    });

                    reject(new Error('User rejected the request'));
                  }
                } catch (error) {
                  console.error('Error processing request:', error);
                  reject(error);
                }
              }
            };

            window.addEventListener('walletconnect:signature' as any, handleSignature);
          });

          await signaturePromise;
        }
      } catch (error) {
        console.error('Request failed:', error);
        
        emitLog({
          type: 'error',
          message: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });

        if (event?.params?.id) {
          window.dispatchEvent(
            new CustomEvent('walletconnect:response', {
              detail: {
                id: event.params.id.toString(),
                success: false
              }
            })
          );

          await sendResponse(client, event.topic, event.params.id, undefined, {
            code: -32000,
            message: error instanceof Error ? error.message : 'Request failed'
          });
        }
      }
    });

    client.on('session_proposal', async (proposal) => {
      try {
        const { id, params } = proposal;
        const { requiredNamespaces, relays } = params;

        emitLog({
          type: 'info',
          message: 'Processing session proposal...'
        });

        const chain = formatChainId(chainId);
        const namespaces: Record<string, {
          accounts: string[];
          methods: string[];
          events: string[];
          chains: string[];
        }> = {
          eip155: {
            accounts: [`${chain}:${wallet.address.toLowerCase()}`],
            methods: [
              'eth_sendTransaction',
              'eth_signTransaction',
              'eth_sign',
              'personal_sign',
              'eth_signTypedData',
              'eth_signTypedData_v4',
              'wallet_switchEthereumChain',
              'wallet_addEthereumChain',
              'eth_accounts',
              'eth_chainId'
            ],
            events: ['chainChanged', 'accountsChanged'],
            chains: [chain]
          }
        };

        emitLog({
          type: 'pending',
          message: 'Approving session...'
        });

        const { acknowledged } = await client.approve({
          id,
          relayProtocol: relays[0].protocol,
          namespaces
        });

        await acknowledged();
        
        emitLog({
          type: 'success',
          message: 'Session approved successfully'
        });

        const { error: updateError } = await supabase
          .from('wallets')
          .update({ status: 'connected' })
          .eq('id', session.walletId);

        if (updateError) {
          console.error('Failed to update wallet status:', updateError);
        }
      } catch (error) {
        console.error('Session proposal failed:', error);
        
        emitLog({
          type: 'error',
          message: `Session proposal failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });

        try {
          await client.reject({
            id: proposal.id,
            reason: getSdkError('USER_REJECTED')
          });
        } catch (rejectError) {
          console.error('Failed to reject session proposal:', rejectError);
        }
      }
    });

    emitLog({
      type: 'success',
      message: 'WalletConnect session established successfully'
    });
  } catch (error) {
    console.error('WalletConnect connection failed:', error);
    throw error instanceof Error ? error : new Error('Failed to establish WalletConnect session');
  }
}

async function processRequest(
  request: { method: string; params: any[] },
  wallet: ethers.Wallet,
  provider: ethers.Provider,
  walletId: string
): Promise<any> {
  return signWithBackend({
    walletId,
    method: request.method,
    params: request.params
  });
}