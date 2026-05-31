import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Keyboard, Platform, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { GradientButton } from '../src/components/GradientButton';
import { useWallet } from '../src/context/WalletContext';
import { useKeyboardHeight } from '../src/hooks/useKeyboardHeight';
import { WalletCore } from '../src/utils/WalletCore';

export default function ImportWalletScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const wallet = useWallet();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const [inputs, setInputs] = useState<string[]>(Array(12).fill(''));
  const [error, setError] = useState('');
  
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const handleImport = async () => {
    const input = inputs.map(w => w.trim().toLowerCase()).join(' ');
    if (!WalletCore.validateMnemonic(input)) {
      setError('Invalid Secret Recovery Phrase');
      return;
    }
    
    Keyboard.dismiss();
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const wName = params.name as string | undefined;
    await wallet.addNewWallet(input, wName);
    await wallet.markCreated();
    router.replace({ pathname: '/success', params: { isImport: 'true' } } as any);
  };

  const updateInput = (text: string, index: number) => {
    const newInputs = [...inputs];
    
    // Check if user is pasting multiple words
    const words = text.trim().split(/\s+/);
    if (words.length > 1) {
      words.forEach((w, i) => {
        if (index + i < 12) {
          newInputs[index + i] = w;
        }
      });
      setInputs(newInputs);
      setError('');
      // Focus the next empty input, or the last input if all filled
      const nextEmpty = newInputs.findIndex(w => w === '');
      if (nextEmpty !== -1) {
        inputRefs.current[nextEmpty]?.focus();
      } else {
        inputRefs.current[11]?.focus();
      }
      return;
    }

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
    <SafeAreaView style={[styles.container, { paddingTop: Math.max(0, insets.top - 20) }]} edges={['left', 'right']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: 'center' }}>
            <FontAwesome name="chevron-left" size={20} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Import Wallet</Text>
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
          <Text style={styles.title}>Enter Seed Phrase</Text>
          <Text style={styles.subtitle}>Enter your 12-word Secret Recovery Phrase in the exact order.</Text>

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
                    else handleImport();
                  }}
                />
              </View>
            ))}
          </View>

          <View style={{ height: 40, justifyContent: 'center', marginTop: 12 }}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
          
          <GradientButton label="Import Wallet" onPressed={handleImport} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C1D1E' },
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
