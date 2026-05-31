import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { GradientButton } from '../src/components/GradientButton';
import { useWallet } from '../src/context/WalletContext';
import { WalletCore } from '../src/utils/WalletCore';
import { EthService } from '../src/services/EthService';
import { ethers } from 'ethers';

export default function SendScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const wallet = useWallet();
  const [address, setAddress] = useState(params.to as string || '');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    const cleanAddress = address.trim();
    const cleanAmount = amount.replace(',', '.').trim();

    if (!cleanAddress || !cleanAmount) {
      Alert.alert('Error', 'Please enter both address and amount.');
      return;
    }

    if (!ethers.isAddress(cleanAddress)) {
      Alert.alert('Error', 'Invalid recipient address.');
      return;
    }

    if (isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) {
      Alert.alert('Error', 'Invalid amount.');
      return;
    }

    setIsSending(true);
    try {
      const activeWallet = wallet.savedWallets.find(w => w.id === wallet.activeWalletId);
      if (!activeWallet?.mnemonic) {
        throw new Error("No active wallet found.");
      }
      
      const privateKey = WalletCore.getPrivateKey(activeWallet.mnemonic, 0);
      const result = await EthService.sendTransaction(privateKey, cleanAddress, cleanAmount);
      
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
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: 'center' }}>
            <FontAwesome name="chevron-left" size={20} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Send ETH</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Recipient Address</Text>
          <TextInput
            style={styles.input}
            placeholder="0x..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={address}
            onChangeText={setAddress}
          />
          
          <View style={{ height: 16 }} />

          <Text style={styles.label}>Amount (ETH)</Text>
          <TextInput
            style={styles.input}
            placeholder="0.0"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />

          <View style={{ height: 32 }} />
          <GradientButton label={isSending ? "Sending..." : "Send ETH"} onPressed={handleSend} disabled={isSending} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1D1E' },
  content: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginTop: 4, marginBottom: 24 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  form: { paddingHorizontal: 24 },
  label: { color: 'rgba(255,255,255,0.7)', marginBottom: 8, fontSize: 14 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, color: 'white', fontSize: 16 },
});
