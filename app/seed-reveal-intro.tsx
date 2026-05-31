import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { GradientButton } from '../src/components/GradientButton';

export default function SeedRevealIntroScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = () => {
    if (isStarting) return;
    setIsStarting(true);
    router.replace({ pathname: '/reveal-seed', params: { name: params.name } } as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="chevron-left" size={20} color="white" />
        </TouchableOpacity>
        
        <Text style={styles.title}>Secure Your Wallet</Text>
        <Text style={styles.subtitle}>
          Secure your wallet's seed phrase. This is the only way to recover your account if you lose your device or password.
        </Text>
        
        <View style={styles.card}>
          <FontAwesome name="shield" size={40} color="#9C2CF0" style={{ marginBottom: 16 }} />
          <Text style={styles.cardTitle}>Why is it important?</Text>
          <Text style={styles.cardText}>
            • Your seed phrase is your master key.{'\n'}
            • Never share it with anyone.{'\n'}
            • Store it offline in a secure place.
          </Text>
        </View>

        <View style={{ flex: 1 }} />
        <GradientButton label="Start" onPressed={handleStart} disabled={isStarting} />
        <View style={{ height: 20 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1D1E' },
  content: { flex: 1, padding: 24 },
  backButton: { marginBottom: 24, width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 12 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 32, lineHeight: 24 },
  card: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 24, borderRadius: 16 },
  cardTitle: { fontSize: 18, color: 'white', fontWeight: 'bold', marginBottom: 12 },
  cardText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 24 },
});
