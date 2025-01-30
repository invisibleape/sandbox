import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WalletKit } from '@reown/walletkit';
import { getWalletKit } from './walletkit';
import { supabase } from './supabase';
import { ethers } from 'ethers';

// Mock dependencies
vi.mock('@reown/walletkit');
vi.mock('./supabase');
vi.mock('ethers');

describe('WalletKit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance
    vi.spyOn(global, 'crypto').mockImplementation(() => ({
      randomUUID: () => '123e4567-e89b-12d3-a456-426614174000',
      // Add other required crypto methods
    }));
  });

  describe('getWalletKit', () => {
    it('should initialize WalletKit with correct configuration', async () => {
      const mockInit = vi.fn().mockResolvedValue({
        on: vi.fn(),
        // Add other required methods
      });
      
      WalletKit.init = mockInit;

      await getWalletKit();

      expect(mockInit).toHaveBeenCalledWith({
        projectId: expect.any(String),
        metadata: {
          name: 'Token Gating Test Dashboard',
          description: 'Admin dashboard for wallet management',
          url: expect.any(String),
          icons: ['https://avatars.githubusercontent.com/u/37784886']
        }
      });
    });

    it('should return the same instance on subsequent calls', async () => {
      const instance1 = await getWalletKit();
      const instance2 = await getWalletKit();

      expect(instance1).toBe(instance2);
    });

    it('should throw error if project ID is not configured', async () => {
      vi.stubEnv('VITE_REOWN_PROJECT_ID', '');

      await expect(getWalletKit()).rejects.toThrow('Reown Project ID not configured');
    });
  });

  describe('Session Handlers', () => {
    it('should handle session proposal correctly', async () => {
      const mockWallet = {
        id: '123',
        address: '0x123',
        chain_id: 1,
        private_key: 'encrypted_key'
      };

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWallet })
      });

      const kit = await getWalletKit();
      const proposal = {
        id: '123',
        params: {
          proposer: {
            metadata: {
              walletId: '123'
            }
          }
        }
      };

      await kit.emit('session_proposal', proposal);

      expect(supabase.from).toHaveBeenCalledWith('wallets');
    });

    it('should handle session request signing', async () => {
      const mockWallet = {
        address: '0x123',
        private_key: 'encrypted_key'
      };

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWallet })
      });

      const kit = await getWalletKit();
      const request = {
        topic: '123',
        params: {
          request: {
            method: 'personal_sign',
            params: ['message']
          }
        },
        id: '123'
      };

      await kit.emit('session_request', request);

      expect(ethers.Wallet).toHaveBeenCalled();
    });
  });
});