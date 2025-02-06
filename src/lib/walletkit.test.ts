import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WalletKit } from '@reown/walletkit';
import { getWalletKit, setCurrentWalletId, setAutoMint, pair } from './walletkit';
import { supabase } from './supabase';
import { ethers } from 'ethers';
import { networks } from './networks';

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
      getRandomValues: (buffer: Uint8Array) => buffer
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getWalletKit', () => {
    it('should initialize WalletKit with correct configuration', async () => {
      const mockInit = vi.fn().mockResolvedValue({
        on: vi.fn(),
        pair: vi.fn()
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
        private_key: 'encrypted_key',
        network: 'ethereum'
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
        private_key: 'encrypted_key',
        network: 'ethereum'
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

    it('should handle chain switching correctly', async () => {
      const mockWallet = {
        address: '0x123',
        private_key: 'encrypted_key',
        network: 'ethereum'
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
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x1' }]
          }
        },
        id: '123'
      };

      await kit.emit('session_request', request);

      // Should allow switching to supported networks
      expect(kit.respondSessionRequest).toHaveBeenCalledWith({
        topic: '123',
        response: {
          id: 123,
          jsonrpc: '2.0',
          result: null
        }
      });
    });

    it('should reject unsupported chains', async () => {
      const mockWallet = {
        address: '0x123',
        private_key: 'encrypted_key',
        network: 'ethereum'
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
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x9999999' }]
          }
        },
        id: '123'
      };

      await kit.emit('session_request', request);

      expect(kit.respondSessionRequest).toHaveBeenCalledWith({
        topic: '123',
        response: {
          id: 123,
          jsonrpc: '2.0',
          error: {
            code: 4001,
            message: 'Chain ID 0x9999999 is not supported'
          }
        }
      });
    });
  });

  describe('Auto-Signing', () => {
    it('should auto-sign when enabled', async () => {
      const mockWallet = {
        address: '0x123',
        private_key: 'encrypted_key',
        network: 'ethereum'
      };

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWallet })
      });

      setAutoMint(true);
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

      // Should not emit request event for UI
      expect(window.dispatchEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'reown:request'
        })
      );
    });

    it('should wait for user approval when auto-sign disabled', async () => {
      const mockWallet = {
        address: '0x123',
        private_key: 'encrypted_key',
        network: 'ethereum'
      };

      vi.spyOn(supabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWallet })
      });

      setAutoMint(false);
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

      // Should emit request event for UI
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'reown:request'
        })
      );
    });
  });

  describe('Pairing', () => {
    it('should handle WalletConnect URIs', async () => {
      const uri = 'wc:123@2?relay-protocol=irn&symKey=abc';
      const walletId = '123';

      await pair(uri, walletId);

      expect(WalletKit.prototype.pair).toHaveBeenCalledWith({
        uri: uri.replace('wc:', 'reown:'),
        metadata: expect.any(Object)
      });
    });

    it('should handle Reown URIs', async () => {
      const uri = 'reown:123@2?relay-protocol=irn&symKey=abc';
      const walletId = '123';

      await pair(uri, walletId);

      expect(WalletKit.prototype.pair).toHaveBeenCalledWith({
        uri,
        metadata: expect.any(Object)
      });
    });

    it('should validate URI format', async () => {
      const uri = 'invalid:123';
      const walletId = '123';

      await expect(pair(uri, walletId)).rejects.toThrow('Invalid URI format');
    });
  });
});