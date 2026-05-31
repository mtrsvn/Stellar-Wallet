import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Wallet, Settings, Eye, EyeOff, ArrowUpRight, ArrowDownLeft, Copy, QrCode, HelpCircle } from 'lucide-react-native';
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
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheet, handleStyle, sheetBaseStyle } from '../src/components/BottomSheet';
import { QRDisplay } from '../src/components/QRDisplay';
import { SettingsSheet } from '../src/components/SettingsSheet';
import { WalletsSheet } from '../src/components/WalletsSheet';
import { useWallet } from '../src/context/WalletContext';
import { PriceService } from '../src/services/PriceService';
import { formatDateTime } from '../src/utils/formatDateTime';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const wallet = useWallet();
  const handledScanIdRef = useRef<string | null>(null);
  const searchParams = useLocalSearchParams<{ scannedAddress?: string; scanId?: string }>();

  const [showBalances, setShowBalances] = useState(true);
  const [ethPriceUsd, setEthPriceUsd] = useState(PriceService.fallbackEthUsd);


  const [refreshing, setRefreshing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [receiveVisible, setReceiveVisible] = useState(false);
  const [sendVisible, setSendVisible] = useState(false);
  const [walletsVisible, setWalletsVisible] = useState(false);
  const [sendToAddress, setSendToAddress] = useState('');
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const scrubIndexRef = useRef<number | null>(null);

  const handleScrub = useCallback((evt: any) => {
    const x = evt.nativeEvent.locationX;
    const cardWidth = Dimensions.get('window').width - 32;
    const segmentWidth = cardWidth / 6;
    let idx = Math.round(x / segmentWidth);
    if (idx < 0) idx = 0;
    if (idx > 6) idx = 6;
    
    if (scrubIndexRef.current !== idx) {
      Haptics.selectionAsync();
      scrubIndexRef.current = idx;
      setScrubIndex(idx);
    }
  }, []);

  const handleScrubStart = useCallback((evt: any) => {
    setIsScrubbing(true);
    handleScrub(evt);
  }, [handleScrub]);

  const clearScrub = useCallback(() => {
    setIsScrubbing(false);
    if (scrubIndexRef.current !== null) {
      Haptics.selectionAsync(); // Vibrate slightly when snapping back to current balance
      scrubIndexRef.current = null;
      setScrubIndex(null);
    }
  }, []);

  const nowLabel = useMemo(() => formatDateTime(new Date()), []);

  const { sparklineData, sparklineDates } = useMemo(() => {
    const ethAmountStr = wallet.balance ? wallet.balance.split(' ')[0] : '0.0';
    let currentBal = parseFloat(ethAmountStr) || 0.0;

    const flatData = [currentBal, currentBal, currentBal, currentBal, currentBal, currentBal, currentBal];
    const flatDates = [nowLabel, nowLabel, nowLabel, nowLabel, nowLabel, nowLabel, nowLabel];

    if (!wallet.transactions || wallet.transactions.length === 0) {
      return { sparklineData: flatData, sparklineDates: flatDates };
    }

    const history = [currentBal];
    const dates = [nowLabel];

    for (let i = 0; i < Math.min(wallet.transactions.length, 6); i++) {
      const tx = wallet.transactions[i];
      const valStr = tx.subtitle.split(' ')[0];
      const val = parseFloat(valStr) || 0;

      if (tx.title === 'Sent ETH') {
        currentBal = currentBal + val;
      } else if (tx.title === 'Received ETH') {
        currentBal = currentBal - val;
      }
      history.push(Math.max(0, currentBal));
      dates.push(tx.dateTime ?? tx.date);
    }

    while (history.length < 7) {
      history.push(history[history.length - 1]);
      dates.push(dates[dates.length - 1]);
    }

    return {
      sparklineData: history.reverse(),
      sparklineDates: dates.reverse(),
    };
  }, [wallet.balance, wallet.transactions, nowLabel]);

  useEffect(() => {
    loadPrice();
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

  const loadPrice = async () => {
    const price = await PriceService.fetchEthUsd();
    setEthPriceUsd(price);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await wallet.refreshData();
    await loadPrice();
    setRefreshing(false);
  }, [wallet]);

  const copyWalletAddress = useCallback(async () => {
    if (!wallet.address) return;

    await Clipboard.setStringAsync(wallet.address);
  }, [wallet.address]);

  const openQrScanner = useCallback(() => {
    setSendVisible(false);
    router.push('/scan');
  }, [router]);

  const ethAmountStr = wallet.balance ? wallet.balance.split(' ')[0] : '0.0';
  const ethAmount = parseFloat(ethAmountStr) || 0.0;
  const displayBalance = wallet.balance || '0.000000 ETH';

  const currentScrubValue = scrubIndex !== null && showBalances && sparklineData[scrubIndex] !== undefined
    ? sparklineData[scrubIndex]
    : null;

  const displayBalanceText = currentScrubValue !== null 
    ? `${currentScrubValue.toFixed(4)} ETH` 
    : (showBalances ? displayBalance : '••••••');

  const displayUsdValue = currentScrubValue !== null 
    ? (currentScrubValue * ethPriceUsd).toFixed(2)
    : (ethAmount * ethPriceUsd).toFixed(2);
    
  const displayUsdText = showBalances ? `$${displayUsdValue}` : '**';

  const scrubDateLabel =
    scrubIndex !== null && sparklineDates[scrubIndex] !== undefined ? sparklineDates[scrubIndex] : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={!isScrubbing}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="white" />}
      >
        <LinearGradient colors={['#9C2CF0', '#7A19D9']} style={styles.balanceCard}>
          <View style={styles.cardHeader}>
            <TouchableOpacity onPress={() => setWalletsVisible(true)} style={styles.iconBox}>
              <Wallet size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.iconBox}>
              <Settings size={20} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.balanceContainer}>
            {wallet.isBalanceLoading ? (
              <Text style={styles.balanceText}>...</Text>
            ) : (
              <Text style={styles.balanceText}>{displayBalanceText}</Text>
            )}
            <TouchableOpacity onPress={() => setShowBalances(!showBalances)} style={styles.eyeButton}>
              {showBalances ? (
                <EyeOff size={20} color="rgba(255,255,255,0.7)" />
              ) : (
                <Eye size={20} color="rgba(255,255,255,0.7)" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.usdContainer}>
            <Text style={styles.usdText}>{displayUsdText}</Text>
            <Text
              style={[styles.scrubDateText, !scrubDateLabel && styles.scrubDateHidden]}
              numberOfLines={1}
            >
              {scrubDateLabel ?? '\u00A0'}
            </Text>
          </View>

          <View style={{ marginLeft: -36, marginTop: 16, marginBottom: 16, width: Dimensions.get('window').width + 48 }}>
            {showBalances ? (
              <LineChart
                data={{
                  labels: ["", "", "", "", "", "", ""],
                  datasets: [{ data: showBalances ? sparklineData : [5, 5, 5, 5, 5, 5, 5] }]
                }}
                width={Dimensions.get('window').width + 48} // Precisely calculated to hide internal padding
                height={60} 
                withDots={false}
                withInnerLines={false}
                withOuterLines={false}
                withVerticalLines={false}
                withHorizontalLines={false}
                withHorizontalLabels={false}
                withVerticalLabels={false}
                withShadow={false}
                chartConfig={{
                  backgroundColor: 'transparent',
                  backgroundGradientFrom: '#9C2CF0',
                  backgroundGradientFromOpacity: 0,
                  backgroundGradientTo: '#7A19D9',
                  backgroundGradientToOpacity: 0,
                  color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  strokeWidth: 3,
                  propsForBackgroundLines: { strokeWidth: 0 },
                  fillShadowGradientFrom: '#FFFFFF',
                  fillShadowGradientFromOpacity: 0.4,
                  fillShadowGradientTo: '#FFFFFF',
                  fillShadowGradientToOpacity: 0.0,
                }}
                bezier
                style={{
                  paddingRight: 0,
                  paddingBottom: 10,
                  paddingTop: 10,
                }}
              />
            ) : (
              <View style={{ height: 60, justifyContent: 'center' }}>
                <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.7)', width: Dimensions.get('window').width }} />
              </View>
            )}
            
            {showBalances && (
              <View 
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 16, // Precisely align touch zone with the drawn SVG line start
                  width: Dimensions.get('window').width - 32, // Exact card width
                }}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={handleScrubStart}
                onResponderMove={handleScrub}
                onResponderRelease={clearScrub}
                onResponderTerminate={clearScrub}
              />
            )}
          </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={() => setSendVisible(true)}>
              <ArrowUpRight size={16} color="white" />
              <Text style={styles.actionText}>Send</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => setReceiveVisible(true)}>
              <ArrowDownLeft size={16} color="white" />
              <Text style={styles.actionText}>Receive</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.activitiesHeader}>
          <Text style={styles.activitiesTitle}>Recent Activities</Text>
          <TouchableOpacity onPress={() => router.push('/activities' as any)}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {wallet.isTransactionsLoading ? (
          <Text style={{ color: 'white', textAlign: 'center' }}>Loading...</Text>
        ) : wallet.transactions.length === 0 ? (
          <Text style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>No recent activities</Text>
        ) : (
          wallet.transactions.slice(0, 10).map((tx, idx) => {
            let IconComponent = HelpCircle;
            if (tx.icon === 'ArrowDownLeft') IconComponent = ArrowDownLeft;
            if (tx.icon === 'ArrowUpRight') IconComponent = ArrowUpRight;

            return (
              <TouchableOpacity key={idx} style={styles.txCard}>
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
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <SettingsSheet visible={settingsVisible} onClose={() => setSettingsVisible(false)} onLogoutSuccess={() => router.replace('/welcome' as any)} />
      <WalletsSheet visible={walletsVisible} onClose={() => setWalletsVisible(false)} />

      <BottomSheet visible={receiveVisible} onClose={() => setReceiveVisible(false)}>
        <View style={[sheetBaseStyle, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.handleWrap}><View style={handleStyle as any} /></View>
          <Text style={styles.sheetTitle}>Receive ETH</Text>

          <View style={styles.qrWrapper}>
            <QRDisplay address={wallet.address ? wallet.address : 'loading'} />
          </View>

          <Text style={styles.addressLabel}>Your Wallet Address</Text>
          <View style={styles.addressBox}>
            <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="middle" selectable>
              {wallet.address || 'No address yet'}
            </Text>
            <TouchableOpacity style={styles.copyButton} onPress={copyWalletAddress} disabled={!wallet.address}>
              <Copy size={16} color={wallet.address ? 'white' : 'rgba(255,255,255,0.35)'} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={() => setReceiveVisible(false)}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      <BottomSheet visible={sendVisible} onClose={() => setSendVisible(false)} avoidKeyboard>
        <View style={[sheetBaseStyle, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.handleWrap}><View style={handleStyle as any} /></View>
          <Text style={styles.sheetTitle}>Send ETH</Text>

          <Text style={styles.fieldLabel}>Recipient Address</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="0x..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={sendToAddress}
              onChangeText={setSendToAddress}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.qrButton} onPress={openQrScanner}>
              <QrCode size={20} color="white" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={() => {
            setSendVisible(false);
            if (sendToAddress.trim()) {
              router.push({ pathname: '/send', params: { to: sendToAddress.trim() } } as any);
            }
          }}>
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={() => setSendVisible(false)}>
            <Text style={styles.ghostButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1D1E' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
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
    height: 52,
  },
  usdText: {
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    height: 20,
  },
  scrubDateText: {
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
    height: 16,
    marginTop: 8,
    width: '100%',
    paddingHorizontal: 8,
  },
  scrubDateHidden: { opacity: 0 },
  actionsContainer: { flexDirection: 'row', marginTop: 20, gap: 12 },
  actionButton: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, borderRadius: 14, gap: 8 },
  actionText: { color: 'white', fontWeight: '600', fontSize: 15 },
  activitiesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 14 },
  activitiesTitle: { color: 'white', fontWeight: '700', fontSize: 16 },
  viewAllText: { color: '#9C2CF0', fontWeight: '600' },
  txCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 12 },
  txIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  txInfo: { flex: 1 },
  txTitle: { color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  txSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  txAmounts: { alignItems: 'flex-end', justifyContent: 'center' },
  txDate: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  handleWrap: { alignItems: 'center', paddingVertical: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: 'white', marginBottom: 20, textAlign: 'center' },
  qrWrapper: { alignItems: 'center', backgroundColor: 'white', alignSelf: 'center', borderRadius: 20, padding: 16, marginBottom: 20 },
  addressLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 },
  addressBox: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  addressText: { flex: 1, minWidth: 0, color: 'white', fontSize: 13, lineHeight: 18, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  copyButton: { padding: 6 },
  fieldLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 16, marginBottom: 20 },
  textInput: { flex: 1, paddingVertical: 16, color: 'white', fontSize: 15 },
  qrButton: { padding: 10, marginLeft: 4 },
  primaryButton: { backgroundColor: '#9C2CF0', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  primaryButtonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  closeButton: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  closeButtonText: { color: 'white', fontWeight: '600', fontSize: 15 },
  ghostButton: { paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  ghostButtonText: { color: 'rgba(255,255,255,0.45)', fontWeight: '500', fontSize: 15 },
});
