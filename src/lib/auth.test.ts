import { describe, it, expect, beforeEach, vi } from 'vitest';
import { connectWallet } from './auth';
import { supabase } from './supabase';
import { getWalletKit } from './walletkit';
import { Network } from '../types';

// Mock dependencies
vi.mock('./supabase');
vi.mock('./walletkit');

describe('Auth', () => {
  const mockNetwork: Network = {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: 'https://eth.example.com',
    logoUrl: 'https://example.com/eth.png',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('connectWallet', () => {
    it('should convert WalletConnect URI to Reown format', async () => {
      const wcUri = 'wc:123@2?relay-protocol=irn&symKey=abc';
      const wallet = {
        id: '123',
        network: 'ethereum',
        status: 'created'
      };

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: wallet })
      });

      const mockKit = {
        pair: vi.fn().mockResolvedValue(true)
      };
      vi.mocked(getWalletKit).mockResolvedValue(mockKit);

      await connectWallet(wcUri, '123', mockNetwork);

      expect(mockKit.pair).toHaveBeenCalledWith({
        uri: 'reown:123@2?relay-protocol=irn&symKey=abc',
        metadata: expect.any(Object)
      });
    });

    it('should validate network compatibility', async () => {
      const wallet = {
        id: '123',
        network: 'polygon',
        status: 'created'
      };

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: wallet })
      });

      await expect(
        connectWallet('reown:123', '123', mockNetwork)
      ).rejects.toThrow('Network mismatch');
    });

    it('should prevent reconnection of connected wallets', async () => {
      const wallet = {
        id: '123',
        network: 'ethereum',
        status: 'connected'
      };

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: wallet })
      });

      await expect(
        connectWallet('reown:123', '123', mockNetwork)
      ).rejects.toThrow('Wallet is already connected');
    });

    it('should handle database errors gracefully', async () => {
      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockRejectedValue(new Error('Database error'))
      });

      await expect(
        connectWallet('reown:123', '123', mockNetwork)
      ).rejects.toThrow('Failed to fetch wallet details');
    });
  });
});