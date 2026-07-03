import { ethers } from "ethers";
import { Network } from "../utils/networks";
import { SUPPORTED_TOKENS } from "../utils/tokens";

export class PriceService {
  static fallbackPrices: Record<string, number> = {
    'ethereum': 3500,
    'matic-network': 0.70
  };

  static async fetchPrices(coinIds: string[]): Promise<Record<string, number>> {
    if (coinIds.length === 0) return {};
    try {
      const ids = [...new Set(coinIds)].join(',');
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      const data = await res.json();
      
      const prices: Record<string, number> = {};
      coinIds.forEach(id => {
        prices[id] = data?.[id]?.usd || this.fallbackPrices[id] || 0;
      });
      return prices;
    } catch {
      const prices: Record<string, number> = {};
      coinIds.forEach(id => {
        prices[id] = this.fallbackPrices[id] || 0;
      });
      return prices;
    }
  }

  static normalizeTokenSymbol(symbol: string) {
    return this.normalizeSymbol(symbol);
  }

  static async fetchTokenPrices(network: Network, tokenAddresses: string[]): Promise<Record<string, number>> {
    const normalizeAddress = (address: string) =>
      network.type === 'SOL' ? address : address.toLowerCase();
    const uniqueAddresses = [...new Set(tokenAddresses.filter(Boolean).map(normalizeAddress))];
    if (uniqueAddresses.length === 0) return {};

    const platformId = this.getCoinGeckoPlatformId(network);
    if (!platformId) return {};

    try {
      const addresses = uniqueAddresses.join(',');
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/token_price/${platformId}?contract_addresses=${addresses}&vs_currencies=usd`
      );
      const data = await res.json();

      const prices: Record<string, number> = {};
      uniqueAddresses.forEach(address => {
        prices[normalizeAddress(address)] = Number(data?.[address]?.usd) || 0;
      });
      return prices;
    } catch {
      return {};
    }
  }

  static async fetchCoinGeckoTokenData(network: Network, tokenAddresses: string[]): Promise<Record<string, { price: number; logoUrl: string }>> {
    const platformId = this.getCoinGeckoPlatformId(network);
    if (!platformId) return {};

    const normalizeAddress = (address: string) =>
      network.type === 'SOL' ? address : address.toLowerCase();
    const uniqueAddresses = [...new Set(tokenAddresses.filter(Boolean).map(normalizeAddress))].slice(0, 10);
    if (uniqueAddresses.length === 0) return {};

    const data: Record<string, { price: number; logoUrl: string }> = {};

    await Promise.all(
      uniqueAddresses.map(async (address) => {
        try {
          const res = await fetch(`https://api.coingecko.com/api/v3/coins/${platformId}/contract/${address}`);
          if (!res.ok) return;

          const token = await res.json();
          data[address] = {
            price: Number(token?.market_data?.current_price?.usd) || 0,
            logoUrl: String(token?.image?.small || token?.image?.thumb || token?.image?.large || ''),
          };
        } catch {}
      })
    );

    return data;
  }

  static async fetchCoinGeckoSymbolData(symbols: string[]): Promise<Record<string, { price: number; logoUrl: string; coingeckoId: string }>> {
    const uniqueSymbols = [...new Set(symbols.map(symbol => this.normalizeSymbol(symbol)).filter(Boolean))].slice(0, 25);
    const data: Record<string, { price: number; logoUrl: string; coingeckoId: string }> = {};

    await Promise.all(
      uniqueSymbols.map(async (symbol) => {
        try {
          const searchRes = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`);
          if (!searchRes.ok) return;
          const search = await searchRes.json();
          const exactMatches = (search?.coins || []).filter(
            (coin: any) => String(coin?.symbol || '').toUpperCase() === symbol
          );
          const match = exactMatches.sort((a: any, b: any) => {
            const rankA = Number(a?.market_cap_rank) || Number.MAX_SAFE_INTEGER;
            const rankB = Number(b?.market_cap_rank) || Number.MAX_SAFE_INTEGER;
            return rankA - rankB;
          })[0];
          if (!match?.id) return;

          const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${match.id}&vs_currencies=usd`);
          if (!priceRes.ok) return;
          const priceJson = await priceRes.json();

          data[symbol] = {
            coingeckoId: String(match.id),
            price: Number(priceJson?.[match.id]?.usd) || 0,
            logoUrl: String(match?.large || match?.thumb || ''),
          };
        } catch {}
      })
    );

    return data;
  }

  static async fetchDexScreenerTokenData(network: Network, tokenAddresses: string[]): Promise<Record<string, { price: number; logoUrl: string }>> {
    const chainId = this.getDexScreenerChainId(network);
    if (!chainId) return {};

    const normalizeAddress = (address: string) =>
      network.type === 'SOL' ? address : address.toLowerCase();
    const uniqueAddresses = [...new Set(tokenAddresses.filter(Boolean).map(normalizeAddress))].slice(0, 30);
    if (uniqueAddresses.length === 0) return {};

    try {
      const data: Record<string, { price: number; logoUrl: string }> = {};

      await Promise.all(
        uniqueAddresses.map(async (address) => {
          const res = await fetch(`https://api.dexscreener.com/token-pairs/v1/${chainId}/${address}`).catch(() => null);
          if (!res?.ok) return;

          const pairs = await res.json();
          if (!Array.isArray(pairs)) return;

          let bestPair: any = null;
          let bestPrice = 0;
          for (const pair of pairs) {
            const baseAddress = pair?.baseToken?.address;
            const quoteAddress = pair?.quoteToken?.address;
            const isBaseToken = normalizeAddress(String(baseAddress || '')) === address;
            const isQuoteToken = normalizeAddress(String(quoteAddress || '')) === address;
            if (!isBaseToken && !isQuoteToken) continue;

            const liquidity = Number(pair?.liquidity?.usd) || 0;
            const bestLiquidity = Number(bestPair?.liquidity?.usd) || 0;
            if (!bestPair || liquidity > bestLiquidity) {
              bestPair = pair;
              const basePriceUsd = Number(pair?.priceUsd) || 0;
              const basePerQuote = Number(pair?.priceNative) || 0;
              bestPrice = isBaseToken
                ? basePriceUsd
                : basePerQuote > 0
                  ? basePriceUsd / basePerQuote
                  : 0;
            }
          }

          if (!bestPair) return;

          data[address] = {
            price: bestPrice,
            logoUrl: String(bestPair?.info?.imageUrl || ''),
          };
        })
      );

      return data;
    } catch {
      return {};
    }
  }

  static getTokenLogoUrl(network: Network, tokenAddress: string) {
    if (!tokenAddress) return '';
    const evmAddress = network.type === 'EVM' ? this.toChecksumAddress(tokenAddress) : tokenAddress;
    if (network.id === 'ethereum-mainnet') {
      return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${evmAddress}/logo.png`;
    }
    if (network.id === 'bnb-mainnet') {
      return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/${evmAddress}/logo.png`;
    }
    if (network.id === 'solana-mainnet' || network.id === 'solana-devnet') {
      return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/${tokenAddress}/logo.png`;
    }
    return '';
  }

  static getMainnetEquivalentToken(symbol: string, network: Network) {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    const networkFamily = this.getNetworkFamily(network);
    const equivalentNetworkId = this.getMainnetNetworkId(networkFamily);
    const featuredMatch = SUPPORTED_TOKENS.find(token =>
      token.networkId === equivalentNetworkId &&
      this.normalizeSymbol(token.symbol) === normalizedSymbol &&
      token.coingeckoId
    );

    if (featuredMatch) {
      return {
        coingeckoId: featuredMatch.coingeckoId,
        logoUrl: featuredMatch.logoUrl || this.getTokenLogoUrl({ ...network, id: equivalentNetworkId } as Network, featuredMatch.address),
        address: featuredMatch.address,
      };
    }

    const equivalents: Record<string, Record<string, { coingeckoId: string; logoUrl: string; address: string }>> = {
      ethereum: {
        USDC: {
          coingeckoId: 'usd-coin',
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          logoUrl: this.getTokenLogoUrl({ ...network, id: 'ethereum-mainnet', type: 'EVM' }, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
        },
        USDT: {
          coingeckoId: 'tether',
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          logoUrl: this.getTokenLogoUrl({ ...network, id: 'ethereum-mainnet', type: 'EVM' }, '0xdAC17F958D2ee523a2206206994597C13D831ec7'),
        },
        LINK: {
          coingeckoId: 'chainlink',
          address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
          logoUrl: this.getTokenLogoUrl({ ...network, id: 'ethereum-mainnet', type: 'EVM' }, '0x514910771AF9Ca656af840dff83E8264EcF986CA'),
        },
        DAI: {
          coingeckoId: 'dai',
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          logoUrl: this.getTokenLogoUrl({ ...network, id: 'ethereum-mainnet', type: 'EVM' }, '0x6B175474E89094C44Da98b954EedeAC495271d0F'),
        },
      },
      bnb: {
        USDT: {
          coingeckoId: 'tether',
          address: '0x55d398326f99059fF775485246999027B3197955',
          logoUrl: this.getTokenLogoUrl({ ...network, id: 'bnb-mainnet', type: 'EVM' }, '0x55d398326f99059fF775485246999027B3197955'),
        },
        BUSD: {
          coingeckoId: 'binance-usd',
          address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
          logoUrl: this.getTokenLogoUrl({ ...network, id: 'bnb-mainnet', type: 'EVM' }, '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'),
        },
        CAKE: {
          coingeckoId: 'pancakeswap-token',
          address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
          logoUrl: this.getTokenLogoUrl({ ...network, id: 'bnb-mainnet', type: 'EVM' }, '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82'),
        },
      },
      solana: {
        USDC: {
          coingeckoId: 'usd-coin',
          address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          logoUrl: this.getTokenLogoUrl({ ...network, id: 'solana-mainnet', type: 'SOL' }, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
        },
        USDT: {
          coingeckoId: 'tether',
          address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
          logoUrl: this.getTokenLogoUrl({ ...network, id: 'solana-mainnet', type: 'SOL' }, 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
        },
      },
    };

    return equivalents[networkFamily]?.[normalizedSymbol] || null;
  }

  private static getCoinGeckoPlatformId(network: Network) {
    if (network.id === 'ethereum-mainnet') return 'ethereum';
    if (network.id === 'bnb-mainnet') return 'binance-smart-chain';
    if (network.id === 'solana-mainnet') return 'solana';
    return '';
  }

  private static getDexScreenerChainId(network: Network) {
    if (network.id === 'ethereum-mainnet') return 'ethereum';
    if (network.id === 'bnb-mainnet') return 'bsc';
    if (network.id === 'solana-mainnet') return 'solana';
    return '';
  }

  private static getNetworkFamily(network: Network) {
    if (network.id.includes('ethereum')) return 'ethereum';
    if (network.id.includes('bnb')) return 'bnb';
    if (network.id.includes('solana')) return 'solana';
    return '';
  }

  private static getMainnetNetworkId(networkFamily: string) {
    if (networkFamily === 'ethereum') return 'ethereum-mainnet';
    if (networkFamily === 'bnb') return 'bnb-mainnet';
    if (networkFamily === 'solana') return 'solana-mainnet';
    return '';
  }

  private static normalizeSymbol(symbol: string) {
    const normalized = symbol.toUpperCase().trim();
    const prefixedTestSymbols = ['USDC', 'USDT', 'DAI', 'BUSD', 'LINK', 'UNI', 'CAKE', 'WETH', 'WBTC', 'WSOL', 'BNB', 'BTC', 'ETH', 'SOL'];

    for (const prefix of ['T', 'TEST', 'M', 'MOCK']) {
      if (!normalized.startsWith(prefix)) continue;
      const withoutPrefix = normalized.slice(prefix.length);
      if (prefixedTestSymbols.includes(withoutPrefix)) {
        return withoutPrefix;
      }
    }

    return normalized;
  }

  private static toChecksumAddress(address: string) {
    try {
      return ethers.getAddress(address);
    } catch {
      return address;
    }
  }
}
