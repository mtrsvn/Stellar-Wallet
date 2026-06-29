import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { HapticTouchableOpacity } from '../../src/components/HapticTouchableOpacity';

import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface Props {
  label: string;
  onPressed: () => void;
  disabled?: boolean;
  outline?: boolean;
}

export function GradientButton({ label, onPressed, disabled, outline }: Props) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPressed();
  };

  if (outline) {
    return (
      <HapticTouchableOpacity onPress={handlePress} disabled={disabled} style={[{ width: "100%", borderWidth: 1, borderColor: "#9C2CF0", borderRadius: 14, paddingVertical: 16, alignItems: "center", justifyContent: "center" }]} activeOpacity={0.8}>
        <Text style={[styles.label, { color: "#9C2CF0" }]}>{label}</Text>
      </HapticTouchableOpacity>
    );
  }
  return (
    <HapticTouchableOpacity onPress={handlePress} disabled={disabled} style={{ width: '100%' }} activeOpacity={0.8}>
      <LinearGradient
        colors={disabled ? ['#333', '#222'] : ['#9C2CF0', '#7A19D9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.button}
      >
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </HapticTouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  label: { color: 'white', fontSize: 16, fontWeight: '700' },
});
