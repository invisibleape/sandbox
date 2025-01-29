import { ethers } from 'ethers';
import { supabase } from './supabase';
import { encryptPrivateKey } from './crypto';
import { createInfuraProvider } from './infura';
import { Network } from '../types';
import { Database } from '../types/supabase';

interface WalletGenerationLog {
  timestamp: string;
  status: 'success' | 'error';
  message: string;
  details?: any;
}

export interface WalletColumn {
  id: keyof Database['public']['Tables']['wallets']['Row'];
  label: string;
  visible: boolean;
  render?: (value: any, wallet: Database['public']['Tables']['wallets']['Row']) => React.ReactNode;
}

export const defaultColumns: WalletColumn[] = [
  {
    id: 'address',
    label: 'Wallet Address',
    visible: true
  },
  {
    id: 'network',
    label: 'Network',
    visible: true
  },
  {
    id: 'status',
    label: 'Status',
    visible: true
  },
  {
    id: 'created_at',
    label: 'Created',
    visible: true
  },
  {
    id: 'first_transaction_at',
    label: 'First Transaction',
    visible: false
  },
  {
    id: 'last_transaction_at',
    label: 'Last Transaction',
    visible: false
  },
  {
    id: 'transaction_count',
    label: 'Transactions',
    visible: false
  },
  {
    id: 'tag',
    label: 'Tag',
    visible: true
  }
];

let generationLogs: WalletGenerationLog[] = [];

function logWalletGeneration(status: 'success' | 'error', message: string, details?: any) {
  const log = {
    timestamp: new Date().toISOString(),
    status,
    message,
    details
  };
  generationLogs = [log, ...generationLogs.slice(0, 99)];
  console.log(`[Wallet Generation ${status}]: ${message}`, details);
  return log;
}

export function getGenerationLogs() {
  return generationLogs;
}

async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = initialDelay * Math.pow(2, attempt - 1);
      console.log(`Retrying operation (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

async function generateSingleWallet(network: Network) {
  try {
    logWalletGeneration('success', 'Starting wallet generation');
    
    // Get Infura provider with retry
    const provider = await retryOperation(
      () => createInfuraProvider(network),
      3,
      1000
    );
    
    // Create a new random wallet and connect it to the provider
    const wallet = ethers.Wallet.createRandom().connect(provider);
    
    if (!wallet.mnemonic?.phrase) {
      throw new Error('Failed to generate mnemonic phrase');
    }

    if (!wallet.privateKey) {
      throw new Error('Failed to generate private key');
    }

    logWalletGeneration('success', 'Wallet keys generated successfully');

    const encryptedPrivateKey = await encryptPrivateKey(wallet.privateKey);
    const encryptedMnemonic = await encryptPrivateKey(wallet.mnemonic.phrase);
    
    logWalletGeneration('success', 'Wallet generated and encrypted successfully', { 
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
    const errorLog = logWalletGeneration('error', 'Failed to generate wallet', {
      error: errorMessage,
      stack: err instanceof Error ? err.stack : undefined,
      network: network.id,
      chainId: network.chainId
    });
    console.error('Error generating individual wallet:', errorLog);
    return null;
  }
}

export async function generateWallets(count: number = 100, network: Network) {
  try {
    const batchSize = 10;
    const batches = Math.ceil(count / batchSize);
    const allWallets = [];
    let successCount = 0;
    let errorCount = 0;

    logWalletGeneration('success', `Starting batch generation of ${count} wallets for ${network.name} (Chain ID: ${network.chainId})`);

    for (let i = 0; i < batches; i++) {
      const currentBatchSize = Math.min(batchSize, count - i * batchSize);
      const walletPromises = Array(currentBatchSize).fill(null).map(() => generateSingleWallet(network));
      const batchWallets = await Promise.all(walletPromises);
      
      const validWallets = batchWallets.filter(Boolean);
      successCount += validWallets.length;
      errorCount += currentBatchSize - validWallets.length;
      
      if (validWallets.length > 0) {
        // Retry database insertion if it fails
        await retryOperation(async () => {
          const { error: insertError } = await supabase
            .from('wallets')
            .insert(validWallets);

          if (insertError) throw insertError;
        });

        allWallets.push(...validWallets);
        logWalletGeneration('success', `Batch ${i + 1}/${batches} completed`, {
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

    logWalletGeneration('success', 'Wallet generation completed', {
      totalGenerated: allWallets.length,
      successCount,
      errorCount,
      network: network.id,
      chainId: network.chainId
    });

    return { data: allWallets, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorLog = logWalletGeneration('error', 'Wallet generation failed', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      network: network.id,
      chainId: network.chainId
    });
    console.error('Error in generateWallets:', errorLog);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Unknown error occurred') 
    };
  }
}

export async function getWalletCount(): Promise<number> {
  return retryOperation(async () => {
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

export async function getWalletsByStatus(status: string) {
  return retryOperation(async () => {
    console.log('Fetching wallets by status:', { status });
    
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error getting wallets by status:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details
      });
      throw error;
    }

    console.log('Successfully fetched wallets by status:', {
      status,
      count: data?.length
    });
    return data;
  });
}

export async function getWallets(filter: {
  status?: string;
  network?: string;
  search?: string;
  page: number;
  limit: number;
}) {
  return retryOperation(async () => {
    console.log('Fetching wallets with filter:', {
      ...filter,
      query: filter.search ? `search: ${filter.search}` : undefined
    });
    
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

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}