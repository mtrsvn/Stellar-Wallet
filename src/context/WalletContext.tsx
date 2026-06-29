import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { WalletCore } from '../utils/WalletCore';
import { EthService } from '../services/EthService';
import { BtcService } from '../services/BtcService';
import { SolService } from '../services/SolService';
import { PriceService } from '../services/PriceService';
import { Network, getNetworksByMode } from '../utils/networks';

export interface SavedWallet {
  id: string;
  name: string;
  mnemonic: string;
  evmAddress: string;
  btcAddress: string;
  solAddress: string;
}

export interface Transaction {
  title: string;
  date: string;
  dateTime?: string;
  subtitle?: string;
  amount: string;
  delta: string;
  amountColor: string;
  icon: string;
  from: string;
  networkId?: string;
}

export interface NetworkBalance {
  network: Network;
  balanceStr: string;
  balanceValue: number;
  usdValue: number;
}

interface WalletContextType {
  isLoading: boolean;
  isCreated: boolean;
  savedWallets: SavedWallet[];
  activeWalletId: string | null;
  evmAddress: string;
  btcAddress: string;
  solAddress: string;
  isTestnet: boolean;
  setIsTestnet: (val: boolean) => void;
  networkBalances: NetworkBalance[];
  totalUsdBalance: number;
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
  
  const [evmAddress, setEvmAddress] = useState('');
  const [btcAddress, setBtcAddress] = useState('');
  const [solAddress, setSolAddress] = useState('');

  const [isTestnet, setIsTestnet] = useState(false);
  const [networkBalances, setNetworkBalances] = useState<NetworkBalance[]>([]);
  const [totalUsdBalance, setTotalUsdBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);

  useEffect(() => {
    initWallet();
  }, []);

  useEffect(() => {
    if (evmAddress || btcAddress || solAddress) {
      loadWalletData({ evmAddress, btcAddress, solAddress });
    }
  }, [isTestnet]);

  const initWallet = async () => {
    try {
      const created = await SecureStore.getItemAsync('wallet_created');
      setIsCreated(created === 'true');
      
      const testnetPref = await SecureStore.getItemAsync('is_testnet');
      if (testnetPref) setIsTestnet(testnetPref === 'true');

      let wallets: SavedWallet[] = [];
      const storedWalletsStr = await SecureStore.getItemAsync('saved_wallets');
      if (storedWalletsStr) {
        wallets = JSON.parse(storedWalletsStr);
        // Migrate old wallets if they lack btc/sol addresses
        wallets = wallets.map(w => {
          if (!w.btcAddress || !w.solAddress) {
            return {
              ...w,
              evmAddress: w.evmAddress || (w as any).address || WalletCore.getEvmAddress(w.mnemonic),
              btcAddress: WalletCore.getBtcAddress(w.mnemonic),
              solAddress: WalletCore.getSolanaAddress(w.mnemonic)
            };
          }
          return w;
        });
      } else {
        const oldSeed = await SecureStore.getItemAsync('seed_phrase');
        if (oldSeed) {
          const evm = WalletCore.getEvmAddress(oldSeed);
          const btc = WalletCore.getBtcAddress(oldSeed);
          const sol = WalletCore.getSolanaAddress(oldSeed);
          wallets = [{ id: '1', name: 'Wallet 1', mnemonic: oldSeed, evmAddress: evm, btcAddress: btc, solAddress: sol }];
          await SecureStore.setItemAsync('saved_wallets', JSON.stringify(wallets));
        }
      }
      
      setSavedWallets(wallets);
      
      if (created === 'true' && wallets.length > 0) {
        const activeId = await SecureStore.getItemAsync('active_wallet_id') || wallets[0].id;
        setActiveWalletId(activeId);
        const activeWallet = wallets.find(w => w.id === activeId) || wallets[0];
        
        setEvmAddress(activeWallet.evmAddress);
        setBtcAddress(activeWallet.btcAddress);
        setSolAddress(activeWallet.solAddress);
        
        await loadWalletData(activeWallet);
      }
    } catch (e) {
      console.error('initWallet error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetIsTestnet = async (val: boolean) => {
    setIsTestnet(val);
    await SecureStore.setItemAsync('is_testnet', val ? 'true' : 'false');
  };

  const loadAccounts = async () => {};

  const loadWalletData = async (addrs: { evmAddress: string, btcAddress: string, solAddress: string }) => {
    fetchBalancesAndPrices(addrs);
    fetchTransactions(addrs);
  };

  const getAddressForNetwork = (network: Network, addrs: { evmAddress: string, btcAddress: string, solAddress: string }) => {
    if (network.type === 'EVM') return addrs.evmAddress;
    if (network.type === 'BTC') return addrs.btcAddress;
    if (network.type === 'SOL') return addrs.solAddress;
    return '';
  };

  const fetchBalancesAndPrices = async (addrs: { evmAddress: string, btcAddress: string, solAddress: string }) => {
    setIsBalanceLoading(true);
    try {
      const activeNetworks = getNetworksByMode(isTestnet);
      const coinIds = activeNetworks.map(n => n.coingeckoId);
      const prices = await PriceService.fetchPrices(coinIds);

      let totalUsd = 0;
      const balancesList: NetworkBalance[] = [];

      for (const net of activeNetworks) {
        const addr = getAddressForNetwork(net, addrs);
        let balStr = '0.0';
        
        try {
          if (net.type === 'EVM') {
            balStr = await EthService.getBalance(addr, net);
          } else if (net.type === 'BTC') {
            balStr = await BtcService.getBalance(addr, net);
          } else if (net.type === 'SOL') {
            balStr = await SolService.getBalance(addr, net);
          }
        } catch(e) {
          console.error(`Failed to fetch balance for ${net.name}:`, e);
        }

        const numVal = parseFloat(balStr.split(' ')[0]) || 0;
        const usdVal = numVal * (prices[net.coingeckoId] || 0);
        
        totalUsd += usdVal;
        balancesList.push({
          network: net,
          balanceStr: balStr,
          balanceValue: numVal,
          usdValue: usdVal
        });
      }

      setNetworkBalances(balancesList);
      setTotalUsdBalance(totalUsd);
    } catch (e) {
      console.error("fetchBalances error", e);
    } finally {
      setIsBalanceLoading(false);
    }
  };

  const fetchTransactions = async (addrs: { evmAddress: string, btcAddress: string, solAddress: string }) => {
    setIsTransactionsLoading(true);
    try {
      const activeNetworks = getNetworksByMode(isTestnet);
      let allTxs: Transaction[] = [];

      for (const net of activeNetworks) {
        const addr = getAddressForNetwork(net, addrs);
        try {
          if (net.type === 'EVM') {
            const txs = await EthService.getTransactions(addr, net);
            allTxs = [...allTxs, ...txs.map(t => ({ ...t, networkId: net.id }))];
          } else if (net.type === 'BTC') {
            const txs = await BtcService.getTransactions(addr, net);
            allTxs = [...allTxs, ...txs.map(t => ({ ...t, networkId: net.id }))];
          } else if (net.type === 'SOL') {
            const txs = await SolService.getTransactions(addr, net);
            allTxs = [...allTxs, ...txs.map(t => ({ ...t, networkId: net.id }))];
          }
        } catch(e) {
          console.error(`Failed to fetch txs for ${net.name}:`, e);
        }
      }

      // Sort globally
      allTxs.sort((a, b) => new Date(b.dateTime || 0).getTime() - new Date(a.dateTime || 0).getTime());
      setTransactions(allTxs);
    } catch (e) {
      setTransactions([]);
    } finally {
      setIsTransactionsLoading(false);
    }
  };

  const addNewWallet = async (mnemonic: string, name?: string) => {
    const evm = WalletCore.getEvmAddress(mnemonic);
    const btc = WalletCore.getBtcAddress(mnemonic);
    const sol = WalletCore.getSolanaAddress(mnemonic);
    
    const newId = Date.now().toString();
    const newWallet: SavedWallet = {
      id: newId,
      name: name || `Wallet ${savedWallets.length + 1}`,
      mnemonic,
      evmAddress: evm,
      btcAddress: btc,
      solAddress: sol,
    };
    
    const newWallets = [...savedWallets, newWallet];
    await SecureStore.setItemAsync('saved_wallets', JSON.stringify(newWallets));
    setSavedWallets(newWallets);
    
    await SecureStore.setItemAsync('active_wallet_id', newId);
    setActiveWalletId(newId);
    setEvmAddress(evm);
    setBtcAddress(btc);
    setSolAddress(sol);
    await loadWalletData(newWallet);
  };

  const switchWallet = async (id: string) => {
    const wallet = savedWallets.find(w => w.id === id);
    if (!wallet) return;
    
    await SecureStore.setItemAsync('active_wallet_id', id);
    setActiveWalletId(id);
    setEvmAddress(wallet.evmAddress);
    setBtcAddress(wallet.btcAddress);
    setSolAddress(wallet.solAddress);
    await loadWalletData(wallet);
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
    if (evmAddress) {
      await fetchBalancesAndPrices({ evmAddress, btcAddress, solAddress });
      await fetchTransactions({ evmAddress, btcAddress, solAddress });
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
      return true;
    } else {
      await SecureStore.setItemAsync('saved_wallets', JSON.stringify(newWallets));
      setSavedWallets(newWallets);
      await switchWallet(newWallets[0].id);
      return false;
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
    setEvmAddress('');
    setBtcAddress('');
    setSolAddress('');
    setTotalUsdBalance(0);
    setNetworkBalances([]);
    setTransactions([]);
  };

  return (
    <WalletContext.Provider value={{
      isLoading, isCreated, savedWallets, activeWalletId, 
      evmAddress, btcAddress, solAddress,
      isTestnet, setIsTestnet: handleSetIsTestnet, networkBalances, totalUsdBalance,
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

