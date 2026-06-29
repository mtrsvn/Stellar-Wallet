import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  PanResponder,
  Dimensions,
  Modal,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  avoidKeyboard?: boolean;
}

export function BottomSheet({ visible, onClose, children, avoidKeyboard = false }: Props) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [mounted, setMounted] = useState(false);
  const kbHeight = useRef(new Animated.Value(0)).current;

  const sheetYVal = useRef(SCREEN_HEIGHT);

  useEffect(() => {
    const id = sheetY.addListener((v) => {
      sheetYVal.current = v.value;
    });
    return () => sheetY.removeListener(id);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        sheetY.stopAnimation();
        sheetY.setOffset(sheetYVal.current);
        sheetY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          sheetY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        sheetY.flattenOffset();
        if (gestureState.dy > 120 || gestureState.vy > 0.6) {
          onClose();
        } else {
          Animated.spring(sheetY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 0,
          }).start();
        }
      },
    })
  ).current;

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
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: 0, duration: 300, useNativeDriver: false }),
      ]).start();
    } else if (mounted) {
      resetKeyboardOffset();
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: false }),
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
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose}>
      <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]} pointerEvents="box-none">
        {/* Backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]} pointerEvents="auto">
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.75)' }]} />
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* Sheet container */}
        <Animated.View style={[styles.kavWrapper, { paddingBottom: kbHeight }]} pointerEvents="box-none">
          <Animated.View style={{ transform: [{ translateY: sheetY }] }} pointerEvents="auto" {...panResponder.panHandlers}>
            {children}
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export const sheetBaseStyle = {
  backgroundColor: '#0B0B0E' as const,
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
  kavWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
});
