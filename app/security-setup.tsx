import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Keyboard, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { GradientButton } from '../src/components/GradientButton';
import { useWallet } from '../src/context/WalletContext';
import { useKeyboardHeight } from '../src/hooks/useKeyboardHeight';

export default function SecuritySetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const wallet = useWallet();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [obscurePassword, setObscurePassword] = useState(true);
  const [obscureConfirm, setObscureConfirm] = useState(true);
  const [error, setError] = useState('');

  const evaluatePasswordStrength = (p: string) => {
    if (!p) return '';
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score >= 3) return 'Strong';
    if (score === 2) return 'Good';
    return 'Weak';
  };

  const strength = evaluatePasswordStrength(password);
  const strengthColor = strength === 'Strong' ? '#4CAF50' : strength === 'Good' ? 'orange' : 'red';

  const handleContinue = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    Keyboard.dismiss();
    await new Promise(resolve => setTimeout(resolve, 150));

    await wallet.savePasswordLocally(password);
    
    const nextPath = params.next as string;
    if (nextPath) {
      router.push({ pathname: nextPath, params: { name: params.name } } as any);
    } else {
      router.push({ pathname: '/seed-reveal-intro', params: { name: params.name } } as any);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: Math.max(
              24,
              Platform.OS === 'ios' ? keyboardHeight + 24 - insets.bottom : 24,
            ),
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="chevron-left" size={20} color="white" />
        </TouchableOpacity>

        <Text style={styles.title}>Create Password</Text>
        <Text style={styles.subtitle}>Protect your wallet with a local password</Text>

        <Text style={styles.label}>Password</Text>
        <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.3)"
              secureTextEntry={obscurePassword}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
            />
            <TouchableOpacity onPress={() => setObscurePassword(!obscurePassword)} style={styles.iconButton}>
              <FontAwesome name={obscurePassword ? 'eye-slash' : 'eye'} size={18} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
        </View>

        <View style={{ height: 24, justifyContent: 'center', marginBottom: 16 }}>
          {password.length > 0 && (
            <Text style={styles.strengthText}>
              Password Strength: <Text style={{ color: strengthColor }}>{strength}</Text>
            </Text>
          )}
        </View>

        <Text style={styles.label}>Confirm Password</Text>
        <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="rgba(255,255,255,0.3)"
              secureTextEntry={obscureConfirm}
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
            />
            <TouchableOpacity onPress={() => setObscureConfirm(!obscureConfirm)} style={styles.iconButton}>
              <FontAwesome name={obscureConfirm ? 'eye-slash' : 'eye'} size={18} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
        </View>

        <View style={{ height: 24, justifyContent: 'center', marginBottom: 16 }}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <GradientButton label="Continue" onPressed={handleContinue} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0E' },
  content: { flexGrow: 1, padding: 24 },
  backButton: { width: 40, height: 40, justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 8 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 32, lineHeight: 24 },
  label: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 8, fontWeight: '500' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  input: { flex: 1, paddingVertical: 16, color: 'white', fontSize: 16 },
  iconButton: { padding: 8 },
  strengthText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  errorText: { color: '#FE5353', fontSize: 13 },
});
