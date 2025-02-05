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

export async function createProvider(network: Network): Promise<ethers.JsonRpcProvider> {
  // For SKALE, always use the direct RPC URL with custom network configuration
  if (network.id === 'skale') {
    try {
      const provider = new ethers.JsonRpcProvider(network.rpcUrl, {
        chainId: network.chainId,
        name: network.name,
        ensAddress: null,
        // Add SKALE-specific network configuration
        skipFetchSetup: true, // Skip initial network detection
        staticNetwork: true, // Use static network configuration
        // Add custom headers for SKALE
        headers: {
          'Accept': '*/*',
          'Origin': window.location.origin
        }
      });
      
      // Override getNetwork to always return the correct chain ID
      const originalGetNetwork = provider.getNetwork.bind(provider);
      provider.getNetwork = async () => {
        try {
          const network = await originalGetNetwork();
          return {
            ...network,
            chainId: BigInt(network.chainId),
            name: 'skale'
          };
        } catch (error) {
          // Return static network info if RPC call fails
          return {
            chainId: BigInt(network.chainId),
            name: 'skale'
          };
        }
      };

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

  // Try Infura first for supported networks
  if (['ethereum', 'polygon', 'arbitrum', 'linea', 'base'].includes(network.id)) {
    try {
      const infuraKey = await getInfuraKey();
      if (infuraKey) {
        const networkMap: { [key: string]: string } = {
          'ethereum': 'mainnet',
          'polygon': 'matic',
          'arbitrum': 'arbitrum',
          'linea': 'linea',
          'base': 'base'
        };

        const provider = new ethers.InfuraProvider(networkMap[network.id], infuraKey);
        await provider.getNetwork(); // Test connection
        return provider;
      }
    } catch (infuraError) {
      console.log(`Infura not available for ${network.name}, falling back to BlastAPI`);
    }
  }

  // Try BlastAPI for remaining networks
  const blastApiKey = await getBlastApiKey();
  if (!blastApiKey) {
    throw new Error('No API providers available. Please add either a BlastAPI or Infura key to the database.');
  }

  // Map network to BlastAPI endpoint
  const networkMap: { [key: string]: string } = {
    'ethereum': 'eth',
    'bnb': 'bsc',
    'polygon': 'polygon',
    'arbitrum': 'arbitrum',
    'avalanche': 'avalanche',
    'base': 'base',
    'linea': 'linea',
    'blast': 'blast',
    'celo': 'celo'
  };

  const blastNetwork = networkMap[network.id];
  if (!blastNetwork) {
    throw new Error(`Network ${network.id} is not supported by any available provider`);
  }

  const blastUrl = `https://${blastNetwork}.blastapi.io/${blastApiKey}`;
  
  try {
    const provider = new ethers.JsonRpcProvider(blastUrl, {
      chainId: network.chainId,
      name: network.name,
      ensAddress: null
    });
    await provider.getNetwork(); // Test connection
    return provider;
  } catch (error) {
    console.error('Failed to connect to BlastAPI:', error);
    throw new Error(`Failed to connect to provider for ${network.name}. Please try again later.`);
  }
}

async function getInfuraKey(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('key')
      .eq('provider', 'infura')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching Infura key:', error);
      return null;
    }
    return data?.key || null;
  } catch (error) {
    console.error('Error fetching Infura key:', error);
    return null;
  }
}