import React from 'react';
import { Image, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

type BandAuthProps = {
  isDarkTheme: boolean;
};

export default function BandAuth({ isDarkTheme }: BandAuthProps) {
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
        connectorText: '#DCECFF',
        connectorLine: 'rgba(161, 182, 214, 0.45)',
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
        connectorText: '#244E7E',
        connectorLine: '#A8C5E9',
      };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.container}>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.questionTitle, { color: theme.title }]}>Authenticated with the band yet?</Text>
          <Text style={[styles.questionSubtitle, { color: theme.subtitle }]}>Use your biometric band for secure, passwordless access to your workspace.</Text>

          <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />

          <Pressable style={[styles.primaryButton, { backgroundColor: theme.buttonBg }]}>
            <Text style={[styles.primaryButtonText, { color: theme.buttonText }]}>Yes, Already Authenticated</Text>
          </Pressable>

          <Pressable
            style={[
              styles.secondaryButton,
              { backgroundColor: theme.secondaryBg, borderColor: theme.secondaryBorder },
            ]}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.secondaryText }]}>Use App as Authenticator with the Band</Text>
          </Pressable>

          <View style={styles.connectorRow}>
            <Text style={[styles.connectorText, { color: theme.connectorText }]}>Worker 👷</Text>
            <View style={[styles.connectorLine, { backgroundColor: theme.connectorLine }]} />
            <Text style={[styles.connectorBot, { color: theme.connectorText }]}>🤖</Text>
            <View style={[styles.connectorLine, { backgroundColor: theme.connectorLine }]} />
            <Text style={[styles.connectorText, { color: theme.connectorText }]}>Boss 😎</Text>
          </View>
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
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  logo: {
    width: 92,
    height: 92,
    borderRadius: 22,
    alignSelf: 'center',
    marginBottom: 20,
  },
  questionTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  questionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  primaryButton: {
    minHeight: 50,
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
  secondaryButton: {
    marginTop: 10,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    alignSelf: 'stretch',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  connectorRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectorText: {
    fontSize: 13,
    fontWeight: '700',
  },
  connectorBot: {
    fontSize: 20,
    marginHorizontal: 6,
  },
  connectorLine: {
    height: 1,
    width: 26,
    marginHorizontal: 8,
  },
});
