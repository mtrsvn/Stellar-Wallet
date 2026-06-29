import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { HapticTouchableOpacity } from '../src/components/HapticTouchableOpacity';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { ChevronDown } from 'lucide-react-native';
import { GradientButton } from '../src/components/GradientButton';
import { useWallet } from '../src/context/WalletContext';
import { WalletCore } from '../src/utils/WalletCore';
import { EthService } from '../src/services/EthService';
import { ethers } from 'ethers';
import { getNetworkIcon } from '../src/components/NetworkIcons';
import { BottomSheet, handleStyle, sheetBaseStyle } from '../src/components/BottomSheet';
import { TokenListItem } from '../src/components/TokenListItem';

export default function SendScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const wallet = useWallet();
  const [address, setAddress] = useState(params.to as string || '');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState(params.assetId as string || '');

  const selectedAsset = wallet.tokenBalances?.find(t => t.id === selectedAssetId);

  const handleMax = () => {
    if (selectedAsset && selectedAsset.balanceStr !== '0' && selectedAsset.balanceStr !== '0.000000') {
      // In a real app we need to subtract gas fees, but for simplicity here we just use the raw string
      setAmount(selectedAsset.balanceValue.toString());
    }
  };

  const handleSend = async () => {
    const cleanAddress = address.trim();
    const cleanAmount = amount.replace(',', '.').trim();

    if (!cleanAddress || !cleanAmount || !selectedAsset) {
      Alert.alert('Error', 'Please enter address, amount, and select an asset.');
      return;
    }

    if (isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) {
      Alert.alert('Error', 'Invalid amount.');
      return;
    }

    if (selectedAsset.network.type !== 'EVM') {
      Alert.alert('Not Implemented', `Sending on ${selectedAsset.network.name} is not fully supported in this beta yet.`);
      return;
    }

    if (!selectedAsset.isNative) {
      Alert.alert('Not Implemented', 'Sending custom tokens is not yet supported in this beta. Please send native coins.');
      return;
    }

    if (!ethers.isAddress(cleanAddress)) {
      Alert.alert('Error', 'Invalid EVM recipient address.');
      return;
    }

    setIsSending(true);
    try {
      const activeWallet = wallet.savedWallets.find(w => w.id === wallet.activeWalletId);
      if (!activeWallet?.mnemonic) {
        throw new Error("No active wallet found.");
      }
      
      const privateKey = WalletCore.getEvmPrivateKey(activeWallet.mnemonic, 0);
      const result = await EthService.sendTransaction(privateKey, cleanAddress, cleanAmount, selectedAsset.network);
      
      if (result.success) {
        Alert.alert('Success', `Transaction Sent!\n\nHash:\n${result.hash}`, [
          { text: 'OK', onPress: () => {
            wallet.refreshData(); // Refresh balance
            router.back();
          }}
        ]);
      } else {
        Alert.alert('Send Failed', result.error);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <HapticTouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: 'center' }}>
            <FontAwesome name="chevron-left" size={20} color="white" />
          </HapticTouchableOpacity>
          <Text style={styles.headerTitle}>Send Crypto</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Selected Token</Text>
          <View style={styles.assetSelectButton}>
            {selectedAsset ? (
              <View style={styles.assetSelectContent}>
                <View style={styles.assetSelectLeft}>
                  <View style={{ marginRight: 12, width: 32, height: 32, borderRadius: 16, overflow: 'hidden' }}>
                    {selectedAsset.isNative ? getNetworkIcon(selectedAsset.network.symbol, 32) : getNetworkIcon(selectedAsset.network.symbol, 32)}
                  </View>
                  <View>
                    <Text style={styles.assetSelectTitle}>
                      {selectedAsset.isNative ? selectedAsset.network.name : selectedAsset.token?.symbol || 'Token'}
                    </Text>
                    <Text style={styles.assetSelectSubtitle}>
                      {selectedAsset.network.name} Network
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.assetSelectContent}>
                <Text style={styles.assetSelectPlaceholder}>No token selected.</Text>
              </View>
            )}
          </View>

          <View style={{ height: 24 }} />

          <Text style={styles.label}>Recipient Address</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={selectedAsset?.network.type === 'EVM' ? "0x..." : "Address..."}
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={address}
              onChangeText={setAddress}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          
          <View style={{ height: 24 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
            <Text style={[styles.label, { marginBottom: 0 }]}>Amount ({selectedAsset?.isNative ? selectedAsset.network.symbol : selectedAsset?.token?.symbol || ''})</Text>
            <Text style={styles.availableText}>
              Available: {selectedAsset?.balanceStr || '0'}
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { flex: 1, fontSize: 24, fontWeight: '700' }]}
              placeholder="0.0"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <HapticTouchableOpacity style={styles.maxButton} onPress={handleMax}>
              <Text style={styles.maxButtonText}>MAX</Text>
            </HapticTouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
          <GradientButton label={isSending ? "Sending..." : "Review Send"} onPressed={handleSend} disabled={isSending} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0E' },
  content: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginTop: 4, marginBottom: 24 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  form: { paddingHorizontal: 24 },
  label: { color: 'rgba(255,255,255,0.7)', marginBottom: 12, fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  input: { flex: 1, paddingVertical: 18, color: 'white', fontSize: 16 },
  
  assetSelectButton: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 16 },
  assetSelectContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  assetSelectLeft: { flexDirection: 'row', alignItems: 'center' },
  assetSelectTitle: { color: 'white', fontSize: 16, fontWeight: '600' },
  assetSelectSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 },
  assetSelectPlaceholder: { color: 'rgba(255,255,255,0.5)', fontSize: 16 },
  
  handleWrap: { alignItems: 'center', paddingVertical: 12 },
  sheetTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 16, paddingHorizontal: 24 },
  
  availableText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '500' },
  maxButton: { backgroundColor: 'rgba(168, 85, 247, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 12 },
  maxButtonText: { color: '#A855F7', fontSize: 12, fontWeight: '700' },
});
