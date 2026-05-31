import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { WalletProvider } from '../src/context/WalletContext';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setPositionAsync('absolute');
      NavigationBar.setBackgroundColorAsync('#ffffff00');
    }
  }, []);

  return (
    <WalletProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#1C1D1E' } }} />
    </WalletProvider>
  );
}
