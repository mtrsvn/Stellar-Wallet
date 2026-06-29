import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { HapticTouchableOpacity } from '../src/components/HapticTouchableOpacity';
import { FontAwesome } from '@expo/vector-icons';
import { Delete, ScanFace } from "lucide-react-native";
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { useWallet } from '../src/context/WalletContext';
import { GradientButton } from '../src/components/GradientButton';

export default function SecuritySetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const wallet = useWallet();
  
  const [step, setStep] = useState<'enter' | 'confirm' | 'biometrics'>('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [hasHardware, setHasHardware] = useState(false);

  useEffect(() => {
    const checkBio = async () => {
      const hw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setHasHardware(hw && enrolled);
    };
    checkBio();
  }, []);

  const handlePress = (num: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (step === 'enter') {
      if (pin.length < 4) {
        const newPin = pin + num;
        setPin(newPin);
        setError('');
        if (newPin.length === 4) {
          setTimeout(() => setStep('confirm'), 300);
        }
      }
    } else if (step === 'confirm') {
      if (confirmPin.length < 4) {
        const newPin = confirmPin + num;
        setConfirmPin(newPin);
        setError('');
        if (newPin.length === 4) {
          verifySetup(newPin);
        }
      }
    }
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 'enter' && pin.length > 0) {
      setPin(pin.slice(0, -1));
      setError('');
    } else if (step === 'confirm' && confirmPin.length > 0) {
      setConfirmPin(confirmPin.slice(0, -1));
      setError('');
    }
  };

  const verifySetup = (enteredConfirm: string) => {
    if (pin === enteredConfirm) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (hasHardware) {
        setTimeout(() => setStep('biometrics'), 400);
      } else {
        finishSetup(false);
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('PINs do not match. Try again.');
      setTimeout(() => {
        setConfirmPin('');
      }, 500);
    }
  };

  const finishSetup = async (enableBiometrics: boolean) => {
    await wallet.savePin(pin);
    if (enableBiometrics) {
      await wallet.setBiometrics(true);
    }
    
    const nextPath = params.next as string;
    if (nextPath) {
      router.push({ pathname: nextPath, params: { name: params.name } } as any);
    } else {
      router.push({ pathname: '/seed-reveal-intro', params: { name: params.name } } as any);
    }
  };

  const handleEnableBiometrics = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Enable Biometric Login',
      fallbackLabel: 'Use PIN',
    });
    if (result.success) {
      finishSetup(true);
    }
  };

  const renderDots = () => {
    const currentPin = step === 'enter' ? pin : confirmPin;
    return (
      <View style={styles.dotsContainer}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              currentPin.length > i && styles.dotActive,
              error.length > 0 && styles.dotError,
            ]}
          />
        ))}
      </View>
    );
  };

  const renderKeypad = () => {
    const rows = [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["", "0", "delete"],
    ];

    return (
      <View style={styles.keypad}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((key, colIndex) => {
              if (key === "") {
                return <View key={colIndex} style={{ width: 72, height: 72 }} />;
              }
              if (key === "delete") {
                return (
                  <HapticTouchableOpacity
                    key={colIndex}
                    style={styles.key}
                    onPress={handleDelete}
                  >
                    <Delete size={28} color="rgba(255,255,255,0.7)" />
                  </HapticTouchableOpacity>
                );
              }
              return (
                <HapticTouchableOpacity
                  key={colIndex}
                  style={styles.key}
                  onPress={() => handlePress(key)}
                >
                  <Text style={styles.keyText}>{key}</Text>
                </HapticTouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  if (step === 'biometrics') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.content, { justifyContent: 'center', paddingHorizontal: 24 }]}>
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <ScanFace size={80} color="#9C2CF0" />
            <Text style={[styles.title, { marginTop: 24, textAlign: 'center' }]}>Enable Biometrics</Text>
            <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 12 }]}>
              Use Face ID or Touch ID for faster and more secure access to your wallet.
            </Text>
          </View>
          <View style={{ width: '100%', gap: 16 }}>
            <GradientButton label="Enable Biometrics" onPressed={handleEnableBiometrics} />
            <HapticTouchableOpacity style={styles.skipButton} onPress={() => finishSetup(false)}>
              <Text style={styles.skipText}>Skip for now</Text>
            </HapticTouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <HapticTouchableOpacity 
            style={styles.backButton} 
            onPress={() => {
              if (step === 'confirm') {
                setStep('enter');
                setConfirmPin('');
                setPin('');
                setError('');
              } else {
                router.back();
              }
            }}
          >
            <FontAwesome name="chevron-left" size={20} color="white" />
          </HapticTouchableOpacity>
          <Text style={styles.title}>
            {step === 'enter' ? "Create PIN" : "Confirm PIN"}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'enter' ? "Secure your wallet with a 4-digit PIN" : "Enter your PIN again to confirm"}
          </Text>
        </View>

        <View style={styles.pinSection}>
          {renderDots()}
          <View style={{ height: 24, marginTop: 16 }}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        </View>

        <View style={styles.keypadSection}>{renderKeypad()}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0E",
  },
  content: {
    flex: 1,
    paddingTop: 20,
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: 24,
    width: '100%',
  },
  backButton: {
    position: 'absolute',
    left: 24,
    top: 0,
    width: 40,
    height: 40,
    justifyContent: 'center',
    zIndex: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "white",
    marginBottom: 8,
    marginTop: 40,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 22,
  },
  pinSection: {
    alignItems: "center",
    marginVertical: 40,
  },
  dotsContainer: {
    flexDirection: "row",
    gap: 20,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  dotActive: {
    backgroundColor: "#9C2CF0",
    borderColor: "#9C2CF0",
  },
  dotError: {
    backgroundColor: "#FE5353",
    borderColor: "#FE5353",
  },
  errorText: {
    color: "#FE5353",
    fontSize: 14,
    fontWeight: "500",
  },
  keypadSection: {
    width: "100%",
    paddingHorizontal: 40,
  },
  keypad: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  keyText: {
    fontSize: 28,
    fontWeight: "600",
    color: "white",
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  skipText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
    fontWeight: '600',
  }
});
