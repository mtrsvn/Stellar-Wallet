import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView, Modal, Image } from 'react-native';
import { HapticTouchableOpacity } from '../src/components/HapticTouchableOpacity';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { GradientButton } from '../src/components/GradientButton';
import { useWallet } from '../src/context/WalletContext';
import { WalletCore } from '../src/utils/WalletCore';
import { EthService } from '../src/services/EthService';
import { SolService } from '../src/services/SolService';
import { BtcService } from '../src/services/BtcService';
import { ethers } from 'ethers';
import { getNetworkIcon } from '../src/components/NetworkIcons';
import { PinEntryScreen } from '../src/components/PinEntryScreen';
import { BottomSheet, handleStyle, sheetBaseStyle } from '../src/components/BottomSheet';
import { ChevronDown, ChevronRight } from 'lucide-react-native';

export default function SendScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const wallet = useWallet();
  const [address, setAddress] = useState(params.to as string || '');
  const [amount, setAmount] = useState(params.amount as string || '');
  const [isSending, setIsSending] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState(params.assetId as string || '');
  const [showPin, setShowPin] = useState(false);
  const [showNetworkSheet, setShowNetworkSheet] = useState(false);
  const [showTokenSheet, setShowTokenSheet] = useState(false);

  const selectedAsset = wallet.tokenBalances?.find(t => t.id === selectedAssetId);

  const handleMax = () => {
    if (selectedAsset && selectedAsset.balanceStr !== '0' && selectedAsset.balanceStr !== '0.000000') {
      setAmount(selectedAsset.balanceValue.toString());
    }
  };

  const validateAndPromptPin = () => {
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
    if (!ethers.isAddress(cleanAddress)) {
      Alert.alert('Error', 'Invalid EVM recipient address.');
      return;
    }

    setShowPin(true);
  };

  const executeSend = async () => {
    const cleanAddress = address.trim();
    const cleanAmount = amount.replace(',', '.').trim();

    setIsSending(true);
    try {
      const activeWallet = wallet.savedWallets.find(w => w.id === wallet.activeWalletId);
      if (!activeWallet?.mnemonic) {
        throw new Error("No active wallet found.");
      }
      
      let result;
      if (selectedAsset!.network.type === 'EVM') {
        const privateKey = WalletCore.getEvmPrivateKey(activeWallet.mnemonic, 0);
        result = await EthService.sendTransaction(
          privateKey, 
          cleanAddress, 
          cleanAmount, 
          selectedAsset!.network,
          !selectedAsset!.isNative ? selectedAsset!.token?.address : undefined,
          !selectedAsset!.isNative ? selectedAsset!.token?.decimals : undefined
        );
      } else if (selectedAsset!.network.type === 'SOL') {
        const privateKey = WalletCore.getSolanaPrivateKey(activeWallet.mnemonic, 0);
        result = await SolService.sendTransaction(
          privateKey,
          cleanAddress,
          cleanAmount,
          selectedAsset!.network
        );
      } else if (selectedAsset!.network.type === 'BTC') {
        const privateKey = WalletCore.getBtcPrivateKey(activeWallet.mnemonic, 0);
        result = await BtcService.sendTransaction(
          privateKey,
          cleanAddress,
          cleanAmount,
          selectedAsset!.network
        );
      } else {
        throw new Error("Unsupported network type");
      }
      
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

  if (showPin) {
    return (
      <PinEntryScreen 
        onUnlock={() => {
          setShowPin(false);
          // Wait for PIN screen to unmount before showing loading/alert
          setTimeout(() => executeSend(), 100);
        }}
        onLogout={() => {
          setShowPin(false);
        }}
        forRemoval={false}
      />
    );
  }

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
          <Text style={styles.label}>Network</Text>
          <HapticTouchableOpacity onPress={() => setShowNetworkSheet(true)} style={styles.inputContainer}>
            {selectedAsset ? (
              <View style={styles.assetSelectContent}>
                <View style={styles.assetSelectLeft}>
                  <View style={{ marginRight: 12, width: 32, height: 32, borderRadius: 16, overflow: 'hidden' }}>
                    {getNetworkIcon(selectedAsset.network.symbol, 32)}
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
                <ChevronDown color="rgba(255,255,255,0.3)" size={20} />
              </View>
            ) : (
              <View style={styles.assetSelectContent}>
                <Text style={styles.assetSelectPlaceholder}>Select a network...</Text>
                <ChevronDown color="rgba(255,255,255,0.3)" size={20} />
              </View>
            )}
          </HapticTouchableOpacity>

          <View style={{ height: 24 }} />

          <Text style={styles.label}>Asset</Text>
          <HapticTouchableOpacity onPress={() => setShowTokenSheet(true)} style={styles.inputContainer}>
            {selectedAsset ? (
              <View style={styles.assetSelectContent}>
                <View style={styles.assetSelectLeft}>
                  <View style={{ marginRight: 12, width: 32, height: 32, borderRadius: 16, overflow: 'hidden' }}>
                    {selectedAsset.isNative ? getNetworkIcon(selectedAsset.network.symbol, 32) : (
                      selectedAsset.token?.logoUrl ? <Image source={{uri: selectedAsset.token.logoUrl}} style={{width:32,height:32,borderRadius:16}} /> : <View style={{width:32,height:32,backgroundColor:'#333',borderRadius:16}}/>
                    )}
                  </View>
                  <View>
                    <Text style={styles.assetSelectTitle}>
                      {selectedAsset.isNative ? selectedAsset.network.symbol : selectedAsset.token?.symbol || 'Token'}
                    </Text>
                    <Text style={styles.assetSelectSubtitle}>
                      Balance: {selectedAsset.balanceStr}
                    </Text>
                  </View>
                </View>
                <ChevronDown color="rgba(255,255,255,0.3)" size={20} />
              </View>
            ) : (
              <View style={styles.assetSelectContent}>
                <Text style={styles.assetSelectPlaceholder}>Select an asset...</Text>
                <ChevronDown color="rgba(255,255,255,0.3)" size={20} />
              </View>
            )}
          </HapticTouchableOpacity>

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
            <HapticTouchableOpacity onPress={() => router.push({ pathname: '/scan', params: { returnTo: '/send', assetId: selectedAssetId, amount: amount } })} style={{ padding: 8 }}>
              <FontAwesome name="qrcode" size={24} color="rgba(255,255,255,0.7)" />
            </HapticTouchableOpacity>
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
              style={styles.input}
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
          <GradientButton label={isSending ? "Sending..." : "Review Send"} onPressed={validateAndPromptPin} disabled={isSending} />
        </View>
      </ScrollView>

      <BottomSheet visible={showNetworkSheet} onClose={() => setShowNetworkSheet(false)}>
        <View style={[sheetBaseStyle, { paddingBottom: Math.max(34, 24) }]}>
          <View style={{ alignItems: 'center', paddingVertical: 12 }}><View style={handleStyle as any} /></View>
          <Text style={styles.sheetTitle}>Select Network</Text>
          
          <ScrollView style={{ maxHeight: 400, marginTop: 12, marginBottom: -12 }}>
            {wallet.tokenBalances?.filter(tb => tb.isNative && Number(tb.balanceValue) > 0).map((tb) => (
              <HapticTouchableOpacity
                key={tb.id}
                style={styles.txCard}
                onPress={() => {
                  setSelectedAssetId(tb.id);
                  setShowNetworkSheet(false);
                }}
              >
                <View style={styles.networkLogoContainer}>
                  {getNetworkIcon(tb.network.symbol, 40) || (
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: tb.network.color || '#333', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{color: 'white', fontWeight: 'bold'}}>{tb.network.symbol[0]}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txTitle}>
                    {tb.network.name}
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

      <BottomSheet visible={showTokenSheet} onClose={() => setShowTokenSheet(false)}>
        <View style={[sheetBaseStyle, { paddingBottom: Math.max(34, 24) }]}>
          <View style={{ alignItems: 'center', paddingVertical: 12 }}><View style={handleStyle as any} /></View>
          <Text style={styles.sheetTitle}>Select Asset</Text>
          
          <ScrollView style={{ maxHeight: 400, marginTop: 12, marginBottom: -12 }}>
            {wallet.tokenBalances?.filter(tb => tb.network.id === selectedAsset?.network.id && Number(tb.balanceValue) > 0).map((tb) => (
              <HapticTouchableOpacity
                key={tb.id}
                style={styles.txCard}
                onPress={() => {
                  setSelectedAssetId(tb.id);
                  setShowTokenSheet(false);
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
                    {tb.isNative ? tb.network.symbol : tb.token?.symbol || 'Token'}
                  </Text>
                  <Text style={styles.txSubtitle}>
                    {tb.isNative ? tb.network.name : tb.token?.name || 'Token'}
                  </Text>
                </View>
                <View style={styles.txAmounts}>
                  <Text style={[styles.txTitle, { marginBottom: 2, textAlign: 'right' }]}>{tb.balanceStr}</Text>
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
  content: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginTop: 4, marginBottom: 24 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  form: { paddingHorizontal: 24 },
  label: { color: 'rgba(255,255,255,0.7)', marginBottom: 12, fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  
  // Standardized input container for token, address, and amount
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, paddingHorizontal: 16, height: 72, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  input: { flex: 1, color: 'white', fontSize: 16 },
  
  assetSelectContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 },
  assetSelectLeft: { flexDirection: 'row', alignItems: 'center' },
  assetSelectTitle: { color: 'white', fontSize: 16, fontWeight: '600' },
  assetSelectSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 },
  assetSelectPlaceholder: { color: 'rgba(255,255,255,0.5)', fontSize: 16 },
  
  availableText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '500' },
  maxButton: { backgroundColor: 'rgba(168, 85, 247, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 12 },
  maxButtonText: { color: '#A855F7', fontSize: 12, fontWeight: '700' },
  
  txCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 12 },
  networkLogoContainer: { width: 40, height: 40, borderRadius: 20, marginRight: 16, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1 },
  txTitle: { color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  txSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  txAmounts: { alignItems: 'flex-end', justifyContent: 'center' },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: 'white', marginBottom: 20, textAlign: 'center' },
});
