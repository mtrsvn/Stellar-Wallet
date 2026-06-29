import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import {
  Animated,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  PanResponder,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ArrowDownLeft, ArrowUpRight, HelpCircle } from 'lucide-react-native';
import { useWallet } from '../src/context/WalletContext';

const SCREEN_HEIGHT = Dimensions.get('window').height;

function TxModal({ selectedTx, onClose }: { selectedTx: any; onClose: () => void }) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const sheetTranslateYVal = useRef(SCREEN_HEIGHT);

  useEffect(() => {
    const id = sheetTranslateY.addListener((v) => {
      sheetTranslateYVal.current = v.value;
    });
    return () => sheetTranslateY.removeListener(id);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation();
        sheetTranslateY.setOffset(sheetTranslateYVal.current);
        sheetTranslateY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          sheetTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        sheetTranslateY.flattenOffset();
        if (gestureState.dy > 120 || gestureState.vy > 0.6) {
          handleClose();
        } else {
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 0,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (selectedTx) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, { toValue: 0, duration: 300, useNativeDriver: false }),
      ]).start();
    }
  }, [selectedTx]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: false }),
    ]).start(() => onClose());
  };

  if (!selectedTx) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]} pointerEvents="auto">
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.75)' }]} />
        </TouchableWithoutFeedback>
      </Animated.View>

      <Animated.View
        style={[styles.modalContent, { transform: [{ translateY: sheetTranslateY }] }]}
        pointerEvents="auto"
        {...panResponder.panHandlers}
      >
        <View style={styles.handle} />
        <Text style={styles.modalTitle}>{selectedTx?.title}</Text>
        <Text style={styles.modalAmount}>{selectedTx?.subtitle}</Text>
        <Text style={styles.modalDate}>{selectedTx?.date}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>From</Text>
        <Text style={styles.value}>{selectedTx?.from || 'Unknown'}</Text>

        <TouchableOpacity onPress={handleClose} style={styles.closeButton} activeOpacity={0.7}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export default function AllActivitiesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const wallet = useWallet();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await wallet.refreshData();
    setRefreshing(false);
  };

  const renderTx = ({ item }: { item: any }) => {
    let IconComponent = HelpCircle;
    if (item.icon === 'ArrowDownLeft') IconComponent = ArrowDownLeft;
    if (item.icon === 'ArrowUpRight') IconComponent = ArrowUpRight;

    return (
      <TouchableOpacity style={styles.txCard} onPress={() => setSelectedTx(item)}>
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
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 40, height: 40, justifyContent: 'center' }}
        >
          <ChevronLeft size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={wallet.transactions}
        renderItem={renderTx}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="white" />}
        ListEmptyComponent={
          <Text style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 40 }}>
            No recent activities
          </Text>
        }
      />

      {selectedTx && <TxModal selectedTx={selectedTx} onClose={() => setSelectedTx(null)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0E' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginTop: 4,
    marginBottom: 16,
  },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  txCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 12 },
  txIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  txInfo: { flex: 1 },
  txTitle: { color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  txSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  txAmounts: { alignItems: 'flex-end', justifyContent: 'center' },
  txDate: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },

  modalContent: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#0B0B0E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 48,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: 'white', marginBottom: 8 },
  modalAmount: { fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  modalDate: { fontSize: 14, color: 'rgba(255,255,255,0.54)', marginBottom: 12 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 16 },
  label: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 6 },
  value: { fontSize: 14, color: 'white' },
  closeButton: {
    marginTop: 32,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    alignItems: 'center',
  },
  closeText: { color: 'white', fontWeight: '600', fontSize: 15 },
});
