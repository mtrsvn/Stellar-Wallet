import { HapticTouchableOpacity } from '../../src/components/HapticTouchableOpacity';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { User, Settings, Eye, EyeOff, ArrowUpRight, ArrowDownLeft, Copy, QrCode, HelpCircle, ChevronRight, ChevronLeft } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheet, handleStyle, sheetBaseStyle } from '../../src/components/BottomSheet';
import { QRDisplay } from '../../src/components/QRDisplay';
import { SettingsSheet } from '../../src/components/SettingsSheet';
import { WalletsSheet } from '../../src/components/WalletsSheet';
import { useWallet } from '../../src/context/WalletContext';
import { getNetworkIcon } from '../../src/components/NetworkIcons';
import { TokenListItem } from '../../src/components/TokenListItem';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const wallet = useWallet();
  const handledScanIdRef = useRef<string | null>(null);
  const searchParams = useLocalSearchParams<{ scannedAddress?: string; scanId?: string }>();

  const [showBalances, setShowBalances] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [receiveVisible, setReceiveVisible] = useState(false);
  const [sendVisible, setSendVisible] = useState(false);
  const [walletsVisible, setWalletsVisible] = useState(false);
  const [sendToAddress, setSendToAddress] = useState('');
  
  const [receiveNetworkId, setReceiveNetworkId] = useState<string>('');
  const [receiveStep, setReceiveStep] = useState<'select' | 'qr'>('select');

  useEffect(() => {
    wallet.loadAccounts();
  }, []);

  useEffect(() => {
    const scannedAddress = Array.isArray(searchParams.scannedAddress)
      ? searchParams.scannedAddress[0]
      : searchParams.scannedAddress;
    const scanId = Array.isArray(searchParams.scanId)
      ? searchParams.scanId[0]
      : searchParams.scanId;

    if (!scannedAddress || !scanId || handledScanIdRef.current === scanId) return;

    handledScanIdRef.current = scanId;
    setSendToAddress(scannedAddress);
    setSendVisible(true);
  }, [searchParams.scannedAddress, searchParams.scanId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await wallet.refreshData();
    setRefreshing(false);
  }, [wallet]);

  const selectedReceiveNetwork = wallet.tokenBalances?.find(n => n.network.id === receiveNetworkId)?.network;

  const getReceiveAddress = () => {
    if (!selectedReceiveNetwork) return '';
    if (selectedReceiveNetwork.type === 'EVM') return wallet.evmAddress;
    if (selectedReceiveNetwork.type === 'BTC') return wallet.btcAddress;
    if (selectedReceiveNetwork.type === 'SOL') return wallet.solAddress;
    return '';
  };

  const currentReceiveAddress = getReceiveAddress();

  const copyWalletAddress = useCallback(async () => {
    if (!currentReceiveAddress) return;
    await Clipboard.setStringAsync(currentReceiveAddress);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [currentReceiveAddress]);

  const openQrScanner = useCallback(() => {
    setSendVisible(false);
    router.push('/scan');
  }, [router]);

  const displayUsdValue = wallet.totalUsdBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const displayUsdText = showBalances ? `$${displayUsdValue}` : '••••••';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="white" />}
      >
        <LinearGradient colors={['#9C2CF0', '#7A19D9']} style={styles.balanceCard}>
          <View style={styles.cardHeader}>
            <HapticTouchableOpacity onPress={() => setWalletsVisible(true)} style={styles.iconBox}>
              <User size={20} color="white" />
            </HapticTouchableOpacity>
            <HapticTouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.iconBox}>
              <Settings size={20} color="white" />
            </HapticTouchableOpacity>
          </View>

          <View style={styles.balanceContainer}>
            {wallet.isBalanceLoading ? (
              <Text style={styles.balanceText}>...</Text>
            ) : (
              <Text style={styles.balanceText}>{displayUsdText}</Text>
            )}
            <HapticTouchableOpacity onPress={() => setShowBalances(!showBalances)} style={styles.eyeButton}>
              {showBalances ? (
                <EyeOff size={20} color="rgba(255,255,255,0.7)" />
              ) : (
                <Eye size={20} color="rgba(255,255,255,0.7)" />
              )}
            </HapticTouchableOpacity>
          </View>

          <View style={styles.usdContainer}>
            <Text style={styles.usdText}>{wallet.isTestnet ? 'Testnet Portfolio' : 'Total Portfolio Balance'}</Text>
          </View>

          <View style={{ marginLeft: -36, marginTop: 16, marginBottom: 16, width: Dimensions.get('window').width + 48 }}>
             <View style={{ height: 60, justifyContent: 'center' }}>
                <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.3)', width: Dimensions.get('window').width }} />
             </View>
          </View>

          <View style={styles.actionsContainer}>
            <HapticTouchableOpacity style={styles.actionButton} onPress={() => setSendVisible(true)}>
              <ArrowUpRight size={16} color="white" />
              <Text style={styles.actionText}>Send</Text>
            </HapticTouchableOpacity>
            <HapticTouchableOpacity style={styles.actionButton} onPress={() => setReceiveVisible(true)}>
              <ArrowDownLeft size={16} color="white" />
              <Text style={styles.actionText}>Receive</Text>
            </HapticTouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.activitiesHeader}>
          <Text style={styles.activitiesTitle}>Your Assets</Text>
        </View>

        {wallet.isBalanceLoading ? (
          <Text style={{ color: 'white', textAlign: 'center' }}>Loading assets...</Text>
        ) : wallet.tokenBalances && wallet.tokenBalances.length === 0 ? (
          <Text style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>No assets found</Text>
        ) : (
          wallet.tokenBalances?.slice(0, 5).map((tb, idx) => {
            const itemWithHiddenBalance = {
              ...tb,
              balanceStr: showBalances ? tb.balanceStr : '••••',
              usdValue: showBalances ? tb.usdValue : 0
            };
            return (
              <View key={tb.id}>
                {showBalances ? (
                  <TokenListItem item={tb} />
                ) : (
                  <TokenListItem item={{...tb, balanceStr: '••••', usdValue: 0}} />
                )}
              </View>
            );
          })
        )}

        <View style={styles.activitiesHeader}>
          <Text style={styles.activitiesTitle}>Recent Transactions</Text>
        </View>

        {wallet.isTransactionsLoading ? (
          <Text style={{ color: 'white', textAlign: 'center' }}>Loading...</Text>
        ) : wallet.transactions.length === 0 ? (
          <Text style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>No recent transactions</Text>
        ) : (
          wallet.transactions.slice(0, 5).map((tx, idx) => {
            let IconComponent = HelpCircle;
            if (tx.icon === 'ArrowDownLeft') IconComponent = ArrowDownLeft;
            if (tx.icon === 'ArrowUpRight') IconComponent = ArrowUpRight;

            return (
              <HapticTouchableOpacity key={idx} style={styles.txCard}>
                <View style={styles.txIconBox}>
                  <IconComponent color="white" size={20} />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txTitle}>{tx.title}</Text>
                  <Text style={styles.txSubtitle} numberOfLines={1}>{showBalances ? tx.subtitle : '••••'}</Text>
                </View>
                <View style={styles.txAmounts}>
                  <Text style={styles.txDate}>{tx.date}</Text>
                </View>
              </HapticTouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <SettingsSheet visible={settingsVisible} onClose={() => setSettingsVisible(false)} onLogoutSuccess={() => router.replace('/welcome' as any)} />
      <WalletsSheet visible={walletsVisible} onClose={() => setWalletsVisible(false)} />

      <BottomSheet visible={receiveVisible} onClose={() => {
        setReceiveVisible(false);
        setTimeout(() => setReceiveStep('select'), 300);
      }}>
        <View style={[sheetBaseStyle, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.handleWrap}><View style={handleStyle as any} /></View>
          
          {receiveStep === 'select' ? (
            <>
              <Text style={styles.sheetTitle}>Choose Network</Text>
              
              <View style={{ marginTop: 12, marginBottom: -12 }}>
                {wallet.tokenBalances?.filter(tb => tb.isNative).map((nb) => (
                  <HapticTouchableOpacity
                    key={nb.network.id}
                    style={styles.txCard}
                    onPress={() => {
                      setReceiveNetworkId(nb.network.id);
                      setReceiveStep('qr');
                    }}
                  >
                    <View style={styles.networkLogoContainer}>
                      {getNetworkIcon(nb.network.symbol, 40) || (
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: nb.network.color, justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{color: 'white', fontWeight: 'bold'}}>{nb.network.symbol[0]}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={[styles.txTitle, { marginBottom: 0 }]}>{nb.network.name}</Text>
                    </View>
                    <View style={styles.txAmounts}>
                      <ChevronRight color="rgba(255,255,255,0.3)" size={20} />
                    </View>
                  </HapticTouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <HapticTouchableOpacity onPress={() => setReceiveStep('select')} style={{ padding: 8 }}>
                  <ChevronLeft size={24} color="white" />
                </HapticTouchableOpacity>
                <Text style={[styles.sheetTitle, { marginBottom: 0 }]}>Receive {selectedReceiveNetwork?.symbol}</Text>
                <View style={{ width: 34 }} />
              </View>

              <View style={styles.qrWrapper}>
                <View style={{ padding: 12, backgroundColor: 'white', borderRadius: 24, shadowColor: selectedReceiveNetwork?.color || '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 }}>
                  <QRDisplay address={currentReceiveAddress ? currentReceiveAddress : 'loading'} />
                </View>
              </View>

              <Text style={styles.addressLabel}>
                Your {selectedReceiveNetwork?.name || ''} Address
              </Text>
              
              <HapticTouchableOpacity style={styles.addressBox} onPress={copyWalletAddress} disabled={!currentReceiveAddress} activeOpacity={0.7}>
                <View style={styles.addressTextWrapper}>
                  <Text style={styles.addressText} numberOfLines={2} ellipsizeMode="middle">
                    {currentReceiveAddress || 'No address yet'}
                  </Text>
                </View>
                <View style={styles.copyButtonBox}>
                  <Copy size={20} color={currentReceiveAddress ? '#A855F7' : 'rgba(255,255,255,0.35)'} />
                </View>
              </HapticTouchableOpacity>

              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  Send only {selectedReceiveNetwork?.symbol} to this address. Sending any other asset will result in permanent loss.
                </Text>
              </View>
            </>
          )}

        </View>
      </BottomSheet>

      <BottomSheet visible={sendVisible} onClose={() => setSendVisible(false)}>
        <View style={[sheetBaseStyle, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.handleWrap}><View style={handleStyle as any} /></View>
          <Text style={styles.sheetTitle}>Select Token</Text>
          
          <ScrollView style={{ maxHeight: 400, marginTop: 12, marginBottom: -12 }}>
            {wallet.tokenBalances?.map((tb) => (
              <HapticTouchableOpacity
                key={tb.id}
                style={styles.txCard}
                onPress={() => {
                  setSendVisible(false);
                  router.push({ pathname: '/send', params: { assetId: tb.id } } as any);
                }}
              >
                <View style={styles.networkLogoContainer}>
                  {tb.isNative ? (
                    getNetworkIcon(tb.network.symbol, 40)
                  ) : (
                    tb.token?.logoUrl ? (
                      <Image source={{ uri: tb.token.logoUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                    ) : (
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#333' }} />
                    )
                  )}
                  {!tb.isNative && (
                    <View style={{ position: 'absolute', bottom: -2, right: -2, borderRadius: 10, backgroundColor: '#1C1C1E' }}>
                      {getNetworkIcon(tb.network.symbol, 16)}
                    </View>
                  )}
                </View>
                <View style={styles.txInfo}>
                  <Text style={[styles.txTitle, { marginBottom: 2 }]}>
                    {tb.isNative ? tb.network.name : tb.token?.name || 'Token'}
                  </Text>
                  <Text style={styles.txSubtitle}>
                    {tb.isNative ? `${tb.balanceStr} ${tb.network.symbol}` : `${tb.balanceStr} ${tb.token?.symbol}`}
                  </Text>
                </View>
                <View style={styles.txAmounts}>
                  <ChevronRight color="rgba(255,255,255,0.3)" size={20} />
                </View>
              </HapticTouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0E' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 },
  balanceCard: { borderRadius: 20, padding: 20, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  iconBox: { backgroundColor: 'rgba(255,255,255,0.15)', padding: 10, borderRadius: 12 },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 42,
  },
  balanceText: { fontSize: 34, fontWeight: '800', color: 'white', lineHeight: 42 },
  eyeButton: { marginLeft: 8 },
  usdContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 4,
  },
  usdText: {
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    height: 20,
  },
  actionsContainer: { flexDirection: 'row', marginTop: 20, gap: 12 },
  actionButton: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, borderRadius: 14, gap: 8 },
  actionText: { color: 'white', fontWeight: '600', fontSize: 15 },
  activitiesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 14 },
  activitiesTitle: { color: 'white', fontWeight: '700', fontSize: 16 },
  txCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 12 },
  txIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  networkLogoContainer: { width: 40, height: 40, borderRadius: 20, marginRight: 16, justifyContent: 'center', alignItems: 'center' },
  networkLogo: { width: 40, height: 40, resizeMode: 'cover' },
  txInfo: { flex: 1 },
  txTitle: { color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  txSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  txAmounts: { alignItems: 'flex-end', justifyContent: 'center' },
  txDate: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  handleWrap: { alignItems: 'center', paddingVertical: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: 'white', marginBottom: 20, textAlign: 'center' },
  qrWrapper: { alignItems: 'center', alignSelf: 'center', marginBottom: 24, marginTop: 8 },
  addressLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  addressBox: { backgroundColor: 'rgba(168, 85, 247, 0.1)', borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.3)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  addressTextWrapper: { flex: 1 },
  addressText: { color: 'white', fontSize: 14, lineHeight: 20, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', textAlign: 'center' },
  copyButtonBox: { padding: 8, backgroundColor: 'rgba(168, 85, 247, 0.2)', borderRadius: 10 },
  warningBox: { backgroundColor: 'rgba(255, 165, 0, 0.1)', borderRadius: 12, padding: 16 },
  warningText: { color: 'orange', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  fieldLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 16, marginBottom: 20 },
  textInput: { flex: 1, paddingVertical: 16, color: 'white', fontSize: 15 },
  qrButton: { padding: 10, marginLeft: 4 },
  primaryButton: { backgroundColor: '#A855F7', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  primaryButtonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  closeButton: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  closeButtonText: { color: 'white', fontWeight: '600', fontSize: 15 },
  ghostButton: { paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  ghostButtonText: { color: 'rgba(255,255,255,0.45)', fontWeight: '500', fontSize: 15 },
  networkTypeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, marginRight: 10 },
  networkTypeBadgeSelected: { backgroundColor: 'rgba(255,255,255,0.1)' },
  networkTypeBadgeText: { fontWeight: '600', fontSize: 14 },
  badgeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
});
