import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { requestPasswordReset } from '../lib/api';
import { BandFlowLogo } from './BandFlowLogo';

type ForgotPasswordProps = {
  isDarkTheme: boolean;
  initialEmail?: string;
  onBackToLogin: () => void;
};

const steps = [
  'Your boss sees the request in Manage Workers.',
  'They set a temporary password and share it with you.',
  'Log in with it, then choose a new one in Settings.',
];

export default function ForgotPassword({ isDarkTheme, initialEmail = '', onBackToLogin }: ForgotPasswordProps) {
  const [email, setEmail] = useState(initialEmail);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState('');

  const handleSubmit = async () => {
    setErrorMessage('');
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMessage('Enter the email address you log in with.');
      return;
    }
    setIsSubmitting(true);
    try {
      await requestPasswordReset(trimmed);
      setSentTo(trimmed);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to send the request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Same palette as Login.tsx and SignUp.tsx.
  const theme = isDarkTheme
    ? {
        background: '#07111F',
        surface: 'rgba(11, 22, 39, 0.92)',
        cardBorder: 'rgba(161, 182, 214, 0.18)',
        title: '#F4F8FF',
        subtitle: '#A7B4C9',
        label: '#DDE7F3',
        inputBg: '#0D1A2D',
        inputBorder: 'rgba(161, 182, 214, 0.18)',
        inputText: '#F4F8FF',
        link: '#8FC4FF',
        footer: '#7F8A9D',
        buttonBg: '#56A7FF',
        buttonText: '#04111F',
        accentSoft: 'rgba(86, 167, 255, 0.16)',
        success: '#7CE1BB',
        successSoft: 'rgba(85, 214, 167, 0.16)',
        noteBg: '#10243F',
        noteBorder: 'rgba(161, 182, 214, 0.35)',
      }
    : {
        background: '#EEF5FF',
        surface: '#FFFFFF',
        cardBorder: '#D6E4F5',
        title: '#14243A',
        subtitle: '#4A5D77',
        label: '#223A59',
        inputBg: '#F7FAFF',
        inputBorder: '#CFE0F3',
        inputText: '#152A42',
        link: '#1A67C9',
        footer: '#516783',
        buttonBg: '#1A67C9',
        buttonText: '#FFFFFF',
        accentSoft: '#D8EAFE',
        success: '#14744E',
        successSoft: '#D7F4E9',
        noteBg: '#F4F9FF',
        noteBorder: '#C7DAF2',
      };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <BandFlowLogo height={72} isDarkTheme={isDarkTheme} />
          </View>

          <Text style={[styles.title, { color: theme.title }]}>{sentTo ? 'Request sent' : 'Forgot password?'}</Text>
          <Text style={[styles.subtitle, { color: theme.subtitle }]}>
            {sentTo ? 'Your boss will set a temporary password for you.' : "No problem. We'll ask your boss to set a temporary password."}
          </Text>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            {sentTo ? (
              <>
                <View style={[styles.successIcon, { backgroundColor: theme.successSoft }]}>
                  <Text style={[styles.successIconText, { color: theme.success }]}>✓</Text>
                </View>
                <Text style={[styles.successText, { color: theme.subtitle }]}>
                  If <Text style={{ color: theme.title, fontWeight: '800' }}>{sentTo}</Text> belongs to a worker account, the request is waiting for your boss.
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: theme.label }]}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#8B96A8"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="send"
                  onSubmitEditing={() => void handleSubmit()}
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
                />
                <Pressable onPress={() => void handleSubmit()} disabled={isSubmitting} style={[styles.primaryButton, { backgroundColor: theme.buttonBg }]}>
                  {isSubmitting ? <ActivityIndicator color={theme.buttonText} /> : <Text style={[styles.primaryButtonText, { color: theme.buttonText }]}>Send request</Text>}
                </Pressable>
                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
              </>
            )}

            <Text style={[styles.stepsHeading, { color: theme.label }]}>WHAT HAPPENS NEXT</Text>
            {steps.map((step, index) => (
              <View key={step} style={styles.stepRow}>
                <View style={[styles.stepNumber, { backgroundColor: theme.accentSoft }]}>
                  <Text style={[styles.stepNumberText, { color: theme.link }]}>{index + 1}</Text>
                </View>
                <Text style={[styles.stepText, { color: theme.subtitle }]}>{step}</Text>
              </View>
            ))}

            <View style={styles.loginRow}>
              <Text style={[styles.loginPrompt, { color: theme.subtitle }]}>Remembered it?</Text>
              <Pressable onPress={onBackToLogin} hitSlop={8}>
                <Text style={[styles.link, { color: theme.link }]}>Back to log in</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.note, { backgroundColor: theme.noteBg, borderColor: theme.noteBorder }]}>
            <Text style={styles.noteIcon}>🔑</Text>
            <Text style={[styles.noteText, { color: theme.subtitle }]}>
              <Text style={{ color: theme.title, fontWeight: '800' }}>Boss account? </Text>
              Reset it on the computer running the BandFlow server with{' '}
              <Text style={[styles.code, { color: theme.title }]}>npm run reset-password</Text>.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 80, paddingBottom: 36, justifyContent: 'flex-start' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '900', marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 21, marginBottom: 22 },
  card: { borderWidth: 1, borderRadius: 22, padding: 18 },
  label: { fontSize: 13, fontWeight: '800', marginBottom: 8 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 15, marginBottom: 16 },
  primaryButton: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 4 },
  primaryButtonText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  errorText: { color: '#E85D75', fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 12 },
  successIcon: { width: 56, height: 56, borderRadius: 28, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  successIconText: { fontSize: 28, fontWeight: '900' },
  successText: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 12 },
  stepsHeading: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginTop: 22, marginBottom: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 12, fontWeight: '900' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 18 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10 },
  loginPrompt: { fontSize: 13 },
  link: { fontSize: 13, fontWeight: '800' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 16 },
  noteIcon: { fontSize: 16 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
  code: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 12 },
});
