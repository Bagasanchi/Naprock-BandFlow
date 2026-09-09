import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

type SignUpProps = {
  isDarkTheme: boolean;
  onSignUp: () => void;
  onBackToLogin: () => void;
};

export default function SignUp({ isDarkTheme, onSignUp, onBackToLogin }: SignUpProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignUp = async () => {
    setErrorMessage('');

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setErrorMessage('Complete all fields to create your account.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!supabase) {
      setErrorMessage('Add your Supabase values to the local .env file first.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
      },
    });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    onSignUp();
  };

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
      };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandRow}>
            <Image source={require('../assets/icon.png')} style={styles.brandLogo} resizeMode="contain" />
            <Text style={[styles.brandText, { color: theme.title }]}>Workspace Pro</Text>
          </View>

          <Text style={[styles.title, { color: theme.title }]}>Create your account</Text>
          <Text style={[styles.subtitle, { color: theme.subtitle }]}>Start managing your workspace</Text>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[styles.label, { color: theme.label }]}>Full name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              placeholderTextColor="#8B96A8"
              autoCapitalize="words"
              textContentType="name"
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
            />

            <Text style={[styles.label, { color: theme.label }]}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#8B96A8"
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
            />

            <Text style={[styles.label, { color: theme.label }]}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              placeholderTextColor="#8B96A8"
              secureTextEntry
              textContentType="newPassword"
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
            />

            <Text style={[styles.label, { color: theme.label }]}>Confirm password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat your password"
              placeholderTextColor="#8B96A8"
              secureTextEntry
              textContentType="newPassword"
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
            />

            <Pressable
              onPress={handleSignUp}
              disabled={isSubmitting}
              style={[styles.primaryButton, { backgroundColor: theme.buttonBg }]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={theme.buttonText} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: theme.buttonText }]}>Create account</Text>
              )}
            </Pressable>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <View style={styles.loginRow}>
              <Text style={[styles.loginPrompt, { color: theme.subtitle }]}>Already have an account?</Text>
              <Pressable onPress={onBackToLogin}>
                <Text style={[styles.link, { color: theme.link }]}>Log in</Text>
              </Pressable>
            </View>
          </View>

          <Text style={[styles.footerText, { color: theme.footer }]}>By continuing, you agree to the Terms and Privacy Policy.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 36,
    justifyContent: 'flex-start',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  brandLogo: {
    width: 42,
    height: 42,
    borderRadius: 12,
  },
  brandText: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 22,
  },
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 16,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 4,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  errorText: {
    color: '#E85D75',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 12,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 18,
  },
  loginPrompt: {
    fontSize: 13,
  },
  link: {
    fontSize: 13,
    fontWeight: '800',
  },
  footerText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 20,
  },
});