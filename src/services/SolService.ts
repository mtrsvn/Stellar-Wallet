import { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { Network } from '../utils/networks';
import bs58 from 'bs58';

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

  static async discoverTokens(address: string, network: Network): Promise<Array<{
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    balance: number;
  }>> {
    try {
      if (!address) return [];
      const connection = new Connection(network.rpcUrl, 'confirmed');
      const ownerPubKey = new PublicKey(address);
      const tokenProgramId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const response = await connection.getParsedTokenAccountsByOwner(ownerPubKey, {
        programId: tokenProgramId,
      });

      return response.value
        .map((account) => {
          const info = account.account.data.parsed.info;
          const mint = String(info.mint || '');
          const balance = info.tokenAmount?.uiAmount || 0;
          const decimals = Number(info.tokenAmount?.decimals || 0);
          const shortMint = mint ? `${mint.slice(0, 4)}...${mint.slice(-4)}` : 'SPL';

          return {
            address: mint,
            name: `SPL ${shortMint}`,
            symbol: 'SPL',
            decimals,
            balance,
          };
        })
        .filter((token) => token.address && token.balance > 0)
        .slice(0, 25);
    } catch (e) {
      console.error('SolService discoverTokens Error:', e);
      return [];
    }
  }

  static async sendTransaction(
    privateKey: string,
    toAddress: string,
    amountStr: string,
    network: Network
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    try {
      const connection = new Connection(network.rpcUrl, 'confirmed');
      const secretKey = bs58.decode(privateKey);
      const keypair = Keypair.fromSecretKey(secretKey);
      const toPublicKey = new PublicKey(toAddress);

      const lamports = Math.floor(parseFloat(amountStr) * 1e9);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: toPublicKey,
          lamports: lamports,
        })
      );

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [keypair]
      );

      return { success: true, hash: signature };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Solana transaction failed',
      };
    }
  }

  static async getTransactions(address: string, network: Network): Promise<any[]> {
    try {
      if (!address) return [];
      const connection = new Connection(network.rpcUrl, 'confirmed');
      const pubKey = new PublicKey(address);
      
      const sigs = await connection.getSignaturesForAddress(pubKey, { limit: 10 });
      if (sigs.length === 0) return [];
      
      const txs = await connection.getParsedTransactions(sigs.map(s => s.signature), { maxSupportedTransactionVersion: 0 });
      
      return sigs.map((sig, index) => {
        const parsedTx = txs[index];
        let amountStr = 'N/A';
        let delta = '0';
        let symbol = 'SOL';
        let isToken = false;
        
        if (parsedTx && !sig.err) {
          const preTokenBalances = parsedTx.meta?.preTokenBalances || [];
          const postTokenBalances = parsedTx.meta?.postTokenBalances || [];
          
          const preToken = preTokenBalances.find(b => b.owner === address);
          const postToken = postTokenBalances.find(b => b.owner === address);
          
          if (preToken || postToken) {
            const preAmt = preToken?.uiTokenAmount?.uiAmount || 0;
            const postAmt = postToken?.uiTokenAmount?.uiAmount || 0;
            const diff = postAmt - preAmt;
            
            if (diff !== 0) {
              isToken = true;
              delta = diff > 0 ? '+' : '-';
              amountStr = `${Math.abs(diff).toFixed(4)}`;
              // Very basic symbol detection based on popular testnet mints
              const mint = (postToken?.mint || preToken?.mint || '').toString();
              if (mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') symbol = 'USDT';
              else if (mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') symbol = 'USDC';
              else if (mint === '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU') symbol = 'USDC';
              else symbol = 'SPL';
              
              amountStr += ` ${symbol}`;
            }
          }
          
          if (!isToken) {
            const preBalances = parsedTx.meta?.preBalances || [];
            const postBalances = parsedTx.meta?.postBalances || [];
            const accountKeys = parsedTx.transaction.message.accountKeys;
            
            const accountIndex = accountKeys.findIndex(k => {
              const pk = typeof k.pubkey === 'string' ? k.pubkey : (k.pubkey?.toBase58 ? k.pubkey.toBase58() : k.pubkey?.toString());
              return pk === address;
            });

            if (accountIndex !== -1 && preBalances[accountIndex] !== undefined && postBalances[accountIndex] !== undefined) {
              const diff = postBalances[accountIndex] - preBalances[accountIndex];
              // Ignore exact fee deduction for SOL if it's just a fee (-5000 lamports)
              if (diff !== 0 && diff !== -5000) {
                delta = diff > 0 ? '+' : '-';
                amountStr = `${(Math.abs(diff) / 1e9).toFixed(4)} SOL`;
              }
            }
          }
        }

        let title = `Solana Transaction`;
        if (sig.err) title = 'Failed Transaction';
        else if (delta === '+') title = `Received ${symbol}`;
        else if (delta === '-') title = `Sent ${symbol}`;
        else if (amountStr === 'N/A') title = 'Contract Interaction';
        
        return {
          title,
          subtitle: `Slot: ${sig.slot}`,
          date: sig.blockTime ? new Date(sig.blockTime * 1000).toLocaleDateString() : 'Unknown Date',
          dateTime: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : new Date().toISOString(),
          amount: amountStr !== 'N/A' ? (delta === '+' ? `+${amountStr}` : `-${amountStr}`) : 'N/A',
          delta,
          amountColor: delta === '+' ? '#14F195' : 'white',
          icon: amountStr === 'N/A' ? 'HelpCircle' : delta === '+' ? 'ArrowDownLeft' : delta === '-' ? 'ArrowUpRight' : 'HelpCircle',
          from: 'Solana Network',
          hash: sig.signature
        };
      });
    } catch (e) {
      console.error('SolService getTransactions Error:', e);
      return [];
    }
  }
}
