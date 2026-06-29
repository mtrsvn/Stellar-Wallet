import React from 'react';
import { View, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  avoidKeyboard?: boolean;
}

export function BottomSheet({ visible, onClose, children, avoidKeyboard = false }: Props) {
  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      propagateSwipe={true}
      style={styles.modal}
      avoidKeyboard={avoidKeyboard}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      backdropOpacity={0.75}
      useNativeDriverForBackdrop={true}
      hideModalContentWhileAnimating={true}
    >
      <View style={styles.sheetContainer}>
        {children}
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
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
  },
});
