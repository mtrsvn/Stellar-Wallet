import React from 'react';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';
import * as Haptics from 'expo-haptics';

export function HapticTouchableOpacity(props: TouchableOpacityProps) {
  const { onPress, ...rest } = props;

  const handlePress = (e: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) {
      onPress(e);
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} {...rest}>
      {props.children}
    </TouchableOpacity>
  );
}
