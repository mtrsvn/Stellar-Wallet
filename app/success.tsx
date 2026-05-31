import 'react-native-get-random-values';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { GradientButton } from '../src/components/GradientButton';
import { useWallet } from '../src/context/WalletContext';

export default function SuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const wallet = useWallet();
  const isImport = params.isImport === 'true';

  useEffect(() => {
    // Generate seed if not importing and no seed exists
    if (!isImport && (!wallet.savedWallets || wallet.savedWallets.length === 0)) {
      const newSeed = require('ethers').Wallet.createRandom().mnemonic.phrase;
      wallet.addNewWallet(newSeed).then(() => {
        wallet.markCreated();
      });
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={{ flex: 1 }} />
        
        <View style={styles.iconContainer}>
          <FontAwesome name="check-circle" size={100} color="#4CAF50" />
        </View>

        <Text style={styles.title}>Success!</Text>
        <Text style={styles.subtitle}>
          {isImport 
            ? "Your wallet has been imported successfully." 
            : "Your wallet has been created successfully."}
        </Text>
        
        <View style={{ flex: 1 }} />

        <GradientButton 
          label="Done" 
          onPressed={() => router.replace('/dashboard' as any)} 
        />
        <View style={{ height: 20 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1D1E' },
  content: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  iconContainer: { marginBottom: 32 },
  title: { fontSize: 32, fontWeight: 'bold', color: 'white', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center', paddingHorizontal: 32 },
});
