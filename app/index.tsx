import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useWallet } from '../src/context/WalletContext';
import { Redirect } from 'expo-router';

export default function AuthWrapper() {
  const wallet = useWallet();

  if (wallet.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1C1D1E', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#9929EA" />
      </View>
    );
  }

  if (wallet.isCreated) {
    return <Redirect href={"/login" as any} />;
  }
  
  return <Redirect href={"/welcome" as any} />;
}
