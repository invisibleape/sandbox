import { Core } from '@walletconnect/core';
import { WalletKit } from '@reown/walletkit';
import { supabase } from './supabase';
import { decryptPrivateKey } from './crypto';
import { ethers } from 'ethers';
import { ReownKit } from '../types/reown';
import { formatAddress } from './wallet';
import { storeLog } from './logs';
import { networks } from './networks';
import { createProvider } from './providers';

let walletKit: ReownKit | null = null;
let currentWalletId: string | null = null;
let autoMintEnabled = true;

// Track active sessions with their topics
const activeSessions = new Map<string, {
  walletId: string;
  address: string;
  chainId: number;
  privateKey: string;
  topics: Set<string>;
  autoSign: boolean;
  network: string;
}>();

// Track pending proposals with numeric and string IDs
const pendingProposals = new Map<string, {
  id: string;
  pairingTopic: string;
  proposalId: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}>();

function emitLog(type: 'info' | 'success' | 'error' | 'pending', message: string, details?: any) {
  if (!currentWalletId) {
    console.warn('No wallet ID set for log:', message);
    return;
  }

  // Deep clone and sanitize details to ensure they can be stringified
  const sanitizedDetails = details ? JSON.parse(JSON.stringify(details, (key, value) => {
    // Convert BigInt to string
    if (typeof value === 'bigint') {
      return value.toString();
    }
    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      const seen = new WeakSet();
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  })) : undefined;

  const log = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type,
    message,
    walletId: currentWalletId,
    details: sanitizedDetails
  };

  console.debug('[WalletKit]', message, sanitizedDetails);

  window.dispatchEvent(
    new CustomEvent('reown:log', { detail: log })
  );

  // Store log in database
  storeLog(log, currentWalletId).catch(error => {
    console.error('Failed to store log:', error);
  });
}

async function updateWalletStatus(walletId: string, status: 'created' | 'connected' | 'minting' | 'completed' | 'failed') {
  try {
    const { error } = await supabase
      .from('wallets')
      .update({ status })
      .eq('id', walletId);

    if (error) {
      throw error;
    }

    emitLog('info', `Updated wallet status to ${status}`, { walletId });
  } catch (error) {
    emitLog('error', 'Failed to update wallet status', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function handleTransaction(wallet: ethers.Wallet, provider: ethers.Provider, tx: any) {
  try {
    // Prepare transaction parameters
    const txParams: any = {
      to: tx.to,
      data: tx.data,
      value: tx.value ? ethers.getBigInt(tx.value) : undefined
    };

    // Handle gas parameters
    if (tx.gas) {
      txParams.gasLimit = ethers.getBigInt(tx.gas);
    } else {
      try {
        const gasEstimate = await provider.estimateGas({
          from: wallet.address,
          ...txParams
        });
        txParams.gasLimit = gasEstimate * BigInt(12) / BigInt(10); // Add 20% buffer
        emitLog('info', 'Gas estimated', { gasLimit: txParams.gasLimit.toString() });
      } catch (error) {
        emitLog('error', 'Gas estimation failed, using safe default', { error: error instanceof Error ? error.message : 'Unknown error' });
        txParams.gasLimit = ethers.getBigInt('1000000'); // Higher default gas limit
      }
    }

    // Handle gas price parameters
    if (tx.maxFeePerGas && tx.maxPriorityFeePerGas) {
      txParams.maxFeePerGas = ethers.getBigInt(tx.maxFeePerGas);
      txParams.maxPriorityFeePerGas = ethers.getBigInt(tx.maxPriorityFeePerGas);
    } else {
      try {
        const feeData = await provider.getFeeData();
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          // Add 20% buffer to fees
          txParams.maxFeePerGas = feeData.maxFeePerGas * BigInt(12) / BigInt(10);
          txParams.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas * BigInt(12) / BigInt(10);
          emitLog('info', 'Using network fee data with buffer', {
            maxFeePerGas: txParams.maxFeePerGas.toString(),
            maxPriorityFeePerGas: txParams.maxPriorityFeePerGas.toString()
          });
        } else {
          // Fallback to legacy gas price
          const gasPrice = await provider.getGasPrice();
          txParams.gasPrice = gasPrice * BigInt(12) / BigInt(10); // Add 20% buffer
          emitLog('info', 'Using legacy gas price with buffer', { gasPrice: txParams.gasPrice.toString() });
        }
      } catch (error) {
        emitLog('error', 'Fee data fetch failed, using safe default', { error: error instanceof Error ? error.message : 'Unknown error' });
        // Use high default values for SKALE
        txParams.gasPrice = ethers.parseUnits('1', 'gwei');
      }
    }

    // Handle nonce
    if (tx.nonce !== undefined) {
      txParams.nonce = Number(tx.nonce);
    } else {
      txParams.nonce = await provider.getTransactionCount(wallet.address);
    }

    // Send transaction with retry logic
    const MAX_RETRIES = 3;
    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await wallet.sendTransaction(txParams);
        
        emitLog('pending', 'Transaction sent, waiting for confirmation', {
          hash: response.hash,
          attempt: attempt + 1
        });

        const receipt = await response.wait();
        
        emitLog('success', 'Transaction confirmed', {
          hash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString()
        });

        return response.hash;
      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (attempt < MAX_RETRIES - 1) {
          emitLog('error', `Transaction attempt ${attempt + 1} failed, retrying...`, { error: errorMessage });
          // Increase gas and fees for next attempt
          txParams.gasLimit = txParams.gasLimit * BigInt(12) / BigInt(10);
          if (txParams.maxFeePerGas) {
            txParams.maxFeePerGas = txParams.maxFeePerGas * BigInt(12) / BigInt(10);
            txParams.maxPriorityFeePerGas = txParams.maxPriorityFeePerGas * BigInt(12) / BigInt(10);
          } else if (txParams.gasPrice) {
            txParams.gasPrice = txParams.gasPrice * BigInt(12) / BigInt(10);
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt))); // Exponential backoff
        }
      }
    }

    throw lastError || new Error('Transaction failed after all retries');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    emitLog('error', 'Transaction failed', { error: errorMessage });
    throw error;
  }
}

async function setupEventHandlers(kit: ReownKit) {
  kit.on('session_proposal', async (event) => {
    try {
      // Extract topics from event
      const pairingTopic = event.params?.pairingTopic;
      const proposalId = event.id?.toString();

      emitLog('info', 'Received session proposal', {
        id: proposalId,
        pairingTopic,
        params: event.params
      });

      if (!pairingTopic || !proposalId) {
        throw new Error('Missing required proposal data');
      }

      if (!currentWalletId) {
        throw new Error('No wallet selected');
      }

      // Store proposal data with multiple ID formats
      const proposalData = {
        id: proposalId,
        pairingTopic,
        proposalId,
        timestamp: Date.now(),
        metadata: event.params?.proposer?.metadata
      };
      
      // Store with both string and numeric IDs
      pendingProposals.set(proposalId, proposalData);
      pendingProposals.set(event.id.toString(), proposalData);
      pendingProposals.set(String(event.id), proposalData);

      // Get wallet details
      const { data: wallet, error: fetchError } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', currentWalletId)
        .single();

      if (fetchError || !wallet) {
        throw new Error(`Failed to fetch wallet: ${fetchError?.message}`);
      }

      emitLog('info', 'Retrieved wallet details', {
        address: formatAddress(wallet.address),
        network: wallet.network,
        chainId: wallet.chain_id
      });

      // Decrypt private key
      const privateKey = await decryptPrivateKey(wallet.private_key);

      // Create session with all possible topics
      const session = {
        walletId: wallet.id,
        address: wallet.address.toLowerCase(),
        chainId: wallet.chain_id,
        privateKey,
        topics: new Set([pairingTopic, proposalId]),
        autoSign: true, // Default to auto-sign enabled
        network: wallet.network
      };

      // Store session with all possible topic keys
      for (const topic of session.topics) {
        activeSessions.set(`wc:${topic}`, session);
        activeSessions.set(topic, session);
      }

      emitLog('info', 'Storing session', {
        topics: Array.from(session.topics),
        address: formatAddress(session.address)
      });

      // Get the network configuration
      const network = networks.find(n => n.id === session.network);
      if (!network) {
        throw new Error(`Network configuration not found for ${session.network}`);
      }

      // Get chain ID and create namespaces
      const chainId = network.chainId;
      const chainIdHex = `0x${chainId.toString(16)}`;
      
      // Create the namespace for this specific network only
      const namespaces = {
        eip155: {
          chains: [`eip155:${chainId}`],
          methods: [
            'eth_sendTransaction',
            'personal_sign',
            'eth_signTypedData',
            'eth_signTypedData_v4',
            'eth_sign',
            'eth_accounts',
            'eth_chainId',
            'wallet_switchEthereumChain'
          ],
          events: ['chainChanged', 'accountsChanged'],
          accounts: [`eip155:${chainId}:${wallet.address.toLowerCase()}`]
        }
      };

      emitLog('info', 'Approving session with namespaces', { 
        chainId,
        chainIdHex,
        network: network.name
      });

      // Approve session with namespaces
      const approvalParams = {
        id: Number(proposalId),
        namespaces
      };

      await kit.approveSession(approvalParams);

      // Update wallet status to connected
      await updateWalletStatus(wallet.id, 'connected');

      // Clean up all proposal entries
      pendingProposals.delete(proposalId);
      pendingProposals.delete(event.id.toString());
      pendingProposals.delete(String(event.id));

      emitLog('success', 'Session approved', {
        address: formatAddress(session.address),
        topics: Array.from(session.topics),
        chainId,
        network: network.name
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      emitLog('error', 'Session proposal failed', { error: errorMessage });
      
      if (event.id) {
        // Clean up proposal entries on error
        pendingProposals.delete(event.id.toString());
        pendingProposals.delete(String(event.id));
        
        await kit.rejectSession({
          id: Number(event.id),
          reason: {
            code: 4001,
            message: errorMessage
          }
        });
      }
    }
  });

  kit.on('session_delete', async (event) => {
    try {
      const { topic } = event;
      emitLog('info', 'Session deleted', { topic });

      // Find the session by topic
      const session = activeSessions.get(topic) || activeSessions.get(`wc:${topic}`);
      if (session) {
        // Update wallet status to created
        await updateWalletStatus(session.walletId, 'created');

        // Remove all topic entries for this session
        for (const sessionTopic of session.topics) {
          activeSessions.delete(sessionTopic);
          activeSessions.delete(`wc:${sessionTopic}`);
        }

        emitLog('success', 'Session cleanup completed', {
          walletId: session.walletId,
          address: formatAddress(session.address)
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      emitLog('error', 'Session deletion failed', { error: errorMessage });
    }
  });

  kit.on('session_request', async (request) => {
    try {
      const { topic, params, id } = request;
      
      emitLog('info', 'Received session request', { 
        topic,
        id,
        method: params.request.method,
        params: params.request.params
      });

      // Try all possible topic keys
      const possibleKeys = [
        `wc:${topic}`,
        topic,
        ...Array.from(activeSessions.keys())
      ];

      let session;
      for (const key of possibleKeys) {
        session = activeSessions.get(key);
        if (session) {
          // Add this topic to the session's topics
          session.topics.add(topic);
          // Store session with new topic
          activeSessions.set(`wc:${topic}`, session);
          activeSessions.set(topic, session);
          break;
        }
      }

      if (!session) {
        emitLog('error', 'Session not found', {
          topic,
          availableSessions: Array.from(activeSessions.keys())
        });
        throw new Error(`Session not found for topic: ${topic}`);
      }

      // Get the network configuration
      const network = networks.find(n => n.id === session.network);
      if (!network) {
        throw new Error(`Network configuration not found for ${session.network}`);
      }

      // Create provider for the current network
      const provider = await createProvider(network);

      // Create wallet instance
      const wallet = new ethers.Wallet(session.privateKey, provider);

      // Check if this is a mint transaction
      const isMintTransaction = params.request.method === 'eth_sendTransaction' && 
        params.request.params[0]?.data?.toLowerCase().includes('0x40c10f19'); // mint function signature

      // Determine if we should auto-approve
      const shouldAutoApprove = session.autoSign && (!isMintTransaction || autoMintEnabled);

      // Emit request event for UI
      window.dispatchEvent(
        new CustomEvent('reown:request', {
          detail: {
            id: request.id,
            method: params.request.method,
            params: params.request.params,
            timestamp: Date.now(),
            pending: !shouldAutoApprove
          }
        })
      );

      // Handle auto-signing or wait for user approval
      let approved = shouldAutoApprove;
      
      if (!shouldAutoApprove) {
        emitLog('pending', `Waiting for user approval${isMintTransaction ? ' (Mint Transaction)' : ''}`, {
          method: params.request.method,
          address: formatAddress(session.address)
        });

        approved = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Request timed out'));
          }, 180000); // 3 minute timeout

          const handleResponse = (event: CustomEvent) => {
            if (event.detail.id === request.id) {
              clearTimeout(timeout);
              window.removeEventListener('reown:signature' as any, handleResponse);
              resolve(event.detail.approve);
            }
          };

          window.addEventListener('reown:signature' as any, handleResponse);
        });
      }

      if (!approved) {
        throw new Error('User rejected request');
      }

      let result;
      switch (params.request.method) {
        case 'personal_sign': {
          const [message] = params.request.params;
          emitLog('info', 'Signing message', {
            message: ethers.isHexString(message) ? ethers.toUtf8String(message) : message
          });
          result = await wallet.signMessage(
            ethers.isHexString(message) ? ethers.toUtf8String(message) : message
          );
          break;
        }

        case 'eth_signTypedData':
        case 'eth_signTypedData_v4': {
          const [, data] = params.request.params;
          const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
          emitLog('info', 'Signing typed data', {
            domain: parsedData.domain,
            primaryType: parsedData.primaryType
          });
          result = await wallet.signTypedData(
            parsedData.domain,
            { [parsedData.primaryType]: parsedData.types[parsedData.primaryType] },
            parsedData.message
          );
          break;
        }

        case 'eth_sendTransaction': {
          const [tx] = params.request.params;
          emitLog('info', 'Processing transaction request', {
            to: tx.to,
            value: tx.value,
            data: tx.data?.slice(0, 64) + '...' // Log only first 32 bytes of data
          });

          result = await handleTransaction(wallet, provider, tx);
          break;
        }

        case 'wallet_switchEthereumChain': {
          const [{ chainId }] = params.request.params;
          const requestedChainId = parseInt(chainId, 16);
          emitLog('info', 'Switching chain', { chainId, requestedChainId });

          // Find the requested network in our supported networks
          const requestedNetwork = networks.find(n => n.chainId === requestedChainId);
          if (!requestedNetwork) {
            throw new Error(`Chain ID ${requestedChainId} is not supported`);
          }

          // Always allow chain switching - we support all networks
          result = null;
          emitLog('success', 'Chain switch allowed', {
            requestedChain: requestedChainId,
            chainName: requestedNetwork.name
          });
          break;
        }

        case 'eth_accounts': {
          result = [session.address.toLowerCase()];
          break;
        }

        case 'eth_chainId': {
          const network = networks.find(n => n.id === session.network);
          if (!network) {
            throw new Error(`Network configuration not found for ${session.network}`);
          }
          // For networks that use Ethereum wallets, always return chainId 1
          const chainId = network.useEthereumWallet ? 1 : network.chainId;
          result = `0x${chainId.toString(16)}`;
          break;
        }

        default:
          throw new Error(`Unsupported method: ${params.request.method}`);
      }

      // Emit success response
      window.dispatchEvent(
        new CustomEvent('reown:response', {
          detail: {
            id: request.id,
            success: true
          }
        })
      );

      const response = {
        topic,
        response: {
          id: Number(id),
          jsonrpc: '2.0',
          result
        }
      };

      emitLog('info', 'Sending response', response);
      await kit.respondSessionRequest(response);

      emitLog('success', 'Request completed', { 
        method: params.request.method,
        address: formatAddress(session.address)
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      emitLog('error', 'Request failed', { error: errorMessage });

      window.dispatchEvent(
        new CustomEvent('reown:response', {
          detail: {
            id: request.id,
            success: false,
            error: errorMessage
          }
        })
      );

      await kit.respondSessionRequest({
        topic: request.topic,
        response: {
          id: Number(request.id),
          jsonrpc: '2.0',
          error: {
            code: 4001,
            message: errorMessage
          }
        }
      });
    }
  });

  // Add proposal cleanup on pairing
  kit.on('pairing', async (event) => {
    try {
      emitLog('info', 'Pairing event received', { topic: event.topic });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      emitLog('error', 'Pairing event handler failed', { error: errorMessage });
    }
  });
}

async function getWalletKit(): Promise<ReownKit> {
  if (walletKit) return walletKit;

  emitLog('info', 'Initializing WalletKit');

  const projectId = import.meta.env.VITE_REOWN_PROJECT_ID;
  if (!projectId) {
    throw new Error('Reown Project ID not configured');
  }

  const core = new Core({
    projectId,
    relayUrl: 'wss://relay.walletconnect.com',
    logger: 'error'
  });

  const kit = await WalletKit.init({
    core,
    metadata: {
      name: 'Token Gating Test Dashboard',
      description: 'Admin dashboard for wallet management',
      url: window.location.origin,
      icons: ['https://avatars.githubusercontent.com/u/37784886']
    }
  }) as ReownKit;

  await setupEventHandlers(kit);
  emitLog('success', 'WalletKit initialized');
  
  walletKit = kit;
  return kit;
}

function setCurrentWalletId(walletId: string | null) {
  currentWalletId = walletId;
  if (walletId) {
    emitLog('info', 'Current wallet set', { walletId });
  }
}

function setAutoMint(enabled: boolean) {
  autoMintEnabled = enabled;
  emitLog('info', `Auto-mint ${enabled ? 'enabled' : 'disabled'}`);
}

async function pair(uri: string, walletId: string, autoSign: boolean = true, autoMint: boolean = true) {
  try {
    const maskedUri = uri.replace(/([^:]+:)([^@]+)(@.*)/, '$1****$3');
    emitLog('info', 'Starting pairing', { 
      walletId,
      autoSign,
      autoMint,
      uri: maskedUri
    });

    autoMintEnabled = autoMint;
    const kit = await getWalletKit();
    setCurrentWalletId(walletId);

    // Update auto-sign setting for existing sessions
    for (const [key, session] of activeSessions.entries()) {
      if (session.walletId === walletId) {
        session.autoSign = autoSign;
        activeSessions.set(key, session);
        emitLog('info', 'Updated auto-sign setting for session', {
          topic: key,
          autoSign
        });
      }
    }

    await kit.pair({ 
      uri: uri.replace(/^reown:/, 'wc:'),
      metadata: {
        name: 'Token Gating Test Dashboard',
        description: 'Admin dashboard for wallet management',
        url: window.location.origin,
        icons: ['https://avatars.githubusercontent.com/u/37784886']
      }
    });

    emitLog('success', 'Pairing initiated');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    emitLog('error', 'Pairing failed', { error: errorMessage });
    throw error;
  }
}

export { getWalletKit, setCurrentWalletId, setAutoMint, pair };