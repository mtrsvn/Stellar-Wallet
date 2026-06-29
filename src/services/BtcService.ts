import { Network } from '../utils/networks';

export class BtcService {
  static async getBalance(address: string, network: Network): Promise<string> {
    try {
      if (!address) return '0.0 BTC';
      // Mempool.space API
      const response = await fetch(`${network.rpcUrl}/address/${address}`);
      if (!response.ok) throw new Error('Failed to fetch BTC balance');
      const data = await response.json();
      
      const satoshis = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
      const btc = satoshis / 1e8;
      
      return `${btc.toFixed(6)} BTC`;
    } catch (e) {
      console.error('BtcService getBalance Error:', e);
      return '0.0 BTC';
    }
  }

  static async getTransactions(address: string, network: Network): Promise<any[]> {
    try {
      if (!address) return [];
      // Mempool.space API
      const response = await fetch(`${network.rpcUrl}/address/${address}/txs`);
      if (!response.ok) throw new Error('Failed to fetch BTC txs');
      const txs = await response.json();
      
      return txs.slice(0, 10).map((tx: any) => {
        const isReceived = tx.vout.some((out: any) => out.scriptpubkey_address === address);
        const isSent = tx.vin.some((input: any) => input.prevout.scriptpubkey_address === address);
        
        let title = 'BTC Transaction';
        let icon = 'HelpCircle';
        if (isReceived && !isSent) { title = 'Received BTC'; icon = 'ArrowDownLeft'; }
        if (isSent) { title = 'Sent BTC'; icon = 'ArrowUpRight'; }
        
        return {
          title,
          subtitle: `Fee: ${tx.fee} sats`,
          date: tx.status.block_time ? new Date(tx.status.block_time * 1000).toLocaleDateString() : 'Unconfirmed',
          dateTime: tx.status.block_time ? new Date(tx.status.block_time * 1000).toISOString() : new Date().toISOString(),
          amount: 'N/A',
          delta: '0',
          amountColor: 'white',
          icon,
          from: 'Bitcoin Network',
          hash: tx.txid
        };
      });
    } catch (e) {
      console.error('BtcService getTransactions Error:', e);
      return [];
    }
  }
}
