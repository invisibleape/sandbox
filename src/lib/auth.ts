import { supabase } from './supabase';
import { Network } from '../types';
import { getWalletKit, setCurrentWalletId, pair } from './walletkit';
import { decryptPrivateKey } from './crypto';
import { ConnectionLog } from '../components/ConnectionLogs';

function emitLog(log: Omit<ConnectionLog, 'id' | 'timestamp'>) {
  const fullLog: ConnectionLog = {
    ...log,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  };

  window.dispatchEvent(
    new CustomEvent('reown:log', { detail: fullLog })
  );
}

export async function connectWallet(uri: string, walletId: string, network: Network, autoSign: boolean = false): Promise<void> {
  try {
    emitLog({
      type: 'info',
      message: `Starting wallet connection process for ${network.name} network...`,
      walletId
    });

    // Validate URI format
    const trimmedUri = uri.trim();
    if (!trimmedUri.startsWith('wc:') && !trimmedUri.startsWith('reown:')) {
      throw new Error('Invalid URI format. URI must start with "wc:" or "reown:"');
    }

    // Convert WalletConnect URI to Reown format if needed
    const reownUri = trimmedUri.startsWith('wc:') 
      ? trimmedUri.replace('wc:', 'reown:')
      : trimmedUri;

    emitLog({
      type: 'pending',
      message: 'Fetching wallet details...',
      walletId
    });

    // Get the wallet from the database
    const { data: wallet, error: fetchError } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', walletId)
      .single();

    if (fetchError || !wallet) {
      const error = fetchError?.message || 'Failed to fetch wallet details';
      emitLog({
        type: 'error',
        message: error,
        walletId
      });
      throw new Error(error);
    }

    emitLog({
      type: 'success',
      message: `Wallet details retrieved successfully for ID: ${walletId}`,
      walletId
    });

    // Log wallet details (excluding sensitive data)
    emitLog({
      type: 'info',
      message: `Wallet info - Address: ${wallet.address}, Network: ${wallet.network}, Chain ID: ${wallet.chain_id}`,
      walletId
    });

    // Validate wallet network matches
    if (wallet.network !== network.id) {
      const error = `Network mismatch: wallet is on ${wallet.network}, trying to connect to ${network.id}`;
      emitLog({
        type: 'error',
        message: error,
        walletId
      });
      throw new Error(error);
    }

    // Validate wallet status
    if (wallet.status === 'connected') {
      const error = 'Wallet is already connected';
      emitLog({
        type: 'error',
        message: error,
        walletId
      });
      throw new Error(error);
    }

    // Set current wallet ID before initializing WalletKit
    setCurrentWalletId(walletId);

    emitLog({
      type: 'pending',
      message: 'Initializing Reown connection...',
      walletId
    });

    // Connect using Reown
    await pair(reownUri, walletId, autoSign);

    emitLog({
      type: 'success',
      message: 'Reown session established successfully',
      walletId
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Reown connection failed:', error);
    
    emitLog({
      type: 'error',
      message: errorMessage,
      walletId
    });
    
    throw new Error(errorMessage);
  }
}