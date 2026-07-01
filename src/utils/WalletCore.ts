import { ethers } from 'ethers';
import 'react-native-get-random-values';
import nacl from 'tweetnacl';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;

import * as bitcoin from 'bitcoinjs-lib';

const HARDENED_OFFSET = 0x80000000;
const ED25519_CURVE = 'ed25519 seed';

function deriveSolanaSeed(seedHex: string, path: string): Buffer {
  let key = Buffer.from(seedHex, 'hex');
  
  let hmac = ethers.computeHmac(
    'sha512',
    Buffer.from(ED25519_CURVE, 'utf8'),
    key
  );
  let IL = Buffer.from(hmac.slice(2, 66), 'hex');
  let IR = Buffer.from(hmac.slice(66, 130), 'hex');
  
  const segments = path
    .split('/')
    .slice(1)
    .map((s) => s.replace("'", ''))
    .map((s) => parseInt(s, 10));
    
  for (const segment of segments) {
    const index = segment + HARDENED_OFFSET;
    
    const data = Buffer.allocUnsafe(37);
    data.writeUInt8(0x00, 0);
    IL.copy(data, 1);
    data.writeUInt32BE(index, 33);
    
    hmac = ethers.computeHmac('sha512', IR, data);
    IL = Buffer.from(hmac.slice(2, 66), 'hex');
    IR = Buffer.from(hmac.slice(66, 130), 'hex');
  }
  
  return IL;
}

export class WalletCore {
  static generateMnemonic(): string {
    return ethers.Wallet.createRandom().mnemonic?.phrase || '';
  }

  static validateMnemonic(mnemonic: string): boolean {
    try {
      ethers.Mnemonic.fromPhrase(mnemonic);
      return true;
    } catch {
      return false;
    }
  }

  static getEvmAddress(mnemonic: string, index: number = 0): string {
    const path = `m/44'/60'/0'/0/${index}`;
    const wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic), path);
    return wallet.address;
  }

  static getEvmPrivateKey(mnemonic: string, index: number = 0): string {
    const path = `m/44'/60'/0'/0/${index}`;
    const wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic), path);
    return wallet.privateKey;
  }

  static getBtcAddress(mnemonic: string, index: number = 0, isTestnet: boolean = false): string {
    try {
      const path = isTestnet ? `m/84'/1'/0'/0/${index}` : `m/84'/0'/0'/0/${index}`;
      const wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic), path);
      
      const pubkeyBuffer = Buffer.from(wallet.publicKey.slice(2), 'hex');
      const network = isTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
      const { address } = bitcoin.payments.p2wpkh({ pubkey: pubkeyBuffer, network });
      
      return address || '';
    } catch (e) {
      console.error('BTC derivation error:', e);
      return '';
    }
  }

  static getBtcPrivateKey(mnemonic: string, index: number = 0): string {
    try {
      const path = `m/84'/0'/0'/0/${index}`;
      const wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic), path);
      return wallet.privateKey;
    } catch (e) {
      console.error('BTC pk derivation error:', e);
      return '';
    }
  }

  static getSolanaAddress(mnemonic: string, index: number = 0): string {
    try {
      const seedHex = ethers.Mnemonic.fromPhrase(mnemonic).computeSeed().slice(2);
      const path = `m/44'/501'/${index}'/0'`;
      const derivedSeed = deriveSolanaSeed(seedHex, path);
      const keypair = nacl.sign.keyPair.fromSeed(derivedSeed);
      const solanaKeypair = Keypair.fromSecretKey(keypair.secretKey);
      return solanaKeypair.publicKey.toBase58();
    } catch (e) {
      console.error('Solana derivation error:', e);
      return '';
    }
  }

  static getSolanaPrivateKey(mnemonic: string, index: number = 0): string {
    try {
      const seedHex = ethers.Mnemonic.fromPhrase(mnemonic).computeSeed().slice(2);
      const path = `m/44'/501'/${index}'/0'`;
      const derivedSeed = deriveSolanaSeed(seedHex, path);
      const keypair = nacl.sign.keyPair.fromSeed(derivedSeed);
      return bs58.encode(keypair.secretKey);
    } catch (e) {
      console.error('Solana pk derivation error:', e);
      return '';
    }
  }
}
