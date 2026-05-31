import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Pass true for sheets that contain text inputs */
  avoidKeyboard?: boolean;
}

export function BottomSheet({ visible, onClose, children, avoidKeyboard = false }: Props) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(800)).current;
  const [mounted, setMounted] = useState(false);
  const kbHeight = useRef(new Animated.Value(0)).current;

  const resetKeyboardOffset = (animated = false) => {
    if (animated) {
      Animated.timing(kbHeight, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    } else {
      kbHeight.stopAnimation();
      kbHeight.setValue(0);
    }
  };

  useEffect(() => {
    if (visible) {
      resetKeyboardOffset();
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      resetKeyboardOffset();
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: 800, duration: 250, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !avoidKeyboard) {
      resetKeyboardOffset();
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const subShow = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(kbHeight, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });

    const subHide = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(kbHeight, {
        toValue: 0,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      subShow.remove();
      subHide.remove();
      resetKeyboardOffset();
    };
  }, [visible, avoidKeyboard]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent>
      <View style={styles.root}>
        {/* Backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* Sheet container pushed up by keyboard */}
        <Animated.View style={[styles.kavWrapper, { paddingBottom: kbHeight }]} pointerEvents="box-none">
          <Animated.View style={{ transform: [{ translateY: sheetY }] }} pointerEvents="auto">
            {children}
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export const sheetBaseStyle = {
  backgroundColor: '#18191A' as const,
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  paddingHorizontal: 24 as const,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: -6 },
  shadowOpacity: 0.5,
  shadowRadius: 20,
  elevation: 24,
};

export const handleStyle = {
  width: 40,
  height: 4,
  backgroundColor: 'rgba(255,255,255,0.2)' as const,
  borderRadius: 2,
  alignSelf: 'center' as const,
  marginBottom: 4,
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  kavWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
});
