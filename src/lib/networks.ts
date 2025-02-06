import { Network } from '../types';

export const networks: Network[] = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: 'https://eth.llamarpc.com',
    logoUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  {
    id: 'bnb',
    name: 'BNB Chain',
    chainId: 56,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    logoUrl: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
    explorerUrl: 'https://bscscan.com',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18
    }
  },
  {
    id: 'polygon',
    name: 'Polygon',
    chainId: 137,
    rpcUrl: 'https://polygon.llamarpc.com',
    logoUrl: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
    explorerUrl: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    }
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    chainId: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    logoUrl: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  {
    id: 'base',
    name: 'Base',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    logoUrl: 'https://www.base.org/_next/static/media/logo.f6fdedfc.svg',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  {
    id: 'avalanche',
    name: 'Avalanche',
    chainId: 43114,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    logoUrl: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
    explorerUrl: 'https://snowtrace.io',
    nativeCurrency: {
      name: 'AVAX',
      symbol: 'AVAX',
      decimals: 18
    }
  },
  {
    id: 'celo',
    name: 'Celo',
    chainId: 42220,
    rpcUrl: 'https://forno.celo.org',
    logoUrl: 'https://assets.coingecko.com/coins/images/11090/small/InjXBNx9_400x400.jpg',
    explorerUrl: 'https://celoscan.io',
    nativeCurrency: {
      name: 'CELO',
      symbol: 'CELO',
      decimals: 18
    }
  },
  {
    id: 'linea',
    name: 'Linea',
    chainId: 59144,
    rpcUrl: 'https://rpc.linea.build',
    logoUrl: 'https://linea.build/_next/static/media/logomark.1510dc60.svg',
    explorerUrl: 'https://lineascan.build',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  {
    id: 'blast',
    name: 'Blast',
    chainId: 81457,
    rpcUrl: 'https://rpc.blast.io',
    logoUrl: 'https://blastscan.io/assets/blast/images/svg/logos/chain-light.svg',
    explorerUrl: 'https://blastscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  {
    id: 'skale',
    name: 'SKALE Calypso',
    chainId: 1564830818,
    rpcUrl: 'https://mainnet.skalenodes.com/v1/honorable-steel-rasalhague',
    logoUrl: 'https://assets.coingecko.com/coins/images/13245/small/SKALE_token_300x300.png',
    explorerUrl: 'https://calypso.explorer.skale.network',
    nativeCurrency: {
      name: 'sFUEL',
      symbol: 'sFUEL',
      decimals: 18
    },
    useEthereumWallet: false // Explicitly set to false for SKALE
  }
];