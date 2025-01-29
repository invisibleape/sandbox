import { ethers } from 'ethers';
import { supabase } from './supabase';
import { Network } from '../types';

export async function getInfuraKey(): Promise<string | null> {
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

export async function createInfuraProvider(network: Network): Promise<ethers.InfuraProvider> {
  const apiKey = await getInfuraKey();
  if (!apiKey) {
    throw new Error('No active Infura API key found in the database. Please add an Infura API key first.');
  }

  // Map network to Infura network name
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
  
  try {
    const provider = new ethers.InfuraProvider(infuraNetwork, apiKey);
    // Test the provider connection
    await provider.getNetwork();
    return provider;
  } catch (error) {
    throw new Error(`Failed to connect to Infura for network ${network.name}. Please check your API key and try again.`);
  }
}