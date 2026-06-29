import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, TextInput, Keyboard } from 'react-native';
import { HapticTouchableOpacity } from '../../src/components/HapticTouchableOpacity';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWallet } from '../context/WalletContext';
import { BottomSheet, handleStyle, sheetBaseStyle } from './BottomSheet';
import { GradientButton } from './GradientButton';
import { useRouter } from 'expo-router';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function WalletsSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const wallet = useWallet();
  const router = useRouter();

  const [step, setStep] = useState<'list' | 'name'>('list');
  const [action, setAction] = useState<'create' | 'import' | null>(null);
  const [walletName, setWalletName] = useState('');
  const [error, setError] = useState('');

  const handleClose = () => {
    setStep('list');
    setWalletName('');
    setError('');
    onClose();
  };

  const startAction = (act: 'create' | 'import') => {
    setAction(act);
    setStep('name');
  };

  const goBackToList = () => {
    Keyboard.dismiss();
    setStep('list');
    setError('');
  };

  const handleNameSubmit = () => {
    if (!walletName.trim()) {
      setError('Please provide a wallet name');
      return;
    }
    Keyboard.dismiss();
    const routeParams = { pathname: action === 'create' ? '/seed-reveal-intro' : '/import-wallet', params: { name: walletName.trim() } };
    handleClose();
    router.push(routeParams as any);
  };

  const handleSwitchAccount = (id: string) => {
    wallet.switchWallet(id);
    handleClose();
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose} avoidKeyboard={step === 'name'}>
      <View style={[sheetBaseStyle, styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.handleWrap}>
          <View style={handleStyle as any} />
        </View>

        {step === 'list' ? (
          <>
            <Text style={styles.title}>Your Wallets</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          {wallet.savedWallets.map((w, index) => {
            const isActive = w.id === wallet.activeWalletId;
            return (
              <HapticTouchableOpacity
                key={w.id}
                style={[styles.accountRow, isActive && styles.activeAccountRow]}
                onPress={() => handleSwitchAccount(w.id)}
              >
                <View style={[styles.iconWrap, isActive && styles.activeIconWrap]}>
                  <FontAwesome name="credit-card" size={16} color={isActive ? '#9C2CF0' : 'white'} />
                </View>
                <View style={styles.accountInfo}>
                  <Text style={[styles.accountName, isActive && styles.activeText]}>{w.name}</Text>
                  <Text style={styles.accountAddress} numberOfLines={1} ellipsizeMode="middle">
                    {w.address}
                  </Text>
                </View>
                {isActive && (
                  <FontAwesome name="check" size={16} color="#9C2CF0" style={styles.checkIcon} />
                )}
              </HapticTouchableOpacity>
            );
          })}

          <HapticTouchableOpacity style={styles.addAccountButton} onPress={() => startAction('create')}>
            <View style={styles.addIconWrap}>
              <FontAwesome name="plus" size={16} color="white" />
            </View>
            <Text style={styles.addAccountText}>Create New Wallet</Text>
          </HapticTouchableOpacity>

          <HapticTouchableOpacity style={styles.addAccountButton} onPress={() => startAction('import')}>
            <View style={styles.addIconWrap}>
              <FontAwesome name="download" size={16} color="white" />
            </View>
            <Text style={styles.addAccountText}>Import Existing Wallet</Text>
          </HapticTouchableOpacity>
        </ScrollView>
        </>
        ) : (
          <View>
            <HapticTouchableOpacity onPress={goBackToList} style={{ marginBottom: 16, width: 40, height: 40, justifyContent: 'center' }}>
              <FontAwesome name="chevron-left" size={20} color="white" />
            </HapticTouchableOpacity>
            <Text style={styles.title}>Name Your Wallet</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 24, fontSize: 15 }}>Enter a name so you can easily identify this wallet later.</Text>

            <TextInput
              style={[styles.nameInput, error ? { borderColor: '#FE5353' } : null]}
              placeholder="e.g. Main Wallet"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={walletName}
              onChangeText={(t) => { setWalletName(t); setError(''); }}
              autoFocus
            />
            {error ? <Text style={{ color: '#FE5353', marginTop: 8 }}>{error}</Text> : null}

            <View style={{ marginTop: 32 }}>
              <GradientButton label="Continue" onPressed={handleNameSubmit} />
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
    marginBottom: 20,
    marginTop: 4,
  },
  scroll: {
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  activeAccountRow: {
    backgroundColor: 'rgba(156,44,240,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(156,44,240,0.3)',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activeIconWrap: {
    backgroundColor: 'rgba(156,44,240,0.2)',
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  activeText: {
    color: '#9C2CF0',
  },
  accountAddress: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  checkIcon: {
    marginLeft: 12,
  },
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginTop: 8,
  },
  addIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addAccountText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
