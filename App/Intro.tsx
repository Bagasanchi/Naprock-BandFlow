import React from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type IntroProps = {
  isDarkTheme: boolean;
  onProceed: () => void;
};

export default function Intro({ isDarkTheme, onProceed }: IntroProps) {
  const theme = isDarkTheme
    ? {
        background: '#07111F',
        title: '#F4F8FF',
        brand: '#A7CFFF',
        buttonBg: '#56A7FF',
        buttonText: '#04111F',
      }
    : {
        background: '#EEF5FF',
        title: '#14243A',
        brand: '#1A67C9',
        buttonBg: '#1A67C9',
        buttonText: '#FFFFFF',
      };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.centerContent}>
        <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.brandText, { color: theme.brand }]}>BandFlow</Text>
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
  logo: {
    width: 126,
    height: 126,
    marginBottom: 16,
    borderRadius: 28,
  },
  brandText: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900',
    letterSpacing: 0.3,
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
