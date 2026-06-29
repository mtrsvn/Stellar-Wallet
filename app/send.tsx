import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { GradientButton } from '../src/components/GradientButton';
import { useWallet } from '../src/context/WalletContext';
import { WalletCore } from '../src/utils/WalletCore';
import { EthService } from '../src/services/EthService';
import { ethers } from 'ethers';
import { getNetworkIcon } from '../src/components/NetworkIcons';

export default function SendScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const wallet = useWallet();
  const [address, setAddress] = useState(params.to as string || '');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedNetworkId, setSelectedNetworkId] = useState(wallet.networkBalances[0]?.network.id || '');

  const selectedNetworkBalance = wallet.networkBalances.find(n => n.network.id === selectedNetworkId);

  const handleMax = () => {
    if (selectedNetworkBalance && selectedNetworkBalance.balanceStr !== '0') {
      // In a real app we need to subtract gas fees, but for simplicity here we just use the raw string
      setAmount(selectedNetworkBalance.balanceStr);
    }
  };

  const handleSend = async () => {
    const cleanAddress = address.trim();
    const cleanAmount = amount.replace(',', '.').trim();

    if (!cleanAddress || !cleanAmount || !selectedNetworkBalance) {
      Alert.alert('Error', 'Please enter address, amount, and select an asset.');
      return;
    }

    if (isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) {
      Alert.alert('Error', 'Invalid amount.');
      return;
    }

    if (selectedNetworkBalance.network.type !== 'EVM') {
      Alert.alert('Not Implemented', `Sending on ${selectedNetworkBalance.network.name} is not fully supported in this beta yet.`);
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
      const result = await EthService.sendTransaction(privateKey, cleanAddress, cleanAmount, selectedNetworkBalance.network);
      
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
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: 'center' }}>
            <FontAwesome name="chevron-left" size={20} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Send Crypto</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Select Asset</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.assetSelector}>
            {wallet.networkBalances.map((nb) => {
              const isSelected = selectedNetworkId === nb.network.id;
              return (
                <TouchableOpacity
                  key={nb.network.id}
                  style={[
                    styles.assetBadge,
                    isSelected ? styles.assetBadgeSelected : {},
                    { borderColor: isSelected ? nb.network.color : 'rgba(255,255,255,0.1)' }
                  ]}
                  onPress={() => setSelectedNetworkId(nb.network.id)}
                >
                  <View style={{ marginRight: 8, width: 20, height: 20, borderRadius: 10, overflow: 'hidden' }}>
                    {getNetworkIcon(nb.network.symbol, 20) || (
                      <View style={{ flex: 1, backgroundColor: nb.network.color }} />
                    )}
                  </View>
                  <Text style={[
                    styles.assetBadgeText,
                    isSelected ? { color: 'white' } : { color: 'rgba(255,255,255,0.6)' }
                  ]}>
                    {nb.network.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ height: 24 }} />

          <Text style={styles.label}>Recipient Address</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={selectedNetworkBalance?.network.type === 'EVM' ? "0x..." : "Address..."}
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={address}
              onChangeText={setAddress}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          
          <View style={{ height: 24 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
            <Text style={[styles.label, { marginBottom: 0 }]}>Amount ({selectedNetworkBalance?.network.symbol || ''})</Text>
            <Text style={styles.availableText}>
              Available: {selectedNetworkBalance?.balanceStr || '0'}
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
            <TouchableOpacity style={styles.maxButton} onPress={handleMax}>
              <Text style={styles.maxButtonText}>MAX</Text>
            </TouchableOpacity>
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
  assetSelector: { flexGrow: 0, marginBottom: 4 },
  assetBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, marginRight: 10 },
  assetBadgeSelected: { backgroundColor: 'rgba(255,255,255,0.1)' },
  assetBadgeText: { fontWeight: '600', fontSize: 15 },
  badgeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  availableText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '500' },
  maxButton: { backgroundColor: 'rgba(168, 85, 247, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 12 },
  maxButtonText: { color: '#A855F7', fontSize: 12, fontWeight: '700' },
});
