import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity, ActivityIndicator, Keyboard, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { GradientButton } from '../src/components/GradientButton';
import { useWallet } from '../src/context/WalletContext';

export default function LoginScreen() {
  const router = useRouter();
  const wallet = useWallet();
  const [password, setPassword] = useState('');
  const [obscure, setObscure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [kbOffset, setKbOffset] = useState(0);

  useEffect(() => {
    // We only need manual offset on iOS since Android handles it natively with "pan"
    if (Platform.OS !== 'ios') return;

    const sub1 = Keyboard.addListener('keyboardWillShow', () => setKbOffset(160)); // More space for the button
    const sub2 = Keyboard.addListener('keyboardWillHide', () => setKbOffset(0));
    return () => { sub1.remove(); sub2.remove(); };
  }, []);

  const tryLogin = async () => {
    Keyboard.dismiss();
    // Yield to let the screen instantly drop down before we freeze for verification
    await new Promise(resolve => setTimeout(resolve, 150));

    setLoading(true);
    setError('');
    const ok = await wallet.verifyPassword(password.trim());
    setLoading(false);
    if (ok) {
      router.replace('/dashboard' as any);
    } else {
      setError('Incorrect password');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={[styles.content, { transform: [{ translateY: -kbOffset }] }]}>
        <View style={{ flex: 1 }} />
        
        <View style={styles.imageContainer}>
          <Image source={require('../assets/images/lock.png')} style={styles.image} resizeMode="contain" />
        </View>

        <Text style={styles.title}>Hey there!</Text>
        <Text style={styles.subtitle}>Let's pick up where you left off</Text>
        
        <View style={{ flex: 0.5 }} />

        <View style={[styles.inputContainer, error ? styles.inputError : null]}>
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry={obscure}
            value={password}
            onChangeText={t => { setPassword(t); setError(''); }}
            onSubmitEditing={tryLogin}
          />
          <TouchableOpacity onPress={() => setObscure(!obscure)} style={styles.iconButton}>
            <FontAwesome name={obscure ? 'eye-slash' : 'eye'} size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
        <View style={{ height: 20 }}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
        
        <View style={{ marginTop: 12 }}>
          {loading ? (
            <View style={{ paddingVertical: 16 }}><ActivityIndicator size="small" color="#9929EA" /></View>
          ) : (
            <GradientButton label="Unlock Wallet" onPressed={tryLogin} />
          )}
        </View>
        
        <View style={{ flex: 1 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1D1E',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  image: {
    width: 300,
    height: 300,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  inputError: {
    borderWidth: 1.5,
    borderColor: '#FE5353',
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    color: 'white',
    fontSize: 16,
  },
  iconButton: {
    padding: 8,
  },
  errorText: {
    color: '#FE5353',
    fontSize: 13,
    marginTop: 4,
    marginLeft: 4,
  },
});
