import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Linking, Platform, RefreshControl, StyleSheet, Text, View, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowDownLeft, ArrowUpRight, Check, Copy, ExternalLink, HelpCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BottomSheet,
  handleStyle,
  sheetBaseStyle,
} from '../../src/components/BottomSheet';
import { HapticTouchableOpacity } from '../../src/components/HapticTouchableOpacity';
import { Transaction, useWallet } from '../../src/context/WalletContext';
import { getNetworkById, Network } from '../../src/utils/networks';

const getTransactionExplorerUrl = (tx: Transaction | null, network?: Network) => {
  if (!tx?.hash || !network) return '';

  if (network.type === 'SOL') {
    if (network.id === 'solana-devnet') {
      return `https://explorer.solana.com/tx/${tx.hash}?cluster=devnet`;
    }
    return `https://solscan.io/tx/${tx.hash}`;
  }

  return `${network.explorerUrl.replace(/\/$/, '')}/tx/${tx.hash}`;
};

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const wallet = useWallet();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [txHashCopied, setTxHashCopied] = useState(false);
  const txHashCopiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedTxNetwork = selectedTx?.networkId ? getNetworkById(selectedTx.networkId) : undefined;
  const selectedTxExplorerUrl = getTransactionExplorerUrl(selectedTx, selectedTxNetwork);
  const selectedTxIsSent = selectedTx?.icon === 'ArrowUpRight' || selectedTx?.delta === '-';
  const selectedTxCounterpartyLabel = selectedTxIsSent ? 'To' : 'From';
  const selectedTxCounterpartyValue = selectedTxIsSent
    ? selectedTx?.to || selectedTx?.from || 'Unknown'
    : selectedTx?.from || selectedTx?.to || 'Unknown';
  const selectedTxStatus = selectedTx?.status || (selectedTx?.hash ? 'confirmed' : 'pending');

  useEffect(() => {
    setTxHashCopied(false);
  }, [selectedTx?.hash]);

  useEffect(() => {
    return () => {
      if (txHashCopiedTimeoutRef.current) {
        clearTimeout(txHashCopiedTimeoutRef.current);
      }
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await wallet.refreshData();
    setRefreshing(false);
  };

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

  const renderTx = ({ item }: { item: Transaction }) => {
    let IconComponent = HelpCircle;
    if (item.icon === 'ArrowDownLeft') IconComponent = ArrowDownLeft;
    if (item.icon === 'ArrowUpRight') IconComponent = ArrowUpRight;

    return (
      <HapticTouchableOpacity style={styles.txCard} onPress={() => setSelectedTx(item)}>
        <View style={styles.txIconBox}>
          <IconComponent color="white" size={20} />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txTitle}>{item.title}</Text>
          <Text style={styles.txSubtitle} numberOfLines={1}>{item.subtitle}</Text>
        </View>
        <View style={styles.txAmounts}>
          <Text style={styles.txDate}>{item.date}</Text>
        </View>
      </HapticTouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recent Transactions</Text>
      </View>

      <FlatList
        data={wallet.transactions}
        renderItem={renderTx}
        keyExtractor={(item, index) => item.hash || `${item.dateTime || item.date}-${index}`}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="white" />}
        ListEmptyComponent={
          wallet.isTransactionsLoading ? (
            <ActivityIndicator size="small" color="#A855F7" style={{ marginTop: 40 }} />
          ) : (
            <Text style={styles.emptyText}>
              No recent transactions
            </Text>
          )
        }
      />

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
              {selectedTx?.icon === 'ArrowUpRight' ? (
                <ArrowUpRight color="white" size={20} />
              ) : selectedTx?.icon === 'ArrowDownLeft' ? (
                <ArrowDownLeft color="white" size={20} />
              ) : (
                <HelpCircle color="white" size={20} />
              )}
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txTitle}>{selectedTx?.title || 'Transaction'}</Text>
              <Text style={styles.txSubtitle} numberOfLines={1}>
                {selectedTx?.subtitle || selectedTx?.amount || 'No amount details'}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{selectedTxStatus}</Text>
            </View>
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Network</Text>
              <Text style={styles.detailValue}>
                {selectedTxNetwork?.name || selectedTx?.networkId || 'Unknown'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>
                {selectedTx?.dateTime || selectedTx?.date || 'Unknown'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={[styles.detailValue, { color: selectedTx?.amountColor || 'white' }]}>
                {selectedTx?.amount || selectedTx?.subtitle || '--'}
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
              {selectedTx?.hash || 'No hash available yet'}
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
                  color={selectedTx?.hash ? '#A855F7' : 'rgba(255,255,255,0.35)'}
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
              color={selectedTxExplorerUrl ? 'white' : 'rgba(255,255,255,0.35)'}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0E' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  emptyText: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 40,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  txIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  txInfo: { flex: 1 },
  txTitle: { color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  txSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  txAmounts: { alignItems: 'flex-end', justifyContent: 'center' },
  txDate: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  handleWrap: { alignItems: 'center', paddingVertical: 12 },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
  },
  txDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statusPill: {
    backgroundColor: 'rgba(20, 241, 149, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    color: '#14F195',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  detailCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
  },
  detailValue: {
    flex: 1,
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  hashBox: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hashText: {
    flex: 1,
    color: 'white',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyButtonBox: {
    minWidth: 36,
    minHeight: 36,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonBoxCopied: {
    backgroundColor: 'rgba(20, 241, 149, 0.14)',
    borderColor: 'rgba(20, 241, 149, 0.35)',
  },
  detailActionButton: {
    backgroundColor: '#A855F7',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  detailActionButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  detailActionText: { color: 'white', fontWeight: '700', fontSize: 15 },
  detailActionTextDisabled: { color: 'rgba(255,255,255,0.35)' },
});
