import { ethers } from 'ethers';
import { Network } from '../types';
import { supabase } from './supabase';

interface ProviderKey {
  id: string;
  provider: string;
  key: string;
  is_active: boolean;
}

export async function getBlastApiKey(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('key')
      .eq('provider', 'blastapi')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching BlastAPI key:', error);
      return null;
    }
    return data?.key || null;
  } catch (error) {
    console.error('Error fetching BlastAPI key:', error);
    return null;
  }
}

async function createBlastApiProvider(network: Network, apiKey: string): Promise<ethers.JsonRpcProvider> {
  // Map network to BlastAPI endpoint
  const networkMap: { [key: string]: string } = {
    'ethereum': 'eth-mainnet',
    'bnb': 'bsc-mainnet',
    'polygon': 'polygon-mainnet',
    'arbitrum': 'arbitrum-one',
    'avalanche': 'avalanche-mainnet',
    'base': 'base-mainnet',
    'linea': 'linea-mainnet',
    'blast': 'blast-mainnet',
    'celo': 'celo-mainnet'
  };

  const blastNetwork = networkMap[network.id];
  if (!blastNetwork) {
    throw new Error(`Network ${network.id} is not supported by BlastAPI`);
  }

  const blastUrl = `https://${blastNetwork}.blastapi.io/${apiKey}`;
  
  const provider = new ethers.JsonRpcProvider(blastUrl, {
    chainId: network.chainId,
    name: network.name,
    ensAddress: null,
    skipFetchSetup: true,
    staticNetwork: true,
    headers: {
      'Accept': '*/*',
      'Origin': window.location.origin
    }
  });

  // Test connection with retry and timeout
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          controller.abort();
          reject(new Error('Provider connection timeout'));
        }, 10000);
      });

      const networkPromise = provider.getNetwork();

      await Promise.race([networkPromise, timeoutPromise]);
      return provider;
    } catch (error) {
      lastError = error;
      console.warn(`Provider connection attempt ${attempt} failed:`, error);
      
      if (attempt < 3) {
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw lastError || new Error(`Failed to connect to BlastAPI for ${network.name}`);
}

export async function createProvider(network: Network): Promise<ethers.JsonRpcProvider> {
  // For SKALE, always use the direct RPC URL with custom network configuration
  if (network.id === 'skale') {
    try {
      const provider = new ethers.JsonRpcProvider(network.rpcUrl, {
        chainId: network.chainId,
        name: network.name,
        ensAddress: null,
        skipFetchSetup: true,
        staticNetwork: true,
        headers: {
          'Accept': '*/*',
          'Origin': window.location.origin
        }
      });
      
      // Test connection but don't fail if it doesn't work
      // SKALE nodes might return errors for some RPC calls
      try {
        await provider.getNetwork();
      } catch (error) {
        console.warn('SKALE network test failed, but continuing:', error);
      }

      return provider;
    } catch (error) {
      console.error('Failed to create SKALE provider:', error);
      throw new Error(`Failed to connect to SKALE network. Please try again later.`);
    }
  }

  // For all other networks, use BlastAPI
  const blastApiKey = await getBlastApiKey();
  if (!blastApiKey) {
    throw new Error('No BlastAPI key found. Please add a BlastAPI key to the database.');
  }

  try {
    return await createBlastApiProvider(network, blastApiKey);
  } catch (error) {
    console.error('Failed to connect to BlastAPI:', error);
    
    // Try fallback RPC if available
    if (network.rpcUrl) {
      console.log('Attempting to use fallback RPC URL...');
      try {
        const provider = new ethers.JsonRpcProvider(network.rpcUrl, {
          chainId: network.chainId,
          name: network.name,
          ensAddress: null,
          skipFetchSetup: true,
          staticNetwork: true,
          headers: {
            'Accept': '*/*',
            'Origin': window.location.origin
          }
        });

        await provider.getNetwork();
        return provider;
      } catch (fallbackError) {
        console.error('Fallback RPC also failed:', fallbackError);
      }
    }

    throw new Error(`Failed to connect to provider for ${network.name}. Please try again later.`);
  }
}