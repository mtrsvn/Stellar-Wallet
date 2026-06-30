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
  {
    id: 'eth-uni',
    networkId: 'ethereum-mainnet',
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    name: 'Uniswap',
    symbol: 'UNI',
    decimals: 18,
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png',
    coingeckoId: 'uniswap'
  },
  {
    id: 'eth-aave',
    networkId: 'ethereum-mainnet',
    address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    name: 'Aave',
    symbol: 'AAVE',
    decimals: 18,
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9/logo.png',
    coingeckoId: 'aave'
  },
  {
    id: 'eth-dai',
    networkId: 'ethereum-mainnet',
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    name: 'Dai',
    symbol: 'DAI',
    decimals: 18,
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
    coingeckoId: 'dai'
  },
  {
    id: 'eth-shib',
    networkId: 'ethereum-mainnet',
    address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
    name: 'Shiba Inu',
    symbol: 'SHIB',
    decimals: 18,
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE/logo.png',
    coingeckoId: 'shiba-inu'
  },
  {
    id: 'eth-pepe',
    networkId: 'ethereum-mainnet',
    address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
    name: 'Pepe',
    symbol: 'PEPE',
    decimals: 18,
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6982508145454Ce325dDbE47a25d4ec3d2311933/logo.png',
    coingeckoId: 'pepe'
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
  {
    id: 'bnb-xrp',
    networkId: 'bnb-mainnet',
    address: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE',
    name: 'XRP',
    symbol: 'XRP',
    decimals: 18,
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE/logo.png',
    coingeckoId: 'ripple'
  },
  {
    id: 'bnb-doge',
    networkId: 'bnb-mainnet',
    address: '0xbA2aE424d960c26247Dd6C32edC70B295c744C43',
    name: 'Dogecoin',
    symbol: 'DOGE',
    decimals: 8,
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0xbA2aE424d960c26247Dd6C32edC70B295c744C43/logo.png',
    coingeckoId: 'dogecoin'
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
