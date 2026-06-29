import { Connection, PublicKey } from '@solana/web3.js';
import { Network } from '../utils/networks';

export class SolService {
  static async getBalance(address: string, network: Network): Promise<string> {
    try {
      if (!address) return '0.0 SOL';
      const connection = new Connection(network.rpcUrl, 'confirmed');
      const pubKey = new PublicKey(address);
      const balance = await connection.getBalance(pubKey);
      return `${(balance / 1e9).toFixed(4)} SOL`;
    } catch (e) {
      console.error('SolService getBalance Error:', e);
      return '0.0 SOL';
    }
  }

  static async getTokenBalance(address: string, tokenAddress: string, decimals: number, network: Network): Promise<string> {
    try {
      if (!address) return '0.000000';
      const connection = new Connection(network.rpcUrl, 'confirmed');
      const ownerPubKey = new PublicKey(address);
      const mintPubKey = new PublicKey(tokenAddress);
      
      const response = await connection.getParsedTokenAccountsByOwner(ownerPubKey, { mint: mintPubKey });
      if (response.value.length === 0) return '0.000000';
      
      let totalAmount = 0;
      for (const account of response.value) {
         totalAmount += account.account.data.parsed.info.tokenAmount.uiAmount || 0;
      }
      return totalAmount.toFixed(6);
    } catch (e) {
      console.error('SolService getTokenBalance Error:', e);
      return '0.000000';
    }
  }

  static async getTransactions(address: string, network: Network): Promise<any[]> {
    try {
      if (!address) return [];
      const connection = new Connection(network.rpcUrl, 'confirmed');
      const pubKey = new PublicKey(address);
      
      const sigs = await connection.getSignaturesForAddress(pubKey, { limit: 10 });
      
      return sigs.map(sig => ({
        title: sig.err ? 'Failed Transaction' : 'Solana Transaction',
        subtitle: `Slot: ${sig.slot}`,
        date: sig.blockTime ? new Date(sig.blockTime * 1000).toLocaleDateString() : 'Unknown Date',
        dateTime: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : new Date().toISOString(),
        amount: 'N/A',
        delta: '0',
        amountColor: 'white',
        icon: 'HelpCircle',
        from: 'Solana Network',
        hash: sig.signature
      }));
    } catch (e) {
      console.error('SolService getTransactions Error:', e);
      return [];
    }
  }
}
