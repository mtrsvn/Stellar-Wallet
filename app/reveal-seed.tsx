import 'react-native-get-random-values';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { ethers } from 'ethers';
import { GradientButton } from '../src/components/GradientButton';
import * as ScreenCapture from 'expo-screen-capture';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWallet } from '../src/context/WalletContext';
import { BottomSheet, sheetBaseStyle, handleStyle } from '../src/components/BottomSheet';

export default function RevealSeedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const wallet = useWallet();
  const insets = useSafeAreaInsets();
  const [words, setWords] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>(Array(12).fill(false));
  const [reminderVisible, setReminderVisible] = useState(true);

  useEffect(() => {
    setReminderVisible(false);
  }, []);

  ScreenCapture.useScreenshotListener(() => {
    setReminderVisible(true);
  });

  useEffect(() => {
    const mnemonic = ethers.Wallet.createRandom().mnemonic?.phrase || '';
    const wordArray = mnemonic.split(' ');
    setWords(wordArray);
    const wName = params.name as string | undefined;
    wallet.addNewWallet(mnemonic, wName);
  }, []);

  const toggleReveal = (index: number) => {
    const newRevealed = [...revealed];
    newRevealed[index] = true;
    setRevealed(newRevealed);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="chevron-left" size={20} color="white" />
        </TouchableOpacity>
        
        <Text style={styles.title}>Recovery Phrase</Text>
        <Text style={styles.subtitle}>Tap to reveal each word. Write them down in order.</Text>

        <View style={styles.grid}>
          {words.map((word, index) => (
            <TouchableOpacity key={index} style={styles.wordTile} onPress={() => toggleReveal(index)}>
              {revealed[index] ? (
                <Text style={styles.wordText}>{index + 1}. {word}</Text>
              ) : (
                <Text style={styles.hiddenText}>Tap to reveal</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flex: 1, minHeight: 40 }} />
        <GradientButton label="I've written it down" onPressed={() => router.push('/verify-seed' as any)} />
        <View style={{ height: 20 }} />
      </View>

      <BottomSheet visible={reminderVisible} onClose={() => setReminderVisible(false)}>
        <View style={[sheetBaseStyle, styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}> 
          <View style={handleStyle} />
          <Text style={styles.modalTitle}>Write it down now</Text>
          <Text style={styles.modalSubtitle}>
            This is your seed phrase. Store it safely offline and never share or screenshot it.
          </Text>

          <GradientButton label="I understand" onPressed={() => setReminderVisible(false)} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0E' },
  content: { flex: 1, padding: 24 },
  backButton: { marginTop: 4, marginBottom: 24, width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 8 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  wordTile: { width: '47%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 12, alignItems: 'center', justifyContent: 'center', height: 52 },
  wordText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  hiddenText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontStyle: 'italic' },
  sheet: { paddingTop: 12 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: 'white', textAlign: 'center', marginBottom: 10 },
  modalSubtitle: { fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.72)', textAlign: 'center', marginBottom: 22 },
});
