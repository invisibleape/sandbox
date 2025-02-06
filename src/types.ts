export interface Wallet {
  id: string;
  address: string;
  status: 'created' | 'connected' | 'minting' | 'completed' | 'failed';
  createdAt: string;
  network?: string;
  tag?: string;
}

export interface MintStatus {
  total: number;
  success: number;
  failed: number;
  pending: number;
}

export interface WalletStats {
  totalWallets: number;
  connectedWallets: number;
  mintingWallets: number;
  completedWallets: number;
}

export interface Network {
  id: string;
  name: string;
  chainId: number;
  rpcUrl: string;
  logoUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  useEthereumWallet?: boolean; // Add this property to handle special chain ID cases
}