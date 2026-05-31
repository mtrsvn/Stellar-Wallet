export class PriceService {
  static fallbackEthUsd = 3500;

  static async fetchEthUsd(): Promise<number> {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const data = await res.json();
      return data?.ethereum?.usd || this.fallbackEthUsd;
    } catch {
      return this.fallbackEthUsd;
    }
  }
}
