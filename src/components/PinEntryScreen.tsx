import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Delete, ScanFace } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import { useWallet } from "../context/WalletContext";
import { HapticTouchableOpacity } from "./HapticTouchableOpacity";

interface PinEntryScreenProps {
  onUnlock: () => void;
  onLogout: () => void;
  forRemoval?: boolean;
}

export function PinEntryScreen({ onUnlock, onLogout, forRemoval = false }: PinEntryScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [hasHardware, setHasHardware] = useState(false);
  const wallet = useWallet();

  useEffect(() => {
    if (wallet.isLocked && wallet.lockedUntil) {
      const interval = setInterval(() => {
        setNow(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [wallet.isLocked, wallet.lockedUntil]);

  const isAccountLocked = () => {
    if (wallet.isLocked && wallet.lockedUntil) {
      const lockEnd = new Date(wallet.lockedUntil).getTime();
      return lockEnd > now;
    }
    return false;
  };

  const getLockTimeRemaining = () => {
    if (!wallet.lockedUntil) return "";
    const lockEnd = new Date(wallet.lockedUntil).getTime();
    const diff = lockEnd - now;
    if (diff <= 0) return "";
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const checkBiometrics = async () => {
      const hw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setHasHardware(hw && enrolled);

      if (wallet.biometricEnabled && !forRemoval && hw && enrolled) {
        handleBiometricAuth();
      }
    };
    checkBiometrics();
  }, [wallet.biometricEnabled, forRemoval]);

  const handleBiometricAuth = async () => {
    if (isAccountLocked()) return;
    
    try {
      const hw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (hw && enrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock Wallet',
          fallbackLabel: 'Use PIN',
          disableDeviceFallback: true,
        });

        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (wallet.pinAttempt > 0 || wallet.isLocked) {
             await wallet.updatePinAttempts(0, null);
          }
          onUnlock();
        }
      }
    } catch (e) {
      console.log('Biometric auth error', e);
    }
  };

  const handlePress = (num: string) => {
    if (isAccountLocked()) {
      setError(`Access is suspended. Try again in ${getLockTimeRemaining()}.`);
      return;
    }
    if (pin.length < 4) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newPin = pin + num;
      setPin(newPin);
      setError("");

      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPin(pin.slice(0, -1));
      setError("");
    }
  };

  const verifyPin = async (enteredPin: string) => {
    if (isAccountLocked()) {
      setError(`Access is suspended. Try again in ${getLockTimeRemaining()}.`);
      setPin("");
      return;
    }

    setLoading(true);
    
    // Slight delay for UX
    setTimeout(async () => {
      if (wallet.userPin) {
        if (enteredPin === wallet.userPin) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (wallet.pinAttempt > 0 || wallet.isLocked) {
            await wallet.updatePinAttempts(0, null);
          }
          onUnlock();
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          
          let currentAttempts = wallet.pinAttempt || 0;
          if (wallet.isLocked && wallet.lockedUntil) {
            const lockEnd = new Date(wallet.lockedUntil).getTime();
            if (Date.now() >= lockEnd) {
              currentAttempts = 0;
            }
          }
          const attempts = currentAttempts + 1;
          
          if (attempts >= 3) {
            const unlockTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
            await wallet.updatePinAttempts(attempts, unlockTime);
            setError("Access temporarily suspended. Please try again in 60:00.");
          } else {
            await wallet.updatePinAttempts(attempts, null);
            setError(`Incorrect PIN. ${3 - attempts} attempt${3 - attempts !== 1 ? 's' : ''} remaining.`);
          }
          
          setPin("");
          setLoading(false);
        }
      } else {
        // Fallback: if PIN is missing in storage but they are here, just let them in to reset it.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onUnlock();
      }
    }, 500);
  };

  const renderDots = () => {
    return (
      <View style={styles.dotsContainer}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              pin.length > i && styles.dotActive,
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
      <View style={[styles.keypad, isAccountLocked() && { opacity: 0.3 }]} pointerEvents={isAccountLocked() ? "none" : "auto"}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((key, colIndex) => {
              if (key === "") {
                if (hasHardware && !forRemoval) {
                  return (
                    <HapticTouchableOpacity
                      key={colIndex}
                      style={[styles.key, { backgroundColor: 'transparent' }]}
                      onPress={handleBiometricAuth}
                      disabled={loading || isAccountLocked()}
                    >
                      <ScanFace size={28} color="rgba(255,255,255,0.7)" />
                    </HapticTouchableOpacity>
                  );
                }
                return <View key={colIndex} style={{ width: 72, height: 72 }} />;
              }
              if (key === "delete") {
                return (
                  <HapticTouchableOpacity
                    key={colIndex}
                    style={styles.key}
                    onPress={handleDelete}
                    disabled={loading}
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
                  disabled={loading}
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {isAccountLocked() ? "Access Suspended" : forRemoval ? "Remove PIN" : "Enter Security PIN"}
          </Text>
          <Text style={styles.subtitle}>
            {isAccountLocked() 
              ? `For your security, access has been temporarily suspended due to multiple unsuccessful attempts. Please try again in ${getLockTimeRemaining()}.` 
              : forRemoval
              ? "Enter your 4-digit PIN to confirm removal"
              : "Please enter your 4-digit PIN to unlock your wallet."}
          </Text>
        </View>

        <View style={styles.pinSection}>
          {!isAccountLocked() && renderDots()}
          <View style={{ height: 24, marginTop: 16 }}>
            {error || isAccountLocked() ? (
              <Text style={styles.errorText}>
                {error || `Access is suspended. Try again in ${getLockTimeRemaining()}.`}
              </Text>
            ) : null}
            {loading ? <ActivityIndicator size="small" color="#9C2CF0" /> : null}
          </View>
        </View>

        <View style={styles.keypadSection}>{renderKeypad()}</View>

        <View style={{ alignItems: "center", paddingVertical: 10 }}>
          {!forRemoval && (
            <HapticTouchableOpacity 
              onPress={() => {
                Alert.alert(
                  "Forgot PIN?",
                  "If you forgot your PIN, the only way to recover your funds is to delete the current wallet and import it again using your Seed Phrase.\n\nAre you sure you want to delete this wallet?",
                  [
                    { text: "Cancel", style: "cancel" },
                    { 
                      text: "Delete Wallet", 
                      style: "destructive", 
                      onPress: async () => {
                        await wallet.logout();
                        onLogout();
                      } 
                    }
                  ]
                );
              }} 
              style={{ paddingVertical: 16 }}
            >
              <Text style={[styles.logoutText, { color: "#9C2CF0" }]}>Forgot PIN?</Text>
            </HapticTouchableOpacity>
          )}
          {forRemoval && (
            <HapticTouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Cancel</Text>
            </HapticTouchableOpacity>
          )}
        </View>
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
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "white",
    marginBottom: 8,
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
  logoutBtn: {
    padding: 16,
  },
  logoutText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontWeight: "600",
  },
});
