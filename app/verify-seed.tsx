import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { HapticTouchableOpacity } from '../src/components/HapticTouchableOpacity';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { GradientButton } from '../src/components/GradientButton';
import { useWallet } from '../src/context/WalletContext';
import { useKeyboardHeight } from '../src/hooks/useKeyboardHeight';

export default function VerifySeedScreen() {
  const router = useRouter();
  const wallet = useWallet();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const [original, setOriginal] = useState<string[]>([]);
  const [inputs, setInputs] = useState<string[]>(Array(12).fill(''));
  const [error, setError] = useState('');
  
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    const activeWallet = wallet.savedWallets.find(w => w.id === wallet.activeWalletId);
    const seed = activeWallet?.mnemonic;
    if (seed) {
      setOriginal(seed.split(' '));
    }
  }, [wallet.savedWallets, wallet.activeWalletId]);

  const handleValidate = async () => {
    const entered = inputs.map(w => w.trim().toLowerCase()).join(' ');
    const expected = original.map(w => w.toLowerCase()).join(' ');
    
    if (entered === expected) {
      await wallet.markCreated();
      router.replace({ pathname: '/success', params: { isImport: 'false' } } as any);
    } else {
      setError("The seed phrase you entered doesn't match. Please try again.");
    }
  };

  const updateInput = (text: string, index: number) => {
    const newInputs = [...inputs];
    newInputs[index] = text;
    setInputs(newInputs);
    setError('');
    
    // Auto advance on space
    if (text.includes(' ') && index < 11) {
      newInputs[index] = text.trim();
      setInputs(newInputs);
      inputRefs.current[index + 1]?.focus();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <HapticTouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: 'center' }}>
            <FontAwesome name="chevron-left" size={20} color="white" />
          </HapticTouchableOpacity>
          <Text style={styles.headerTitle}>Create Wallet</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingBottom: Math.max(
              24,
              Platform.OS === 'ios' ? keyboardHeight + 24 - insets.bottom : 24,
            ),
          }}
        >
          <Text style={styles.title}>Confirm Seed Phrase</Text>
          <Text style={styles.subtitle}>To ensure your backup is correct, please enter your full 12-word phrase in the order below.</Text>

          <View style={styles.grid}>
            {Array.from({ length: 12 }).map((_, i) => (
              <View key={i} style={styles.inputWrapper}>
                <View style={styles.indexCircle}>
                  <Text style={styles.indexText}>{i + 1}</Text>
                </View>
                <TextInput
                  ref={el => { inputRefs.current[i] = el; }}
                  style={styles.input}
                  value={inputs[i]}
                  onChangeText={(t) => updateInput(t, i)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={() => {
                    if (i < 11) inputRefs.current[i + 1]?.focus();
                    else handleValidate();
                  }}
                />
              </View>
            ))}
          </View>

          <View style={{ height: 40, justifyContent: 'center', marginTop: 12 }}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
          
          <GradientButton label="Confirm Seed Phrase" onPressed={handleValidate} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0E' },
  content: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginTop: 16, marginBottom: 16 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  title: { fontSize: 20, fontWeight: 'bold', color: 'white', marginBottom: 12 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 24, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  inputWrapper: { width: '47%', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#3A3A3C', borderRadius: 28, paddingHorizontal: 12, paddingVertical: 8, height: 48 },
  indexCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#3A3A3C', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  indexText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold' },
  input: { flex: 1, color: 'white', fontSize: 14 },
  errorText: { color: '#FE5353', fontSize: 14, textAlign: 'center' },
});
