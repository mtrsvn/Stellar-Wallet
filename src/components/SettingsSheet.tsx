import React, { useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    TextInput,
    Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWallet } from '../context/WalletContext';
import { BottomSheet, handleStyle, sheetBaseStyle } from './BottomSheet';
import { GradientButton } from './GradientButton';
import { FontAwesome } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  onLogoutSuccess: () => void;
}

export function SettingsSheet({ visible, onClose, onLogoutSuccess }: Props) {
  const wallet = useWallet();
  const insets = useSafeAreaInsets();
  
  const [step, setStep] = useState<'menu' | 'rename'>('menu');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const activeWallet = wallet.savedWallets.find(w => w.id === wallet.activeWalletId);

  const handleClose = () => {
    setStep('menu');
    setNewName('');
    setError('');
    onClose();
  };

  const handleRemoveWallet = () => {
    Alert.alert(
      'Remove Wallet',
      'Are you sure? Make sure you have backed up your seed phrase.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const isFullyLoggedOut = await wallet.removeActiveWallet();
            handleClose();
            if (isFullyLoggedOut) {
              onLogoutSuccess();
            }
          },
        },
      ]
    );
  };

  const handleRenameSubmit = async () => {
    if (!newName.trim()) {
      setError('Please provide a wallet name');
      return;
    }
    Keyboard.dismiss();
    await wallet.renameActiveWallet(newName.trim());
    handleClose();
  };

  const goBackToMenu = () => {
    Keyboard.dismiss();
    setStep('menu');
    setError('');
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose} avoidKeyboard={step === 'rename'}>
      <View style={[sheetBaseStyle, styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        {/* Drag handle */}
        <View style={styles.handleWrap}>
          <View style={handleStyle as any} />
        </View>

        {step === 'menu' ? (
          <>
            <Text style={styles.title}>Settings</Text>

            <TouchableOpacity style={styles.actionButton} onPress={() => {
              setNewName(activeWallet?.name || '');
              setStep('rename');
            }} activeOpacity={0.8}>
              <Text style={styles.actionText}>Rename Wallet</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={handleRemoveWallet} activeOpacity={0.8}>
              <Text style={styles.logoutText}>Remove Wallet</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={{ paddingBottom: 20 }}>
            <TouchableOpacity onPress={goBackToMenu} style={{ marginBottom: 16, width: 40, height: 40, justifyContent: 'center' }}>
              <FontAwesome name="chevron-left" size={20} color="white" />
            </TouchableOpacity>

            <Text style={{ color: 'white', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>Rename Wallet</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 24 }}>Update how this wallet appears in your list.</Text>

            <TextInput
              style={[styles.nameInput, error ? { borderColor: '#FE5353' } : null]}
              placeholder="e.g. Savings Wallet"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={newName}
              onChangeText={(t) => { setNewName(t); setError(''); }}
              autoFocus
            />
            {error ? <Text style={{ color: '#FE5353', marginTop: 8 }}>{error}</Text> : null}

            <View style={{ marginTop: 32 }}>
              <GradientButton label="Save Changes" onPressed={handleRenameSubmit} />
            </View>
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {},
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 32,
    marginTop: 4,
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  logoutButton: {
    backgroundColor: 'rgba(254,83,83,0.12)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  logoutText: {
    color: '#FE5353',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54,
    color: 'white',
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  }
});
