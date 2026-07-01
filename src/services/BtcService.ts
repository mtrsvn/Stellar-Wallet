import { Network } from '../utils/networks';
import * as bitcoin from 'bitcoinjs-lib';
import { ethers } from 'ethers';

export class BtcService {
  static async getBalance(address: string, network: Network): Promise<string> {
    try {
      if (!address) return '0.0 BTC';
      const response = await fetch(`${network.rpcUrl}/address/${address}`);
      if (!response.ok) return '0.0 BTC'; // Fail silently if address has no txs or rate limited
      const data = await response.json();
      
      const satoshis = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
      const btc = satoshis / 1e8;
      
      return `${btc.toFixed(6)} BTC`;
    } catch (e) {
      return '0.0 BTC';
    }
  }

  static async sendTransaction(
    privateKeyHex: string,
    toAddress: string,
    amountStr: string,
    network: Network
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    try {
      // Custom Ethers-based Signer for bitcoinjs-lib
      const pk = privateKeyHex.startsWith('0x') ? privateKeyHex : '0x' + privateKeyHex;
      const signingKey = new ethers.SigningKey(pk);
      const compressedPubKey = ethers.computePublicKey(signingKey.publicKey, true);
      const pubkeyBuffer = Buffer.from(compressedPubKey.slice(2), 'hex');

      const signer = {
        publicKey: pubkeyBuffer,
        sign: (hash: Buffer) => {
          const sig = signingKey.sign(hash);
          return Buffer.concat([
            Buffer.from(sig.r.slice(2).padStart(64, '0'), 'hex'),
            Buffer.from(sig.s.slice(2).padStart(64, '0'), 'hex')
          ]);
        }
      };

      const btcNetwork = network.id.includes('testnet') ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
      const { address: fromAddress } = bitcoin.payments.p2wpkh({ pubkey: pubkeyBuffer, network: btcNetwork });
      if (!fromAddress) throw new Error("Invalid from address");

      // Fetch fees
      const feeRes = await fetch(`${network.rpcUrl}/v1/fees/recommended`);
      const feeData = await feeRes.json();
      const feeRate = feeData.fastestFee || 20;

      // Fetch UTXOs
      const utxoRes = await fetch(`${network.rpcUrl}/address/${fromAddress}/utxo`);
      if (!utxoRes.ok) throw new Error("Failed to fetch UTXOs");
      const utxos = await utxoRes.json();
      if (!utxos || utxos.length === 0) throw new Error("No UTXOs available");

      const psbt = new bitcoin.Psbt({ network: btcNetwork });
      const amountSats = Math.floor(parseFloat(amountStr) * 1e8);
      let inputSum = 0;

      for (const utxo of utxos) {
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: bitcoin.payments.p2wpkh({ pubkey: pubkeyBuffer, network: btcNetwork }).output!,
            value: utxo.value
          }
        });
        inputSum += utxo.value;
        if (inputSum >= amountSats + (feeRate * 250)) break;
      }

      const estimatedVBytes = (psbt.txInputs.length * 68) + (2 * 31) + 10;
      const fee = estimatedVBytes * feeRate;

      if (inputSum < amountSats + fee) {
        throw new Error(`Insufficient BTC. Need ${((amountSats + fee) / 1e8).toFixed(6)} BTC for amount + fee`);
      }

      psbt.addOutput({ address: toAddress, value: amountSats });

      const change = inputSum - amountSats - fee;
      if (change > 546) { // Dust limit
        psbt.addOutput({ address: fromAddress, value: change });
      }

      psbt.signAllInputs(signer);
      psbt.finalizeAllInputs();
      const txHex = psbt.extractTransaction().toHex();

      const broadcastRes = await fetch(`${network.rpcUrl}/tx`, {
        method: 'POST',
        body: txHex,
      });

      if (!broadcastRes.ok) {
        const errText = await broadcastRes.text();
        throw new Error(`Broadcast failed: ${errText}`);
      }
      
      const txId = await broadcastRes.text();
      return { success: true, hash: txId };
    } catch (e: any) {
      return { success: false, error: e.message || 'BTC transaction failed' };
    }
  }

  static async getTransactions(address: string, network: Network): Promise<any[]> {
    try {
      if (!address) return [];
      const response = await fetch(`${network.rpcUrl}/address/${address}/txs`);
      if (!response.ok) return []; // Fail silently if address has no txs or rate limited
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
      return [];
    }
  }
}
