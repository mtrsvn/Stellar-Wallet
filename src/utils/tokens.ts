export interface Token {
  id: string;
  networkId: string;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoUrl: string;
  coingeckoId: string;
}

export const SUPPORTED_TOKENS: Token[] = [
  // Ethereum Mainnet Tokens
  {
    id: 'eth-usdc',
    networkId: 'ethereum-mainnet',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    coingeckoId: 'usd-coin'
  },
  {
    id: 'eth-usdt',
    networkId: 'ethereum-mainnet',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
    coingeckoId: 'tether'
  },
  {
    id: 'eth-link',
    networkId: 'ethereum-mainnet',
    address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    name: 'Chainlink',
    symbol: 'LINK',
    decimals: 18,
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png',
    coingeckoId: 'chainlink'
  },
  
  // BNB Chain Tokens
  {
    id: 'bnb-usdt',
    networkId: 'bnb-mainnet',
    address: '0x55d398326f99059fF775485246999027B3197955',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 18,
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0x55d398326f99059fF775485246999027B3197955/logo.png',
    coingeckoId: 'tether'
  },
  {
    id: 'bnb-cake',
    networkId: 'bnb-mainnet',
    address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
    name: 'PancakeSwap',
    symbol: 'CAKE',
    decimals: 18,
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82/logo.png',
    coingeckoId: 'pancakeswap-token'
  },

  // Solana Tokens
  {
    id: 'sol-usdc',
    networkId: 'solana-mainnet',
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    coingeckoId: 'usd-coin'
  },
  {
    id: 'sol-usdt',
    networkId: 'solana-mainnet',
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    name: 'USDT',
    symbol: 'USDT',
    decimals: 6,
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
    coingeckoId: 'tether'
  }
];

export const getTokensByNetworkId = (networkId: string) => {
  return SUPPORTED_TOKENS.filter(t => t.networkId === networkId);
};
