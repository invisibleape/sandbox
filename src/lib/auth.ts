import { supabase } from './supabase';
import { Network } from '../types';
import { connectWalletConnect } from './walletconnect';
import { decryptPrivateKey } from './crypto';
import { ConnectionLog } from '../components/ConnectionLogs';

function emitLog(log: Omit<ConnectionLog, 'id' | 'timestamp'>) {
  const fullLog: ConnectionLog = {
    ...log,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  };

  window.dispatchEvent(
    new CustomEvent('walletconnect:log', { detail: fullLog })
  );
}

export async function connectWallet(uri: string, walletId: string, network: Network): Promise<void> {
  try {
    emitLog({
      type: 'info',
      message: `Starting wallet connection process for ${network.name} network...`
    });

    // Validate URI format
    if (!uri.startsWith('wc:')) {
      emitLog({
        type: 'error',
        message: 'Invalid WalletConnect URI format'
      });
      throw new Error('Invalid WalletConnect URI format');
    }

    emitLog({
      type: 'pending',
      message: 'Fetching wallet details...'
    });

    // Get the wallet from the database
    const { data: wallet, error: fetchError } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', walletId)
      .single();

    if (fetchError) {
      emitLog({
        type: 'error',
        message: `Database error: ${fetchError.message}`
      });
      throw new Error(`Failed to fetch wallet details: ${fetchError.message}`);
    }

    if (!wallet) {
      emitLog({
        type: 'error',
        message: 'Wallet not found in database'
      });
      throw new Error('Wallet not found');
    }

    emitLog({
      type: 'success',
      message: 'Wallet details retrieved successfully'
    });

    // Validate wallet network matches
    if (wallet.network !== network.id) {
      emitLog({
        type: 'error',
        message: `Network mismatch: wallet is on ${wallet.network}, trying to connect to ${network.id}`
      });
      throw new Error(`Wallet is on ${wallet.network} network, but trying to connect to ${network.id}`);
    }

    // Validate wallet status
    if (wallet.status === 'connected') {
      emitLog({
        type: 'error',
        message: 'Wallet is already connected'
      });
      throw new Error('Wallet is already connected');
    }

    emitLog({
      type: 'pending',
      message: 'Decrypting wallet credentials...'
    });

    const privateKey = await decryptPrivateKey(wallet.private_key);
    if (!privateKey) {
      emitLog({
        type: 'error',
        message: 'Failed to decrypt wallet private key'
      });
      throw new Error('Failed to decrypt wallet private key');
    }

    // Validate private key format
    if (!privateKey.match(/^0x[0-9a-f]{64}$/i)) {
      emitLog({
        type: 'error',
        message: 'Invalid private key format'
      });
      throw new Error('Invalid private key format');
    }

    emitLog({
      type: 'success',
      message: 'Wallet credentials decrypted successfully'
    });

    emitLog({
      type: 'pending',
      message: 'Initializing WalletConnect connection...'
    });

    await connectWalletConnect({
      uri,
      walletId,
      network,
      privateKey
    });

    emitLog({
      type: 'success',
      message: 'WalletConnect session established successfully'
    });
  } catch (error) {
    // Log the error
    emitLog({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });

    throw error instanceof Error 
      ? error 
      : new Error('Failed to connect wallet. Please try again.');
  }
}