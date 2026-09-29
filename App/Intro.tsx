import React from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BandFlowLogo } from './BandFlowLogo';

type IntroProps = {
  isDarkTheme: boolean;
  onProceed: () => void;
};

export default function Intro({ isDarkTheme, onProceed }: IntroProps) {
  const theme = isDarkTheme
    ? {
        background: '#07111F',
        title: '#F4F8FF',
        buttonBg: '#56A7FF',
        buttonText: '#04111F',
      }
    : {
        background: '#EEF5FF',
        title: '#14243A',
        buttonBg: '#1A67C9',
        buttonText: '#FFFFFF',
      };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.centerContent}>
        <BandFlowLogo height={130} isDarkTheme={isDarkTheme} />
      </View>

      <View style={styles.bottomArea}>
        <Pressable style={[styles.proceedButton, { backgroundColor: theme.buttonBg }]} onPress={onProceed}>
          <Text style={[styles.proceedButtonText, { color: theme.buttonText }]}>Proceed to Login</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: -40,
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 26,
  },
  proceedButton: {
    borderRadius: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proceedButtonText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
