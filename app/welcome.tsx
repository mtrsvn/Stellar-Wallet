import React, { useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { GradientButton } from '../src/components/GradientButton';
import { useWallet } from '../src/context/WalletContext';

import { BottomSheet } from '../src/components/BottomSheet';

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const wallet = useWallet();

  const [createWalletVisible, setCreateWalletVisible] = useState(false);
  const [importWalletVisible, setImportWalletVisible] = useState(false);
  const [walletName, setWalletName] = useState('My Wallet');

  const closeCreateSheet = () => {
    Keyboard.dismiss();
    setCreateWalletVisible(false);
  };

  const closeImportSheet = () => {
    Keyboard.dismiss();
    setImportWalletVisible(false);
  };

  const handleCreateWallet = () => {
    Keyboard.dismiss();
    setCreateWalletVisible(false);
    router.push({ pathname: '/security-setup', params: { name: walletName } } as any);
  };

  const handleImportWallet = () => {
    Keyboard.dismiss();
    setImportWalletVisible(false);
    router.push({ pathname: '/security-setup', params: { next: '/import-wallet', name: walletName } } as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Image source={require('../assets/images/wallet.png')} style={styles.image} resizeMode="contain" />
        </View>

        <Text style={styles.title}>Welcome to Stellar</Text>
        <Text style={styles.subtitle}>Your wallet for the ETHverse</Text>

        <View style={styles.buttonContainer}>
          <GradientButton label="Create New Wallet" onPressed={() => setCreateWalletVisible(true)} />
          <View style={{ height: 12 }} />
          <GradientButton label="Import Existing Wallet" outline onPressed={() => setImportWalletVisible(true)} />
        </View>

        <Text style={styles.termsText}>
          By continuing, you agree to our <Text style={styles.termsLink}>Terms and Condition</Text>
        </Text>
      </ScrollView>

      {/* Create Wallet Sheet */}
      <BottomSheet visible={createWalletVisible} onClose={closeCreateSheet} avoidKeyboard>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.handle} />
            <Text style={styles.modalTitle}>Create New Wallet</Text>
            <Text style={styles.modalSubtitle}>Give your wallet a name</Text>

            <TextInput
              style={styles.input}
              value={walletName}
              onChangeText={setWalletName}
              placeholder="Name"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />

            <GradientButton label="Continue" onPressed={handleCreateWallet} />
            <TouchableOpacity onPress={closeCreateSheet} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
      </BottomSheet>

      {/* Import Wallet Sheet */}
      <BottomSheet visible={importWalletVisible} onClose={closeImportSheet} avoidKeyboard>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.handle} />
            <Text style={styles.modalTitle}>Import Existing Wallet</Text>
            <Text style={styles.modalSubtitle}>Give your wallet a name</Text>

            <TextInput
              style={styles.input}
              value={walletName}
              onChangeText={setWalletName}
              placeholder="Name"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />

            <GradientButton label="Continue" onPressed={handleImportWallet} />
            <TouchableOpacity onPress={closeImportSheet} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1D1E' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 24 },
  image: { width: 300, height: 300, marginTop: 40 },
  title: { fontSize: 36, fontWeight: '600', color: 'white', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 18, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 40 },
  buttonContainer: { marginBottom: 32 },
  termsText: { color: 'rgba(255,255,255,0.38)', fontSize: 13, textAlign: 'center' },
  termsLink: { color: '#9929EA' },

  // Bottom sheet base
  backdrop: { backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: {
    backgroundColor: '#1C1D1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  modalTitle: { fontSize: 22, fontWeight: '700', color: 'white', marginBottom: 8, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.54)', textAlign: 'center', marginBottom: 24 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    color: 'white',
    marginBottom: 24,
  },
  cancelButton: { marginTop: 16, paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '500' },
});
