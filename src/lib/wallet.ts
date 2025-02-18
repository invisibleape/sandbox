import { ethers } from 'ethers';
import { supabase } from './supabase';
import { withRetry } from './supabase';
import { encryptPrivateKey } from './crypto';
import { createProvider } from './providers';
import { Network } from '../types';
import { networks } from './networks';

// Format address helper
export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Generate a single wallet
async function generateSingleWallet(network: Network) {
  try {
    console.log('Starting wallet generation');
    
    // Create a random wallet without a provider first
    const wallet = ethers.Wallet.createRandom();
    
    if (!wallet.mnemonic?.phrase) {
      throw new Error('Failed to generate mnemonic phrase');
    }

    if (!wallet.privateKey) {
      throw new Error('Failed to generate private key');
    }

    console.log('Wallet keys generated successfully');

    const encryptedPrivateKey = await encryptPrivateKey(wallet.privateKey);
    const encryptedMnemonic = await encryptPrivateKey(wallet.mnemonic.phrase);
    
    console.log('Wallet generated and encrypted successfully', { 
      address: wallet.address,
      hasPrivateKey: !!encryptedPrivateKey,
      hasMnemonic: !!encryptedMnemonic,
      network: network.id,
      chainId: network.chainId
    });
    
    return {
      address: wallet.address.toLowerCase(),
      private_key: encryptedPrivateKey,
      mnemonic: encryptedMnemonic,
      network: network.id,
      chain_id: network.chainId,
      status: 'created',
      created_at: new Date().toISOString(),
      transaction_count: 0
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('Error generating individual wallet:', {
      error: errorMessage,
      stack: err instanceof Error ? err.stack : undefined,
      network: network.id,
      chainId: network.chainId
    });
    return null;
  }
}

// Generate multiple wallets
export async function generateWallets(count: number = 100, network: Network) {
  try {
    const batchSize = 10;
    const batches = Math.ceil(count / batchSize);
    const allWallets = [];
    let successCount = 0;
    let errorCount = 0;

    console.log(`Starting batch generation of ${count} wallets for ${network.name} (Chain ID: ${network.chainId})`);

    for (let i = 0; i < batches; i++) {
      const currentBatchSize = Math.min(batchSize, count - i * batchSize);
      const walletPromises = Array(currentBatchSize).fill(null).map(() => generateSingleWallet(network));
      const batchWallets = await Promise.all(walletPromises);
      
      const validWallets = batchWallets.filter(Boolean);
      successCount += validWallets.length;
      errorCount += currentBatchSize - validWallets.length;
      
      if (validWallets.length > 0) {
        // Retry database insertion if it fails
        await withRetry(async () => {
          const { error: insertError } = await supabase
            .from('wallets')
            .insert(validWallets);

          if (insertError) throw insertError;
        });

        allWallets.push(...validWallets);
        console.log(`Batch ${i + 1}/${batches} completed`, {
          batchSize: validWallets.length,
          totalSuccess: successCount,
          totalError: errorCount,
          network: network.id,
          chainId: network.chainId
        });
      }
    }

    if (allWallets.length === 0) {
      throw new Error('Failed to generate any valid wallets');
    }

    console.log('Wallet generation completed', {
      totalGenerated: allWallets.length,
      successCount,
      errorCount,
      network: network.id,
      chainId: network.chainId
    });

    return { data: allWallets, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in generateWallets:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      network: network.id,
      chainId: network.chainId
    });
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Unknown error occurred') 
    };
  }
}

// Get wallet count with retry
export async function getWalletCount(): Promise<number> {
  return withRetry(async () => {
    console.log('Fetching wallet count...');
    
    const { count, error } = await supabase
      .from('wallets')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error getting wallet count:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details
      });
      throw error;
    }

    console.log('Successfully fetched wallet count:', { count });
    return count || 0;
  });
}

// Get wallets with filtering and pagination
export async function getWallets(filter: {
  status?: string;
  network?: string;
  search?: string;
  page: number;
  limit: number;
}) {
  return withRetry(async () => {
    console.log('Fetching wallets with filter:', filter);
    
    try {
      let query = supabase
        .from('wallets')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filter.status) {
        query = query.eq('status', filter.status);
      }
      
      if (filter.network) {
        query = query.eq('network', filter.network);
      }
      
      if (filter.search) {
        query = query.or(`address.ilike.%${filter.search}%,tag.ilike.%${filter.search}%`);
      }

      // Add pagination
      const from = (filter.page - 1) * filter.limit;
      const to = from + filter.limit - 1;
      
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error fetching wallets:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          filter
        });
        throw error;
      }

      console.log('Successfully fetched wallets:', {
        totalCount: count,
        pageCount: data?.length,
        page: filter.page,
        totalPages: Math.ceil((count || 0) / filter.limit)
      });

      return {
        data: data || [],
        count: count || 0,
        page: filter.page,
        totalPages: Math.ceil((count || 0) / filter.limit)
      };
    } catch (error) {
      console.error('Error in getWallets:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        filter
      });
      throw error;
    }
  });
}