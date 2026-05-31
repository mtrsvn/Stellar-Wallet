import React from 'react';
import { View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface Props {
  address: string;
}

export function QRDisplay({ address }: Props) {
  return (
    <View style={styles.container}>
      <QRCode value={address || 'stellar'} size={180} backgroundColor="white" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, backgroundColor: 'white', borderRadius: 12 },
});
