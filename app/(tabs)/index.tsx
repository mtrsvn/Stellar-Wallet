import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { LineChart } from 'react-native-gifted-charts';
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    ArrowDownLeft,
    ArrowUpRight,
    Check,
    ChevronLeft,
    ChevronRight,
    Copy,
    Eye,
    EyeOff,
    ExternalLink,
    HelpCircle,
    Settings,
    User
} from "lucide-react-native";
import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
    useMemo
} from "react";
import {
    Dimensions,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
    ActivityIndicator,
    Image,
    DeviceEventEmitter,
    Linking
} from "react-native";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
    BottomSheet,
    handleStyle,
    sheetBaseStyle,
} from "../../src/components/BottomSheet";
import { HapticTouchableOpacity } from "../../src/components/HapticTouchableOpacity";
import { getNetworkIcon } from "../../src/components/NetworkIcons";
import { QRDisplay } from "../../src/components/QRDisplay";
import { SettingsSheet } from "../../src/components/SettingsSheet";
import { TokenListItem } from "../../src/components/TokenListItem";
import { WalletsSheet } from "../../src/components/WalletsSheet";
import { Transaction, useWallet } from "../../src/context/WalletContext";
import { getNetworkById, getNetworksByMode, Network } from "../../src/utils/networks";

type ChartPoint = {
  value: number;
  labelDate?: string;
  displayValue?: number;
};

const getTransactionExplorerUrl = (tx: Transaction | null, network?: Network) => {
  if (!tx?.hash || !network) return "";

  if (network.type === "SOL") {
    if (network.id === "solana-devnet") {
      return `https://explorer.solana.com/tx/${tx.hash}?cluster=devnet`;
    }
    return `https://solscan.io/tx/${tx.hash}`;
  }

  const explorerUrl = network.explorerUrl.replace(/\/$/, "");
  return `${explorerUrl}/tx/${tx.hash}`;
};

const ScrubTooltip = ({ items }: { items: any }) => {
  useEffect(() => {
    const item = items[0];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    DeviceEventEmitter.emit('onScrub', {
      value: item?.displayValue ?? item?.value,
      labelDate: item?.labelDate || null,
    });
    return () => {
      DeviceEventEmitter.emit('onScrub', { value: null, labelDate: null });
    };
  }, [items[0]?.displayValue, items[0]?.value]);

  // Render nothing — date is shown in header subtitle instead
  return null;
};

const DynamicBalanceText = ({ showBalances, defaultUsdValue }: { showBalances: boolean, defaultUsdValue: number }) => {
  const [scrubbed, setScrubbed] = useState<number | null>(null);
  
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onScrub', (payload) => {
      const val = payload?.value;
      if (val === null || val === undefined) {
        setScrubbed(null);
      } else {
        const num = Number(val);
        setScrubbed(isNaN(num) ? null : num);
      }
    });
    return () => sub.remove();
  }, []);

  const valToDisplay = (scrubbed !== null && !isNaN(scrubbed)) ? scrubbed : ((defaultUsdValue !== undefined && !isNaN(defaultUsdValue)) ? defaultUsdValue : 0);
  const displayUsdValue = Number(valToDisplay).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const displayUsdText = showBalances ? `$${displayUsdValue}` : "••••••";

  return <Text style={styles.balanceText}>{displayUsdText}</Text>;
};

const DynamicSubtitleText = ({ isTestnet }: { isTestnet: boolean }) => {
  const [scrubDate, setScrubDate] = useState<string | null>(null);
  
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onScrub', (payload) => {
      setScrubDate(payload?.labelDate || null);
    });
    return () => sub.remove();
  }, []);

  const text = scrubDate || (isTestnet ? 'Testnet Portfolio' : 'Total Portfolio Balance');

  return (
    <Text style={styles.usdText}>{text}</Text>
  );
};

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const wallet = useWallet();
  const handledScanIdRef = useRef<string | null>(null);
  
  const RANGE_OPTIONS = ['1D', '7D', '30D', '90D', '180D'] as const;
  const [chartRange, setChartRange] = useState<string>('30D');

  const chartData = useMemo<ChartPoint[]>(() => {
    let currentBal = wallet.totalUsdBalance || 0;
    if (isNaN(currentBal)) currentBal = 0;
    
    if (!wallet.transactions || wallet.transactions.length === 0) {
      return [{value: currentBal, labelDate: "Today"}, {value: currentBal, labelDate: "Today"}];
    }

    // Calculate cutoff date based on selected range
    const now = new Date();
    const rangeDays: Record<string, number> = { '1D': 1, '7D': 7, '30D': 30, '90D': 90, '180D': 180 };
    const cutoffMs = now.getTime() - (rangeDays[chartRange] || 30) * 24 * 60 * 60 * 1000;
    
    // Sort transactions by date descending (newest first)
    const allSortedTxs = [...wallet.transactions].sort((a, b) => {
      const timeA = a.dateTime ? new Date(a.dateTime).getTime() : 0;
      const timeB = b.dateTime ? new Date(b.dateTime).getTime() : 0;
      return timeB - timeA;
    });

    // Filter to only transactions within the selected range
    const sortedTxs = allSortedTxs.filter(tx => {
      if (!tx.dateTime) return true;
      const txTime = new Date(tx.dateTime).getTime();
      return !isNaN(txTime) && txTime >= cutoffMs;
    });

    const history: ChartPoint[] = [{ value: currentBal }];

    for (const tx of sortedTxs) {
      // parse amount from subtitle "1.5 SOL from..."
      const match = tx.subtitle?.match(/^([\d.]+)\s+([A-Za-z]+)/);
      let usdDelta = 0;
      if (match) {
         const amount = parseFloat(match[1]) || 0;
         const symbol = match[2].toUpperCase();
         const tokenInfo = wallet.tokenBalances?.find(b => (b.isNative ? b.network.symbol : b.token?.symbol)?.toUpperCase() === symbol);
         let price = 0;
         if (tokenInfo && tokenInfo.balanceValue > 0) {
           price = tokenInfo.usdValue / tokenInfo.balanceValue;
         } else {
           if (symbol === 'BTC') price = 60000;
           else if (symbol === 'ETH') price = 3000;
           else if (symbol === 'SOL') price = 150;
           else if (symbol === 'BNB') price = 600;
           else if (symbol.includes('USD')) price = 1;
         }
         usdDelta = amount * price;
      }
      if (isNaN(usdDelta)) usdDelta = 0;
      
      // If it was a receive (ArrowDownLeft), going backwards means we subtract
      if (tx.icon === 'ArrowDownLeft' || tx.amountColor === '#14F195') {
        currentBal -= usdDelta;
      } else {
        currentBal += usdDelta;
      }
      
      if (isNaN(currentBal) || currentBal < 0) currentBal = 0;
      
      let labelDate = "Unknown Date";
      if (tx.dateTime) {
        const d = new Date(tx.dateTime);
        if (!isNaN(d.getTime())) {
          const mm = (d.getMonth() + 1).toString().padStart(2, '0');
          const dd = d.getDate().toString().padStart(2, '0');
          const hh = d.getHours().toString().padStart(2, '0');
          const min = d.getMinutes().toString().padStart(2, '0');
          labelDate = `${mm}/${dd} ${hh}:${min}`;
        } else {
          // Fallback parser for cached legacy strings (e.g. "Jun 30, 2026, 3:00 PM")
          const match = tx.dateTime.match(/([a-zA-Z]+)\s+(\d+),\s+\d+,\s+(\d+):(\d+)\s+(AM|PM)/i);
          if (match) {
            const months: any = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
            const mm = (months[match[1].substring(0, 3).toLowerCase()] || 1).toString().padStart(2, '0');
            const dd = match[2].padStart(2, '0');
            let h = parseInt(match[3]);
            const isPM = match[5].toUpperCase() === 'PM';
            if (isPM && h < 12) h += 12;
            if (!isPM && h === 12) h = 0;
            const hh = h.toString().padStart(2, '0');
            const min = match[4].padStart(2, '0');
            labelDate = `${mm}/${dd} ${hh}:${min}`;
          } else {
            labelDate = tx.dateTime;
          }
        }
      } else if (tx.date) {
        labelDate = tx.date;
      }
      
      history.push({ value: currentBal, labelDate });
    }
    
    history.reverse();
    // Add "Today" to the latest (current) balance point
    if (history.length > 0) {
       const d = new Date();
       const mm = (d.getMonth() + 1).toString().padStart(2, '0');
       const dd = d.getDate().toString().padStart(2, '0');
       const hh = d.getHours().toString().padStart(2, '0');
       const min = d.getMinutes().toString().padStart(2, '0');
       history[history.length - 1].labelDate = `${mm}/${dd} ${hh}:${min}`;
    }
    return history;
  }, [wallet.transactions, wallet.totalUsdBalance, wallet.tokenBalances, chartRange]);

  const isZeroBalanceChart = chartData.every(d => d.value === 0);
  const visibleChartData = useMemo(() => {
    if (!isZeroBalanceChart) return chartData;

    return chartData.map((point) => ({
      ...point,
      value: 0.5,
      displayValue: 0,
    }));
  }, [chartData, isZeroBalanceChart]);

  const searchParams = useLocalSearchParams<{
    scannedAddress?: string;
    scanId?: string;
  }>();

  const [showBalances, setShowBalances] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [receiveVisible, setReceiveVisible] = useState(false);
  const [receiveQrVisible, setReceiveQrVisible] = useState(false);
  const [sendVisible, setSendVisible] = useState(false);
  const [walletsVisible, setWalletsVisible] = useState(false);
  const [sendToAddress, setSendToAddress] = useState("");
  const [addressCopied, setAddressCopied] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [txHashCopied, setTxHashCopied] = useState(false);
  const addressCopiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const txHashCopiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openReceiveQrAfterCloseRef = useRef(false);
  const reopenReceiveAfterQrCloseRef = useRef(false);

  const [receiveNetworkId, setReceiveNetworkId] = useState<string>("");
  const receiveNetworks = useMemo(
    () => getNetworksByMode(wallet.isTestnet),
    [wallet.isTestnet],
  );

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

    if (!scannedAddress || !scanId || handledScanIdRef.current === scanId)
      return;

    handledScanIdRef.current = scanId;
    setSendToAddress(scannedAddress);
    setSendVisible(true);
  }, [searchParams.scannedAddress, searchParams.scanId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await wallet.refreshData();
    setRefreshing(false);
  }, [wallet]);

  const selectedReceiveNetwork = receiveNetworks.find(
    (network) => network.id === receiveNetworkId,
  );

  const getReceiveAddress = () => {
    if (!selectedReceiveNetwork) return "";
    if (selectedReceiveNetwork.type === "EVM") return wallet.evmAddress;
    if (selectedReceiveNetwork.type === "BTC") return wallet.btcAddress;
    if (selectedReceiveNetwork.type === "SOL") return wallet.solAddress;
    return "";
  };

  const currentReceiveAddress = getReceiveAddress();
  const selectedTxNetwork = selectedTx?.networkId
    ? getNetworkById(selectedTx.networkId)
    : undefined;
  const selectedTxExplorerUrl = getTransactionExplorerUrl(selectedTx, selectedTxNetwork);
  const selectedTxIsSent = selectedTx?.icon === "ArrowUpRight" || selectedTx?.delta === "-";
  const selectedTxCounterpartyLabel = selectedTxIsSent ? "To" : "From";
  const selectedTxCounterpartyValue = selectedTxIsSent
    ? selectedTx?.to || selectedTx?.from || "Unknown"
    : selectedTx?.from || selectedTx?.to || "Unknown";

  useEffect(() => {
    setAddressCopied(false);
  }, [currentReceiveAddress]);

  useEffect(() => {
    setTxHashCopied(false);
  }, [selectedTx?.hash]);

  useEffect(() => {
    return () => {
      if (addressCopiedTimeoutRef.current) {
        clearTimeout(addressCopiedTimeoutRef.current);
      }
      if (txHashCopiedTimeoutRef.current) {
        clearTimeout(txHashCopiedTimeoutRef.current);
      }
    };
  }, []);

  const copyWalletAddress = useCallback(async () => {
    if (!currentReceiveAddress) return;
    await Clipboard.setStringAsync(currentReceiveAddress);
    setAddressCopied(true);
    if (addressCopiedTimeoutRef.current) {
      clearTimeout(addressCopiedTimeoutRef.current);
    }
    addressCopiedTimeoutRef.current = setTimeout(() => {
      setAddressCopied(false);
    }, 1800);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [currentReceiveAddress]);

  const copyTransactionHash = useCallback(async () => {
    if (!selectedTx?.hash) return;
    await Clipboard.setStringAsync(selectedTx.hash);
    setTxHashCopied(true);
    if (txHashCopiedTimeoutRef.current) {
      clearTimeout(txHashCopiedTimeoutRef.current);
    }
    txHashCopiedTimeoutRef.current = setTimeout(() => {
      setTxHashCopied(false);
    }, 1800);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [selectedTx?.hash]);

  const openTransactionExplorer = useCallback(async () => {
    if (!selectedTxExplorerUrl) return;
    await Linking.openURL(selectedTxExplorerUrl);
  }, [selectedTxExplorerUrl]);

  const openQrScanner = useCallback(() => {
    setSendVisible(false);
    router.push("/scan");
  }, [router]);

  const displayUsdValue = wallet.totalUsdBalance.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const displayUsdText = showBalances ? `$${displayUsdValue}` : "••••••";

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="white"
          />
        }
      >
        <LinearGradient
          colors={["#9C2CF0", "#7A19D9"]}
          style={styles.balanceCard}
        >
          <View style={styles.cardHeader}>
            <HapticTouchableOpacity
              onPress={() => setWalletsVisible(true)}
              style={styles.iconBox}
            >
              <User size={20} color="rgba(255,255,255,0.7)" />
            </HapticTouchableOpacity>
            <HapticTouchableOpacity
              onPress={() => setSettingsVisible(true)}
              style={styles.iconBox}
            >
              <Settings size={20} color="rgba(255,255,255,0.7)" />
            </HapticTouchableOpacity>
          </View>

          <View style={styles.balanceContainer}>
            {wallet.isBalanceLoading ? (
              <Text style={styles.balanceText}>...</Text>
            ) : (
              <DynamicBalanceText showBalances={showBalances} defaultUsdValue={wallet.totalUsdBalance} />
            )}
            <HapticTouchableOpacity
              onPress={() => setShowBalances(!showBalances)}
              style={styles.eyeButton}
            >
              {showBalances ? (
                <EyeOff size={20} color="rgba(255,255,255,0.7)" />
              ) : (
                <Eye size={20} color="rgba(255,255,255,0.7)" />
              )}
            </HapticTouchableOpacity>
          </View>

          <View style={styles.usdContainer}>
            <DynamicSubtitleText isTestnet={wallet.isTestnet} />
          </View>

          <View
            style={{
              marginLeft: -36,
              marginTop: 16,
              marginBottom: 16,
              width: Dimensions.get("window").width + 48,
              height: 80,
              overflow: 'hidden',
            }}
          >
            <LineChart
              data={visibleChartData}
              width={Dimensions.get("window").width}
              height={80}
              thickness={2}
              color="white"
              hideDataPoints
              hideRules
              hideYAxisText
              hideAxesAndRules
              isAnimated
              initialSpacing={0}
              endSpacing={0}
              adjustToWidth={true}
              yAxisOffset={0}
              mostNegativeValue={-1}
              maxValue={isZeroBalanceChart ? 1 : undefined}
              pointerConfig={{
                activatePointersOnLongPress: false,
                activatePointersDelay: 0,
                pointerStripWidth: 0,
                pointerStripColor: 'transparent',
                pointerColor: 'white',
                radius: 4,
                pointerLabelWidth: 100,
                pointerLabelHeight: 30,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent: (items: any) => <ScrubTooltip items={items} />,
              }}
            />
          </View>

          <View style={styles.rangeContainer}>
            {RANGE_OPTIONS.map((r) => (
              <HapticTouchableOpacity
                key={r}
                style={[
                  styles.rangeButton,
                  chartRange === r && styles.rangeButtonActive,
                ]}
                onPress={() => setChartRange(r)}
              >
                <Text
                  style={[
                    styles.rangeButtonText,
                    chartRange === r && styles.rangeButtonTextActive,
                  ]}
                >
                  {r.toLowerCase()}
                </Text>
              </HapticTouchableOpacity>
            ))}
          </View>

          <View style={styles.actionsContainer}>
            <HapticTouchableOpacity
              style={styles.actionButton}
              onPress={() => setSendVisible(true)}
            >
              <ArrowUpRight size={16} color="white" />
              <Text style={styles.actionText}>Send</Text>
            </HapticTouchableOpacity>
            <HapticTouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                openReceiveQrAfterCloseRef.current = false;
                reopenReceiveAfterQrCloseRef.current = false;
                setReceiveQrVisible(false);
                setReceiveNetworkId("");
                setReceiveVisible(true);
              }}
            >
              <ArrowDownLeft size={16} color="white" />
              <Text style={styles.actionText}>Receive</Text>
            </HapticTouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.activitiesHeader}>
          <Text style={styles.activitiesTitle}>Your Assets</Text>
        </View>

        {wallet.isBalanceLoading ? (
          <ActivityIndicator size="small" color="#A855F7" style={{ marginVertical: 20 }} />
        ) : wallet.tokenBalances && wallet.tokenBalances.length === 0 ? (
          <Text style={{ color: "rgba(255,255,255,0.7)", textAlign: "center" }}>
            No assets found
          </Text>
        ) : (
          wallet.tokenBalances?.slice(0, 5).map((tb, idx) => {
            return (
              <View key={tb.id}>
                <TokenListItem item={tb} hideBalance={!showBalances} />
              </View>
            );
          })
        )}

        <View style={styles.activitiesHeader}>
          <Text style={styles.activitiesTitle}>Recent Transactions</Text>
        </View>

        {wallet.isTransactionsLoading ? (
          <ActivityIndicator size="small" color="#A855F7" style={{ marginVertical: 20 }} />
        ) : wallet.transactions.length === 0 ? (
          <Text style={{ color: "rgba(255,255,255,0.7)", textAlign: "center" }}>
            No recent transactions
          </Text>
        ) : (
          wallet.transactions.slice(0, 5).map((tx, idx) => {
            let IconComponent = HelpCircle;
            if (tx.icon === "ArrowDownLeft") IconComponent = ArrowDownLeft;
            if (tx.icon === "ArrowUpRight") IconComponent = ArrowUpRight;

            return (
              <HapticTouchableOpacity
                key={idx}
                style={styles.txCard}
                onPress={() => setSelectedTx(tx)}
              >
                <View style={styles.txIconBox}>
                  <IconComponent color="white" size={20} />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txTitle}>{tx.title}</Text>
                  <Text style={styles.txSubtitle} numberOfLines={1}>
                    {showBalances ? tx.subtitle : "••••"}
                  </Text>
                </View>
                <View style={styles.txAmounts}>
                  <Text style={styles.txDate}>{tx.date}</Text>
                </View>
              </HapticTouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <SettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onLogoutSuccess={() => router.replace("/welcome" as any)}
      />
      <WalletsSheet
        visible={walletsVisible}
        onClose={() => setWalletsVisible(false)}
      />

      <BottomSheet
        visible={receiveVisible}
        onClose={() => {
          setReceiveVisible(false);
          if (!openReceiveQrAfterCloseRef.current) {
            setReceiveNetworkId("");
          }
        }}
        onDismiss={() => {
          if (!openReceiveQrAfterCloseRef.current) return;
          openReceiveQrAfterCloseRef.current = false;
          setReceiveQrVisible(true);
        }}
      >
        <View
          style={[
            sheetBaseStyle,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={handleStyle as any} />
          </View>

          <Text style={styles.sheetTitle}>Choose Network</Text>

          <View style={{ marginTop: 12, marginBottom: -12 }}>
            {receiveNetworks.map((network) => (
                <HapticTouchableOpacity
                  key={network.id}
                  style={styles.txCard}
                  onPress={() => {
                    setReceiveNetworkId(network.id);
                    openReceiveQrAfterCloseRef.current = true;
                    setReceiveVisible(false);
                  }}
                >
                  <View style={styles.networkLogoContainer}>
                    {getNetworkIcon(network.symbol, 40) || (
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: network.color,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: "white", fontWeight: "bold" }}>
                          {network.symbol[0]}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={[styles.txTitle, { marginBottom: 0 }]}>
                      {network.name}
                    </Text>
                  </View>
                  <View style={styles.txAmounts}>
                    <ChevronRight color="rgba(255,255,255,0.3)" size={20} />
                  </View>
                </HapticTouchableOpacity>
              ))}
          </View>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={receiveQrVisible}
        onClose={() => {
          setReceiveQrVisible(false);
          if (!reopenReceiveAfterQrCloseRef.current) {
            setReceiveNetworkId("");
          }
        }}
        onDismiss={() => {
          if (!reopenReceiveAfterQrCloseRef.current) return;
          reopenReceiveAfterQrCloseRef.current = false;
          setReceiveVisible(true);
        }}
      >
        <View
          style={[
            sheetBaseStyle,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={handleStyle as any} />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <HapticTouchableOpacity
              onPress={() => {
                reopenReceiveAfterQrCloseRef.current = true;
                setReceiveQrVisible(false);
              }}
              style={{ padding: 8 }}
            >
              <ChevronLeft size={24} color="white" />
            </HapticTouchableOpacity>
            <Text style={[styles.sheetTitle, { marginBottom: 0 }]}>
              Receive {selectedReceiveNetwork?.symbol}
            </Text>
            <View style={{ width: 34 }} />
          </View>

          <View style={styles.qrWrapper}>
            <View
              style={{
                padding: 12,
                backgroundColor: "white",
                borderRadius: 24,
              }}
            >
              <QRDisplay
                address={
                  currentReceiveAddress ? currentReceiveAddress : "loading"
                }
              />
            </View>
          </View>

          <Text style={styles.addressLabel}>
            Your {selectedReceiveNetwork?.name || ""} Address
          </Text>

          <HapticTouchableOpacity
            style={styles.addressBox}
            onPress={copyWalletAddress}
            disabled={!currentReceiveAddress}
            activeOpacity={0.7}
          >
            <View style={styles.addressTextWrapper}>
              <Text
                style={styles.addressText}
                numberOfLines={2}
                ellipsizeMode="middle"
              >
                {currentReceiveAddress || "No address yet"}
              </Text>
            </View>
            <View
              style={[
                styles.copyButtonBox,
                addressCopied && styles.copyButtonBoxCopied,
              ]}
            >
              {addressCopied ? (
                <Check size={20} color="#14F195" />
              ) : (
                <Copy
                  size={20}
                  color={
                    currentReceiveAddress ? "#A855F7" : "rgba(255,255,255,0.35)"
                  }
                />
              )}
            </View>
          </HapticTouchableOpacity>
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Warning: Only send assets on the {selectedReceiveNetwork?.name || 'Stellar'} network to this address.
              Sending assets on other networks will result in permanent loss.
            </Text>
          </View>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={!!selectedTx}
        onClose={() => {
          setSelectedTx(null);
          setTxHashCopied(false);
        }}
      >
        <View
          style={[
            sheetBaseStyle,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={handleStyle as any} />
          </View>

          <Text style={styles.sheetTitle}>Transaction Details</Text>

          <View style={styles.txDetailHeader}>
            <View style={styles.txIconBox}>
              {selectedTx?.icon === "ArrowUpRight" ? (
                <ArrowUpRight color="white" size={20} />
              ) : selectedTx?.icon === "ArrowDownLeft" ? (
                <ArrowDownLeft color="white" size={20} />
              ) : (
                <HelpCircle color="white" size={20} />
              )}
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txTitle}>{selectedTx?.title || "Transaction"}</Text>
              <Text style={styles.txSubtitle} numberOfLines={1}>
                {selectedTx?.subtitle || selectedTx?.amount || "No amount details"}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {selectedTx?.hash ? "Confirmed" : "Pending"}
              </Text>
            </View>
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Network</Text>
              <Text style={styles.detailValue}>
                {selectedTxNetwork?.name || selectedTx?.networkId || "Unknown"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>
                {selectedTx?.dateTime || selectedTx?.date || "Unknown"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={[styles.detailValue, { color: selectedTx?.amountColor || "white" }]}>
                {selectedTx?.amount || selectedTx?.subtitle || "--"}
              </Text>
            </View>
            <View style={[styles.detailRow, styles.detailRowLast]}>
              <Text style={styles.detailLabel}>{selectedTxCounterpartyLabel}</Text>
              <Text style={styles.detailValue} numberOfLines={1} ellipsizeMode="middle">
                {selectedTxCounterpartyValue}
              </Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>TRANSACTION HASH</Text>
          <HapticTouchableOpacity
            style={styles.hashBox}
            onPress={copyTransactionHash}
            disabled={!selectedTx?.hash}
            activeOpacity={0.7}
          >
            <Text style={styles.hashText} numberOfLines={1} ellipsizeMode="middle">
              {selectedTx?.hash || "No hash available yet"}
            </Text>
            <View
              style={[
                styles.copyButtonBox,
                txHashCopied && styles.copyButtonBoxCopied,
              ]}
            >
              {txHashCopied ? (
                <Check size={18} color="#14F195" />
              ) : (
                <Copy
                  size={18}
                  color={selectedTx?.hash ? "#A855F7" : "rgba(255,255,255,0.35)"}
                />
              )}
            </View>
          </HapticTouchableOpacity>

          <HapticTouchableOpacity
            style={[
              styles.detailActionButton,
              !selectedTxExplorerUrl && styles.detailActionButtonDisabled,
            ]}
            onPress={openTransactionExplorer}
            disabled={!selectedTxExplorerUrl}
          >
            <ExternalLink
              size={18}
              color={selectedTxExplorerUrl ? "white" : "rgba(255,255,255,0.35)"}
            />
            <Text
              style={[
                styles.detailActionText,
                !selectedTxExplorerUrl && styles.detailActionTextDisabled,
              ]}
            >
              View on Explorer
            </Text>
          </HapticTouchableOpacity>
        </View>
      </BottomSheet>

      <BottomSheet visible={sendVisible} onClose={() => setSendVisible(false)}>
        <View
          style={[
            sheetBaseStyle,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={handleStyle as any} />
          </View>
          <Text style={styles.sheetTitle}>Select Asset to Send</Text>

          <ScrollView
            style={{ maxHeight: 400, marginTop: 12, marginBottom: -12 }}
          >
            {wallet.tokenBalances
              ?.filter((tb) => Number(tb.balanceValue) > 0)
              .map((tb) => {
                const mainSymbol = tb.isNative ? tb.network.symbol : tb.token?.symbol || 'UNK';
                const mainName = tb.isNative ? tb.network.name : tb.token?.name || 'Unknown Token';
                return (
                <HapticTouchableOpacity
                  key={tb.id}
                  style={styles.txCard}
                  onPress={() => {
                    setSendVisible(false);
                    router.push({
                      pathname: "/send",
                      params: { assetId: tb.id, to: sendToAddress },
                    } as any);
                  }}
                >
                  <View style={styles.networkLogoContainer}>
                    {tb.isNative ? (
                      getNetworkIcon(tb.network.symbol, 40) || (
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: tb.network.color, justifyContent: "center", alignItems: "center" }}>
                          <Text style={{ color: "white", fontWeight: "bold" }}>{mainSymbol[0]}</Text>
                        </View>
                      )
                    ) : (
                      tb.token?.logoUrl ? (
                        <Image source={{ uri: tb.token.logoUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                      ) : (
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', justifyContent: "center", alignItems: "center" }}>
                          <Text style={{ color: "white", fontWeight: "bold" }}>{mainSymbol[0]}</Text>
                        </View>
                      )
                    )}
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={[styles.txTitle, { marginBottom: 0 }]}>
                      {mainName}
                    </Text>
                  </View>
                  <View style={styles.txAmounts}>
                    <ChevronRight color="rgba(255,255,255,0.3)" size={20} />
                  </View>
                </HapticTouchableOpacity>
              )})}
          </ScrollView>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0E" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 },
  balanceCard: { borderRadius: 20, padding: 20, overflow: "hidden" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  iconBox: {
    backgroundColor: "rgba(255,255,255,0.15)",
    padding: 10,
    borderRadius: 12,
  },
  balanceContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    minHeight: 42,
  },
  balanceText: {
    fontSize: 34,
    fontWeight: "800",
    color: "white",
    lineHeight: 42,
  },
  eyeButton: { marginLeft: 8 },
  usdContainer: {
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: 4,
  },
  usdText: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    height: 20,
  },
  actionsContainer: { flexDirection: "row", marginTop: 20, gap: 12 },
  actionButton: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  actionText: { color: "white", fontWeight: "600", fontSize: 15 },
  activitiesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 14,
  },
  activitiesTitle: { color: "white", fontWeight: "700", fontSize: 16 },
  txCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  txIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  networkLogoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  networkLogo: { width: 40, height: 40, resizeMode: "cover" },
  txInfo: { flex: 1 },
  txTitle: { color: "white", fontSize: 16, fontWeight: "600", marginBottom: 4 },
  txSubtitle: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  txAmounts: { alignItems: "flex-end", justifyContent: "center" },
  txDate: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  txDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statusPill: {
    backgroundColor: "rgba(20, 241, 149, 0.12)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    color: "#14F195",
    fontSize: 12,
    fontWeight: "700",
  },
  detailCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    paddingVertical: 14,
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontWeight: "600",
  },
  detailValue: {
    flex: 1,
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
  hashBox: {
    backgroundColor: "rgba(168, 85, 247, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  hashText: {
    flex: 1,
    color: "white",
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  detailActionButton: {
    backgroundColor: "#A855F7",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  detailActionButtonDisabled: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  detailActionText: { color: "white", fontWeight: "700", fontSize: 15 },
  detailActionTextDisabled: { color: "rgba(255,255,255,0.35)" },
  handleWrap: { alignItems: "center", paddingVertical: 12 },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "white",
    marginBottom: 20,
    textAlign: "center",
  },
  qrWrapper: {
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 24,
    marginTop: 8,
  },
  addressLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  addressBox: {
    backgroundColor: "rgba(168, 85, 247, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  addressTextWrapper: { flex: 1 },
  addressText: {
    color: "white",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    textAlign: "center",
  },
  copyButtonBox: {
    minWidth: 36,
    minHeight: 36,
    backgroundColor: "rgba(168, 85, 247, 0.2)",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  copyButtonBoxCopied: {
    backgroundColor: "rgba(20, 241, 149, 0.14)",
    borderColor: "rgba(20, 241, 149, 0.35)",
  },
  warningBox: {
    backgroundColor: "rgba(255, 165, 0, 0.1)",
    borderRadius: 12,
    padding: 16,
  },
  warningText: {
    color: "orange",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  fieldLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  textInput: { flex: 1, paddingVertical: 16, color: "white", fontSize: 15 },
  qrButton: { padding: 10, marginLeft: 4 },
  primaryButton: {
    backgroundColor: "#A855F7",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonText: { color: "white", fontWeight: "700", fontSize: 16 },
  closeButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  closeButtonText: { color: "white", fontWeight: "600", fontSize: 15 },
  ghostButton: { paddingVertical: 16, alignItems: "center", marginTop: 4 },
  ghostButtonText: {
    color: "rgba(255,255,255,0.45)",
    fontWeight: "500",
    fontSize: 15,
  },
  networkTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    marginRight: 10,
  },
  networkTypeBadgeSelected: { backgroundColor: "rgba(255,255,255,0.1)" },
  networkTypeBadgeText: { fontWeight: "600", fontSize: 14 },
  badgeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  rangeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  rangeButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  rangeButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  rangeButtonText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
  },
  rangeButtonTextActive: {
    color: 'white',
  },
});
