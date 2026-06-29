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
}
