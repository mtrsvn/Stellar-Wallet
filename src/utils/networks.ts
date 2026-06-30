export type NetworkType = 'EVM' | 'BTC' | 'SOL';

export interface Network {
  id: string;
  name: string;
  type: NetworkType;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  symbol: string;
  isTestnet: boolean;
  coingeckoId: string;
  color: string;
}

export const SUPPORTED_NETWORKS: Network[] = [
  {
    id: 'ethereum-mainnet',
    name: 'Ethereum',
    type: 'EVM',
    chainId: 1,
    rpcUrl: 'https://eth.public-rpc.com',
    explorerUrl: 'https://etherscan.io',
    symbol: 'ETH',
    isTestnet: false,
    coingeckoId: 'ethereum',
    color: '#627EEA'
  },
  {
    id: 'bnb-mainnet',
    name: 'BEP Chain',
    type: 'EVM',
    chainId: 56,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorerUrl: 'https://bscscan.com',
    symbol: 'BNB',
    isTestnet: false,
    coingeckoId: 'binancecoin',
    color: '#F3BA2F'
  },
  {
    id: 'bitcoin-mainnet',
    name: 'Bitcoin',
    type: 'BTC',
    chainId: 0, // N/A for BTC
    rpcUrl: 'https://mempool.space/api',
    explorerUrl: 'https://mempool.space',
    symbol: 'BTC',
    isTestnet: false,
    coingeckoId: 'bitcoin',
    color: '#F7931A'
  },
  {
    id: 'solana-mainnet',
    name: 'Solana',
    type: 'SOL',
    chainId: 101, // mainnet-beta
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://solscan.io',
    symbol: 'SOL',
    isTestnet: false,
    coingeckoId: 'solana',
    color: '#14F195'
  }
];

export const getNetworksByMode = (isTestnet: boolean) => {
  return SUPPORTED_NETWORKS.filter(n => n.isTestnet === isTestnet);
};

export const getNetworkById = (id: string) => {
  return SUPPORTED_NETWORKS.find(n => n.id === id);
};
