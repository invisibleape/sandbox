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
  // First try Infura for supported networks
  if (['ethereum', 'polygon', 'arbitrum', 'linea', 'base'].includes(network.id)) {
    try {
      const provider = await createInfuraProvider(network);
      return provider;
    } catch (error) {
      console.log(`Infura not available for ${network.name}, falling back to BlastAPI`);
    }
  }

  // Use BlastAPI for other networks
  const blastApiKey = await getBlastApiKey();
  if (!blastApiKey) {
    throw new Error('No active BlastAPI key found in the database. Please add a BlastAPI key first.');
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
    'celo': 'celo',
    'skale': 'skale'
  };

  const blastNetwork = networkMap[network.id];
  if (!blastNetwork) {
    throw new Error(`Network ${network.id} is not supported`);
  }

  const blastUrl = `https://${blastNetwork}.blastapi.io/${blastApiKey}`;
  
  try {
    const provider = new ethers.JsonRpcProvider(blastUrl);
    // Test the provider connection
    await provider.getNetwork();
    return provider;
  } catch (error) {
    throw new Error(`Failed to connect to BlastAPI for network ${network.name}. Please check your API key and try again.`);
  }
}

async function createInfuraProvider(network: Network): Promise<ethers.InfuraProvider> {
  const apiKey = await getInfuraKey();
  if (!apiKey) {
    throw new Error('No active Infura API key found');
  }

  const networkMap: { [key: string]: string } = {
    'ethereum': 'mainnet',
    'polygon': 'matic',
    'arbitrum': 'arbitrum',
    'linea': 'linea',
    'base': 'base'
  };

  const infuraNetwork = networkMap[network.id];
  if (!infuraNetwork) {
    throw new Error(`Network ${network.id} is not supported by Infura`);
  }
  
  const provider = new ethers.InfuraProvider(infuraNetwork, apiKey);
  await provider.getNetwork(); // Test connection
  return provider;
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