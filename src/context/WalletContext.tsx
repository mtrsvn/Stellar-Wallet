import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const safeSetItemAsync = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('localStorage set error', e);
    }
  } else {
    await SecureStore.setItemAsync(key, value);
  }
};

const safeGetItemAsync = async (key: string) => {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error('localStorage get error', e);
      return null;
    }
  } else {
    return await SecureStore.getItemAsync(key);
  }
};

const safeDeleteItemAsync = async (key: string) => {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('localStorage remove error', e);
    }
  } else {
    await SecureStore.deleteItemAsync(key);
  }
};
import { WalletCore } from '../utils/WalletCore';
import { EthService } from '../services/EthService';
import { BtcService } from '../services/BtcService';
import { SolService } from '../services/SolService';
import { PriceService } from '../services/PriceService';
import { Network, getNetworksByMode } from '../utils/networks';
import { Token, getTokensByNetworkId } from '../utils/tokens';

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
  to?: string;
  networkId?: string;
  hash?: string;
  status?: 'pending' | 'confirmed' | 'failed';
}

export interface TokenBalance {
  id: string;
  isNative: boolean;
  network: Network;
  token?: Token;
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
  tokenBalances: TokenBalance[];
  totalUsdBalance: number;
  portfolioHistory: number[];
  transactions: Transaction[];
  isBalanceLoading: boolean;
  isTransactionsLoading: boolean;
  userPin: string | null;
  biometricEnabled: boolean;
  pinAttempt: number;
  isLocked: boolean;
  lockedUntil: string | null;
  savePin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  setBiometrics: (enabled: boolean) => Promise<void>;
  updatePinAttempts: (attempts: number, lockedUntil?: string | null) => Promise<void>;
  markCreated: () => Promise<void>;
  loadAccounts: () => Promise<void>;
  refreshData: () => Promise<void>;
  addLocalTransaction: (tx: Transaction) => void;
  updateTransactionStatus: (hash: string, status: NonNullable<Transaction['status']>) => void;
  logout: () => Promise<void>;
  removeActiveWallet: () => Promise<boolean>;
  renameActiveWallet: (newName: string) => Promise<void>;
  addNewWallet: (mnemonic: string, name?: string) => Promise<void>;
  switchWallet: (id: string) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

const withTimeout = async <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      timeout = setTimeout(() => resolve(fallback), ms);
    }),
  ]).finally(() => clearTimeout(timeout));
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isCreated, setIsCreated] = useState(false);
  const [savedWallets, setSavedWallets] = useState<SavedWallet[]>([]);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);
  
  const [evmAddress, setEvmAddress] = useState('');
  const [btcAddress, setBtcAddress] = useState('');
  const [solAddress, setSolAddress] = useState('');

  const [isTestnet, setIsTestnet] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [totalUsdBalance, setTotalUsdBalance] = useState(0);
  const [portfolioHistory, setPortfolioHistory] = useState<number[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);

  // Security States
  const [userPin, setUserPin] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [pinAttempt, setPinAttempt] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);

  useEffect(() => {
    initWallet();
  }, []);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (evmAddress || btcAddress || solAddress) {
      timeout = setTimeout(() => {
        loadWalletData({ evmAddress, btcAddress, solAddress });
      }, 500); // Wait 500ms for animations to finish before locking JS thread
    }
    return () => clearTimeout(timeout);
  }, [evmAddress, btcAddress, solAddress, isTestnet]);

  const initWallet = async () => {
    try {
      const created = await safeGetItemAsync('wallet_created');
      setIsCreated(created === 'true');
      
      const testnetPref = await safeGetItemAsync('is_testnet');
      if (testnetPref) setIsTestnet(testnetPref === 'true');

      // Security
      const pin = await safeGetItemAsync('wallet_pin');
      setUserPin(pin || null);
      const bio = await safeGetItemAsync('biometric_enabled');
      setBiometricEnabled(bio === 'true');
      const attempts = await safeGetItemAsync('pin_attempts');
      setPinAttempt(attempts ? parseInt(attempts) : 0);
      const locked = await safeGetItemAsync('is_locked');
      setIsLocked(locked === 'true');
      const lUntil = await safeGetItemAsync('locked_until');
      setLockedUntil(lUntil || null);

      const histStr = await safeGetItemAsync('portfolio_history');
      if (histStr) {
        try {
          setPortfolioHistory(JSON.parse(histStr));
        } catch(e) {}
      }

      let wallets: SavedWallet[] = [];
      const storedWalletsStr = await safeGetItemAsync('saved_wallets');
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
        const oldSeed = await safeGetItemAsync('seed_phrase');
        if (oldSeed) {
          const evm = WalletCore.getEvmAddress(oldSeed);
          const btc = WalletCore.getBtcAddress(oldSeed);
          const sol = WalletCore.getSolanaAddress(oldSeed);
          wallets = [{ id: '1', name: 'Wallet 1', mnemonic: oldSeed, evmAddress: evm, btcAddress: btc, solAddress: sol }];
          await safeSetItemAsync('saved_wallets', JSON.stringify(wallets));
        }
      }
      
      setSavedWallets(wallets);
      
      if (created === 'true' && wallets.length > 0) {
        const activeId = await safeGetItemAsync('active_wallet_id') || wallets[0].id;
        setActiveWalletId(activeId);
        const activeWallet = wallets.find(w => w.id === activeId) || wallets[0];
        
        setEvmAddress(activeWallet.evmAddress);
        setBtcAddress(activeWallet.btcAddress);
        setSolAddress(activeWallet.solAddress);
      }
    } catch (e) {
      console.error('initWallet error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetIsTestnet = async (val: boolean) => {
    setTokenBalances([]);
    setTransactions([]);
    setTotalUsdBalance(0);
    setIsTestnet(val);
    await safeSetItemAsync('is_testnet', val ? 'true' : 'false');
  };

  const loadAccounts = async () => {};

  const loadWalletData = async (addrs: { evmAddress: string, btcAddress: string, solAddress: string }) => {
    fetchBalancesAndPrices(addrs);
    fetchTransactions(addrs);
  };

  const addLocalTransaction = (tx: Transaction) => {
    setTransactions(prev => {
      if (tx.hash && prev.some(existing => existing.hash === tx.hash)) {
        return prev.map(existing => existing.hash === tx.hash ? { ...existing, ...tx } : existing);
      }
      return [tx, ...prev];
    });
  };

  const updateTransactionStatus = (hash: string, status: NonNullable<Transaction['status']>) => {
    if (!hash) return;
    setTransactions(prev => prev.map(tx => tx.hash === hash ? { ...tx, status } : tx));
  };

  const getAddressForNetwork = (network: Network, addrs: { evmAddress: string, btcAddress: string, solAddress: string }) => {
    if (network.type === 'EVM') return addrs.evmAddress;
    if (network.type === 'BTC') {
      if (network.isTestnet) {
        const activeW = savedWallets.find(w => w.id === activeWalletId);
        if (activeW) {
          return WalletCore.getBtcAddress(activeW.mnemonic, 0, true);
        }
      }
      return addrs.btcAddress;
    }
    if (network.type === 'SOL') return addrs.solAddress;
    return '';
  };

  const fetchBalancesAndPrices = async (addrs: { evmAddress: string, btcAddress: string, solAddress: string }) => {
    setIsBalanceLoading(true);
    try {
      const activeNetworks = getNetworksByMode(isTestnet);
      let coinIds = activeNetworks.map(n => n.coingeckoId);
      activeNetworks.forEach(net => {
        getTokensByNetworkId(net.id).forEach(t => {
          if (!coinIds.includes(t.coingeckoId)) coinIds.push(t.coingeckoId);
        });
      });
      ['usd-coin', 'tether', 'chainlink', 'dai', 'binance-usd', 'pancakeswap-token'].forEach(id => {
        if (!coinIds.includes(id)) coinIds.push(id);
      });
      const prices = await PriceService.fetchPrices(coinIds);
      const symbolPrices = new Map<string, number>();
      activeNetworks.forEach(net => {
        const price = Number(prices[net.coingeckoId]) || 0;
        if (price > 0) symbolPrices.set(net.symbol.toUpperCase(), price);
      });
      activeNetworks.forEach(net => {
        getTokensByNetworkId(net.id).forEach(token => {
          const price = Number(prices[token.coingeckoId]) || 0;
          if (price > 0) symbolPrices.set(token.symbol.toUpperCase(), price);
        });
      });

      let totalUsd = 0;
      const balancesList: TokenBalance[] = [];

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
        let price = Number(prices[net.coingeckoId]);
        if (isNaN(price)) price = 0;
        let usdVal = numVal * price;
        if (isNaN(usdVal)) usdVal = 0;
        
        totalUsd += usdVal;
        balancesList.push({
          id: net.id,
          isNative: true,
          network: net,
          balanceStr: balStr,
          balanceValue: numVal,
          usdValue: usdVal
        });

        const featuredTokens = getTokensByNetworkId(net.id);
        let discoveredTokens: Token[] = [];

        try {
          if (net.type === 'EVM') {
            const evmDiscovered = await withTimeout(
              EthService.discoverTokens(addr, net),
              5000,
              []
            );
            discoveredTokens = evmDiscovered.map(token => ({
              id: `discovered-${net.id}-${token.address.toLowerCase()}`,
              networkId: net.id,
              address: token.address,
              name: token.name,
              symbol: token.symbol,
              decimals: token.decimals,
              logoUrl: '',
              coingeckoId: '',
            }));
          } else if (net.type === 'SOL') {
            const solDiscovered = await withTimeout(
              SolService.discoverTokens(addr, net),
              1500,
              []
            );
            discoveredTokens = solDiscovered.map(token => ({
              id: `discovered-${net.id}-${token.address}`,
              networkId: net.id,
              address: token.address,
              name: token.name,
              symbol: token.symbol,
              decimals: token.decimals,
              logoUrl: '',
              coingeckoId: '',
            }));
          }
        } catch (e) {
          console.error(`Failed to discover tokens for ${net.name}:`, e);
        }

        const tokenMap = new Map<string, Token>();
        [...featuredTokens, ...discoveredTokens].forEach(token => {
          tokenMap.set(`${token.networkId}:${token.address.toLowerCase()}`, token);
        });
        const networkTokens = Array.from(tokenMap.values());
        const contractPrices = await withTimeout(
          PriceService.fetchTokenPrices(
            net,
            networkTokens
              .filter(token => !token.coingeckoId)
              .map(token => token.address)
          ),
          1500,
          {}
        );
        const coingeckoTokenData = await withTimeout(
          PriceService.fetchCoinGeckoTokenData(
            net,
            networkTokens
              .filter(token => !token.coingeckoId)
              .map(token => token.address)
          ),
          2500,
          {}
        );
        const dexTokenData = await withTimeout(
          PriceService.fetchDexScreenerTokenData(
            net,
            networkTokens
              .filter(token => !token.coingeckoId)
              .map(token => token.address)
          ),
          1500,
          {}
        );
        const testnetSymbolData = net.isTestnet
          ? await withTimeout(
              PriceService.fetchCoinGeckoSymbolData(
                networkTokens
                  .filter(token => !token.coingeckoId)
                  .map(token => token.symbol)
              ),
              5000,
              {}
            )
          : {};

        for (const token of networkTokens) {
          let tokenBalStr = '0.000000';
          try {
            if (net.type === 'EVM') {
              tokenBalStr = await EthService.getTokenBalance(addr, token.address, token.decimals, net);
            } else if (net.type === 'SOL') {
              tokenBalStr = await SolService.getTokenBalance(addr, token.address, token.decimals, net);
            }
          } catch(e) {
            console.error(`Failed to fetch token balance for ${token.symbol}:`, e);
          }

          const tNumVal = parseFloat(tokenBalStr) || 0;
          let tPrice = token.coingeckoId
            ? Number(prices[token.coingeckoId])
            : Number(contractPrices[net.type === 'SOL' ? token.address : token.address.toLowerCase()]);
          if (!tPrice || isNaN(tPrice)) {
            const marketDataKey = net.type === 'SOL' ? token.address : token.address.toLowerCase();
            tPrice = Number(coingeckoTokenData[marketDataKey]?.price) || 0;
          }
          if (!tPrice || isNaN(tPrice)) {
            const marketDataKey = net.type === 'SOL' ? token.address : token.address.toLowerCase();
            tPrice = Number(dexTokenData[marketDataKey]?.price) || 0;
          }
          if (!tPrice || isNaN(tPrice)) {
            const sym = PriceService.normalizeTokenSymbol(token.symbol);
            const mainnetEquivalent = net.isTestnet
              ? PriceService.getMainnetEquivalentToken(sym, net)
              : null;
            if (mainnetEquivalent?.coingeckoId) {
              tPrice = Number(prices[mainnetEquivalent.coingeckoId]) || 0;
            }
            if (!tPrice && testnetSymbolData[sym]?.price) {
              tPrice = Number(testnetSymbolData[sym].price) || 0;
            }
            if (!tPrice) tPrice = symbolPrices.get(sym) || 0;
            if (!tPrice && ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDP', 'PYUSD'].includes(sym)) tPrice = 1;
            if (!tPrice && ['WETH', 'ETH'].includes(sym)) tPrice = symbolPrices.get('ETH') || 0;
            if (!tPrice && ['WBNB', 'BNB'].includes(sym)) tPrice = symbolPrices.get('BNB') || symbolPrices.get('TBNB') || 0;
            if (!tPrice && ['WBTC', 'BTC'].includes(sym)) tPrice = symbolPrices.get('BTC') || symbolPrices.get('TBTC') || 0;
            if (!tPrice && ['WSOL', 'SOL'].includes(sym)) tPrice = symbolPrices.get('SOL') || 0;
          }
          if (isNaN(tPrice)) tPrice = 0;
          let tUsdVal = tNumVal * tPrice;
          if (isNaN(tUsdVal)) tUsdVal = 0;
          
          totalUsd += tUsdVal;
          const marketDataKey = net.type === 'SOL' ? token.address : token.address.toLowerCase();
          const normalizedSymbol = PriceService.normalizeTokenSymbol(token.symbol);
          const mainnetEquivalent = net.isTestnet
            ? PriceService.getMainnetEquivalentToken(normalizedSymbol, net)
            : null;
          const enrichedToken = {
            ...token,
            logoUrl:
              coingeckoTokenData[marketDataKey]?.logoUrl ||
              dexTokenData[marketDataKey]?.logoUrl ||
              mainnetEquivalent?.logoUrl ||
              testnetSymbolData[normalizedSymbol]?.logoUrl ||
              token.logoUrl ||
              PriceService.getTokenLogoUrl(net, token.address),
            coingeckoId:
              token.coingeckoId ||
              mainnetEquivalent?.coingeckoId ||
              testnetSymbolData[normalizedSymbol]?.coingeckoId ||
              '',
          };
          balancesList.push({
            id: token.id,
            isNative: false,
            network: net,
            token: enrichedToken,
            balanceStr: tNumVal > 0 ? `${tNumVal.toFixed(4)} ${token.symbol}` : `0.0000 ${token.symbol}`,
            balanceValue: tNumVal,
            usdValue: tUsdVal
          });
        }
      }

      const filteredBalancesList = balancesList.filter(b => {
        if (b.balanceValue > 0) return true;

        if (b.isNative) {
          const sym = b.network.symbol.toUpperCase();
          return ['BTC', 'ETH', 'BNB', 'SOL', 'TBTC', 'TBNB'].includes(sym);
        } else {
          const sym = b.token?.symbol.toUpperCase();
          if (!sym) return false;
          
          if (b.network.id.includes('ethereum') && ['USDT', 'USDC', 'LINK', 'UNI', 'SHIB', 'PEPE'].includes(sym)) return true;
          if (b.network.id.includes('bnb') && ['USDT', 'BUSD', 'CAKE'].includes(sym)) return true;
          if (b.network.id.includes('solana') && ['USDT', 'USDC'].includes(sym)) return true;
          
          return false;
        }
      });

      const COIN_ORDER = ["BTC", "ETH", "BNB", "SOL", "USDT", "USDC", "LINK", "UNI", "SHIB", "PEPE"];

      filteredBalancesList.sort((a, b) => {
        const hasBalanceA = Number(a.balanceValue) > 0;
        const hasBalanceB = Number(b.balanceValue) > 0;
        if (hasBalanceA !== hasBalanceB) return hasBalanceA ? -1 : 1;

        const symA = (a.isNative ? a.network.symbol : a.token?.symbol)?.toUpperCase() || "";
        const symB = (b.isNative ? b.network.symbol : b.token?.symbol)?.toUpperCase() || "";
        
        let indexA = COIN_ORDER.indexOf(symA);
        let indexB = COIN_ORDER.indexOf(symB);
        
        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;
        
        if (indexA !== indexB) {
          return indexA - indexB;
        }
        return b.usdValue - a.usdValue;
      });

      setTokenBalances(filteredBalancesList);
      if (isNaN(totalUsd)) totalUsd = 0;
      setTotalUsdBalance(totalUsd);
      
      // Update history array
      setPortfolioHistory(prev => {
        const newHist = [...prev, totalUsd];
        if (newHist.length > 50) newHist.shift(); // keep last 50 points
        if (newHist.length === 1) newHist.unshift(totalUsd * 0.95); // add a point so we always have a line
        safeSetItemAsync('portfolio_history', JSON.stringify(newHist));
        return newHist;
      });
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
            allTxs = [...allTxs, ...txs.map(t => ({ ...t, networkId: net.id, status: 'confirmed' as const }))];
          } else if (net.type === 'BTC') {
            const txs = await BtcService.getTransactions(addr, net);
            allTxs = [...allTxs, ...txs.map(t => ({ ...t, networkId: net.id, status: 'confirmed' as const }))];
          } else if (net.type === 'SOL') {
            const txs = await SolService.getTransactions(addr, net);
            allTxs = [...allTxs, ...txs.map(t => ({ ...t, networkId: net.id, status: 'confirmed' as const }))];
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
    await safeSetItemAsync('saved_wallets', JSON.stringify(newWallets));
    setSavedWallets(newWallets);
    
    await safeSetItemAsync('active_wallet_id', newId);
    setActiveWalletId(newId);
    setTokenBalances([]);
    setTransactions([]);
    setTotalUsdBalance(0);
    setPortfolioHistory([]);
    setEvmAddress(evm);
    setBtcAddress(btc);
    setSolAddress(sol);
  };

  const switchWallet = async (id: string) => {
    const wallet = savedWallets.find(w => w.id === id);
    if (!wallet) return;
    
    await safeSetItemAsync('active_wallet_id', id);
    setActiveWalletId(id);
    setEvmAddress(wallet.evmAddress);
    setBtcAddress(wallet.btcAddress);
    setSolAddress(wallet.solAddress);
  };

  const savePin = async (pin: string) => {
    await safeSetItemAsync('wallet_pin', pin);
    setUserPin(pin);
  };

  const verifyPin = async (pin: string): Promise<boolean> => {
    const stored = await safeGetItemAsync('wallet_pin');
    return stored === pin;
  };

  const setBiometrics = async (enabled: boolean) => {
    await safeSetItemAsync('biometric_enabled', enabled ? 'true' : 'false');
    setBiometricEnabled(enabled);
  };

  const updatePinAttempts = async (attempts: number, lUntil?: string | null) => {
    await safeSetItemAsync('pin_attempts', attempts.toString());
    setPinAttempt(attempts);
    
    if (lUntil !== undefined) {
      if (lUntil) {
        await safeSetItemAsync('is_locked', 'true');
        await safeSetItemAsync('locked_until', lUntil);
        setIsLocked(true);
        setLockedUntil(lUntil);
      } else {
        await safeSetItemAsync('is_locked', 'false');
        await safeDeleteItemAsync('locked_until');
        setIsLocked(false);
        setLockedUntil(null);
      }
    }
  };

  const markCreated = async () => {
    await safeSetItemAsync('wallet_created', 'true');
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
    await safeSetItemAsync('saved_wallets', JSON.stringify(newWallets));
    setSavedWallets(newWallets);
  };

  const removeActiveWallet = async (): Promise<boolean> => {
    if (!activeWalletId) return false;
    
    const newWallets = savedWallets.filter(w => w.id !== activeWalletId);
    
    if (newWallets.length === 0) {
      await logout();
      return true;
    } else {
      await safeSetItemAsync('saved_wallets', JSON.stringify(newWallets));
      setSavedWallets(newWallets);
      await switchWallet(newWallets[0].id);
      return false;
    }
  };

  const logout = async () => {
    await safeDeleteItemAsync('wallet_created');
    await safeDeleteItemAsync('seed_phrase');
    await safeDeleteItemAsync('wallet_pin');
    await safeDeleteItemAsync('biometric_enabled');
    await safeDeleteItemAsync('pin_attempts');
    await safeDeleteItemAsync('is_locked');
    await safeDeleteItemAsync('locked_until');
    await safeDeleteItemAsync('wallet_password'); // clear legacy
    await safeDeleteItemAsync('saved_wallets');
    await safeDeleteItemAsync('active_wallet_id');
    setIsCreated(false);
    setSavedWallets([]);
    setActiveWalletId(null);
    setEvmAddress('');
    setBtcAddress('');
    setSolAddress('');
    setTotalUsdBalance(0);
    setTokenBalances([]);
    setTransactions([]);
    setUserPin(null);
    setBiometricEnabled(false);
    setPinAttempt(0);
    setIsLocked(false);
    setLockedUntil(null);
  };

  return (
    <WalletContext.Provider value={{
      isLoading, isCreated, savedWallets, activeWalletId, 
      evmAddress, btcAddress, solAddress,
      isTestnet, setIsTestnet: handleSetIsTestnet,
      tokenBalances, totalUsdBalance, portfolioHistory, transactions, isBalanceLoading, isTransactionsLoading,
      userPin, biometricEnabled, pinAttempt, isLocked, lockedUntil,
      savePin, verifyPin, setBiometrics, updatePinAttempts, markCreated,
      loadAccounts, refreshData, addLocalTransaction, updateTransactionStatus, logout, removeActiveWallet, renameActiveWallet, switchWallet, addNewWallet,
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
