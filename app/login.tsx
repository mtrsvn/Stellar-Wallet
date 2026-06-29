import React from 'react';
import { useRouter } from 'expo-router';
import { PinEntryScreen } from '../src/components/PinEntryScreen';

export default function LoginScreen() {
  const router = useRouter();

  const handleUnlock = () => {
    router.replace('/(tabs)' as any);
  };

  const handleLogout = () => {
    router.replace('/' as any);
  };

  return (
    <PinEntryScreen onUnlock={handleUnlock} onLogout={handleLogout} />
  );
}

