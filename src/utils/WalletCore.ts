import { ethers } from 'ethers';
import 'react-native-get-random-values';

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

  static deriveAddresses(mnemonic: string, count: number = 1): string[] {
    const addresses: string[] = [];
    for (let i = 0; i < count; i++) {
      const path = `m/44'/60'/0'/0/${i}`;
      const wallet = ethers.HDNodeWallet.fromMnemonic(
        ethers.Mnemonic.fromPhrase(mnemonic),
        path
      );
      addresses.push(wallet.address);
    }
    return addresses;
  }

  static getPrivateKey(mnemonic: string, index: number = 0): string {
    const path = `m/44'/60'/0'/0/${index}`;
    const wallet = ethers.HDNodeWallet.fromMnemonic(
      ethers.Mnemonic.fromPhrase(mnemonic),
      path
    );
    return wallet.privateKey;
  }
}
