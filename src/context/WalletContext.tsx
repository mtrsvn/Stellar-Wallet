import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { WalletCore } from '../utils/WalletCore';
import { EthService } from '../services/EthService';

export interface SavedWallet {
  id: string;
  name: string;
  mnemonic: string;
  address: string;
}

interface Transaction {
  title: string;
  date: string;
  dateTime?: string;
  subtitle?: string;
  amount: string;
  delta: string;
  amountColor: string;
  icon: string;
  from: string;
}

interface WalletContextType {
  isLoading: boolean;
  isCreated: boolean;
  savedWallets: SavedWallet[];
  activeWalletId: string | null;
  address: string;
  balance: string;
  transactions: Transaction[];
  isBalanceLoading: boolean;
  isTransactionsLoading: boolean;
  savePasswordLocally: (password: string) => Promise<void>;
  verifyPassword: (password: string) => Promise<boolean>;
  markCreated: () => Promise<void>;
  loadAccounts: () => Promise<void>;
  refreshData: () => Promise<void>;
  logout: () => Promise<void>;
  removeActiveWallet: () => Promise<boolean>;
  renameActiveWallet: (newName: string) => Promise<void>;
  addNewWallet: (mnemonic: string, name?: string) => Promise<void>;
  switchWallet: (id: string) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isCreated, setIsCreated] = useState(false);
  const [savedWallets, setSavedWallets] = useState<SavedWallet[]>([]);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);
  
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);

  useEffect(() => {
    initWallet();
  }, []);

  const initWallet = async () => {
    try {
      const created = await SecureStore.getItemAsync('wallet_created');
      setIsCreated(created === 'true');
      
      let wallets: SavedWallet[] = [];
      const storedWalletsStr = await SecureStore.getItemAsync('saved_wallets');
      if (storedWalletsStr) {
        wallets = JSON.parse(storedWalletsStr);
      } else {
        // Migration from old version
        const oldSeed = await SecureStore.getItemAsync('seed_phrase');
        if (oldSeed) {
          const oldAddress = WalletCore.deriveAddresses(oldSeed, 1)[0];
          wallets = [{ id: '1', name: 'Wallet 1', mnemonic: oldSeed, address: oldAddress }];
          await SecureStore.setItemAsync('saved_wallets', JSON.stringify(wallets));
        }
      }
      
      setSavedWallets(wallets);
      
      if (created === 'true' && wallets.length > 0) {
        const activeId = await SecureStore.getItemAsync('active_wallet_id') || wallets[0].id;
        setActiveWalletId(activeId);
        const activeWallet = wallets.find(w => w.id === activeId) || wallets[0];
        setAddress(activeWallet.address);
        await loadWalletData(activeWallet.address);
      }
    } catch (e) {
      console.error('initWallet error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAccounts = async () => {
    // Left for compatibility during initialization
  };

  const loadWalletData = async (addr: string) => {
    fetchBalance(addr);
    fetchTransactions(addr);
  };

  const fetchBalance = async (addr: string) => {
    setIsBalanceLoading(true);
    try {
      const bal = await EthService.getBalance(addr);
      setBalance(bal);
    } catch (e) {
      setBalance('0.000000 ETH');
    } finally {
      setIsBalanceLoading(false);
    }
  };

  const fetchTransactions = async (addr: string) => {
    setIsTransactionsLoading(true);
    try {
      const txs = await EthService.getTransactions(addr);
      setTransactions(txs);
    } catch (e) {
      setTransactions([]);
    } finally {
      setIsTransactionsLoading(false);
    }
  };

  const addNewWallet = async (mnemonic: string, name?: string) => {
    const newAddress = WalletCore.deriveAddresses(mnemonic, 1)[0];
    const newId = Date.now().toString();
    const newWallet: SavedWallet = {
      id: newId,
      name: name || `Wallet ${savedWallets.length + 1}`,
      mnemonic,
      address: newAddress,
    };
    
    const newWallets = [...savedWallets, newWallet];
    await SecureStore.setItemAsync('saved_wallets', JSON.stringify(newWallets));
    setSavedWallets(newWallets);
    
    await SecureStore.setItemAsync('active_wallet_id', newId);
    setActiveWalletId(newId);
    setAddress(newWallet.address);
    await loadWalletData(newWallet.address);
  };

  const switchWallet = async (id: string) => {
    const wallet = savedWallets.find(w => w.id === id);
    if (!wallet) return;
    
    await SecureStore.setItemAsync('active_wallet_id', id);
    setActiveWalletId(id);
    setAddress(wallet.address);
    await loadWalletData(wallet.address);
  };

  const savePasswordLocally = async (password: string) => {
    await SecureStore.setItemAsync('wallet_password', password);
  };

  const verifyPassword = async (password: string): Promise<boolean> => {
    const stored = await SecureStore.getItemAsync('wallet_password');
    return stored === password;
  };

  const markCreated = async () => {
    await SecureStore.setItemAsync('wallet_created', 'true');
    setIsCreated(true);
  };

  const refreshData = async () => {
    if (address) {
      await fetchBalance(address);
      await fetchTransactions(address);
    }
  };

  const renameActiveWallet = async (newName: string) => {
    if (!activeWalletId) return;
    const newWallets = savedWallets.map(w => w.id === activeWalletId ? { ...w, name: newName } : w);
    await SecureStore.setItemAsync('saved_wallets', JSON.stringify(newWallets));
    setSavedWallets(newWallets);
  };

  const removeActiveWallet = async (): Promise<boolean> => {
    if (!activeWalletId) return false;
    
    const newWallets = savedWallets.filter(w => w.id !== activeWalletId);
    
    if (newWallets.length === 0) {
      await logout();
      return true; // true means the user is fully logged out (no wallets left)
    } else {
      await SecureStore.setItemAsync('saved_wallets', JSON.stringify(newWallets));
      setSavedWallets(newWallets);
      await switchWallet(newWallets[0].id);
      return false; // false means they still have a wallet, so don't redirect to login
    }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('wallet_created');
    await SecureStore.deleteItemAsync('seed_phrase');
    await SecureStore.deleteItemAsync('wallet_password');
    await SecureStore.deleteItemAsync('saved_wallets');
    await SecureStore.deleteItemAsync('active_wallet_id');
    setIsCreated(false);
    setSavedWallets([]);
    setActiveWalletId(null);
    setAddress('');
    setBalance('');
    setTransactions([]);
  };

  return (
    <WalletContext.Provider value={{
      isLoading, isCreated, savedWallets, activeWalletId, address, balance,
      transactions, isBalanceLoading, isTransactionsLoading,
      savePasswordLocally, verifyPassword, markCreated,
      loadAccounts, refreshData, logout, removeActiveWallet, renameActiveWallet, switchWallet, addNewWallet,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}

