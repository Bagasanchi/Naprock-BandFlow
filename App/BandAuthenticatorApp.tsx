import React from 'react';
import { Image, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

type BandAuthenticatorAppProps = {
  isDarkTheme: boolean;
};

export default function BandAuthenticatorApp({ isDarkTheme }: BandAuthenticatorAppProps) {
  const theme = isDarkTheme
    ? {
        background: '#07111F',
        cardBg: 'rgba(11, 22, 39, 0.92)',
        cardBorder: 'rgba(161, 182, 214, 0.2)',
        title: '#F4F8FF',
        subtitle: '#A7B4C9',
        buttonBg: '#56A7FF',
        buttonText: '#04111F',
        secondaryBg: 'rgba(86, 167, 255, 0.08)',
        secondaryBorder: '#56A7FF',
        secondaryText: '#B9DBFF',
      }
    : {
        background: '#EEF5FF',
        cardBg: '#FFFFFF',
        cardBorder: '#D6E4F5',
        title: '#14243A',
        subtitle: '#4A5D77',
        buttonBg: '#1A67C9',
        buttonText: '#FFFFFF',
        secondaryBg: '#F6FAFF',
        secondaryBorder: '#1A67C9',
        secondaryText: '#1A67C9',
      };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.heading}>
            <Text style={[styles.title, { color: theme.title }]}>Link Your Band</Text>
            <Text style={[styles.subtitle, { color: theme.subtitle }]}>Use the app as a biometric authenticator</Text>
          </View>

          <View style={styles.pairingContent}>
            <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />

            <Text style={[styles.prompt, { color: theme.title }]}>Tap the band to link</Text>
            <Text style={[styles.instruction, { color: theme.subtitle }]}>Hold your biometric band near the device</Text>

            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <View style={styles.statusDot} />
                <Text style={[styles.statusText, { color: theme.subtitle }]}>Band detected</Text>
              </View>
              <View style={styles.statusItem}>
                <View style={styles.statusDot} />
                <Text style={[styles.statusText, { color: theme.subtitle }]}>Biometric read</Text>
              </View>
              <View style={styles.statusItem}>
                <View style={styles.statusDot} />
                <Text style={[styles.statusText, { color: theme.subtitle }]}>Identity verified</Text>
              </View>
            </View>
          </View>

          <Pressable style={[styles.primaryButton, { backgroundColor: theme.buttonBg }]}>
            <Text style={[styles.primaryButtonText, { color: theme.buttonText }]}>Tap to Pair Band</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  heading: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 28,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  pairingContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  logo: {
    width: 132,
    height: 132,
    borderRadius: 28,
    marginBottom: 26,
  },
  prompt: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  instruction: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 28,
  },
  statusRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8C96A3',
    marginTop: 4,
    marginRight: 5,
  },
  statusText: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'left',
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    alignSelf: 'stretch',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
