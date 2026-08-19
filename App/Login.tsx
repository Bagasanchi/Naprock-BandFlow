import React, { useState } from 'react';
import {
  Image,
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

type LoginProps = {
  isDarkTheme: boolean;
  onBandSSO: () => void;
  onLogIn: () => void;
};

export default function Login({ isDarkTheme, onBandSSO, onLogIn }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'worker' | 'boss'>('worker');

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
        roleChipBg: '#0D1A2D',
        roleChipBorder: 'rgba(161, 182, 214, 0.18)',
        roleChipText: '#B6C8E0',
        roleChipActiveBg: 'rgba(86, 167, 255, 0.2)',
        roleChipActiveBorder: '#56A7FF',
        roleChipActiveText: '#EAF4FF',
        divider: 'rgba(161, 182, 214, 0.25)',
        dividerText: '#90A5C0',
        ssoBg: '#10243F',
        ssoBorder: 'rgba(161, 182, 214, 0.35)',
        ssoText: '#DCECFF',
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
        roleChipBg: '#F7FAFF',
        roleChipBorder: '#CFE0F3',
        roleChipText: '#3C5677',
        roleChipActiveBg: '#D8EAFE',
        roleChipActiveBorder: '#1A67C9',
        roleChipActiveText: '#123A67',
        divider: '#D5E4F6',
        dividerText: '#6781A2',
        ssoBg: '#F4F9FF',
        ssoBorder: '#C7DAF2',
        ssoText: '#244E7E',
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

          <Text style={[styles.title, { color: theme.title }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: theme.subtitle }]}>
            Sign in to your workspace
          </Text>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.roleRow}>
              <Pressable
                onPress={() => setRole('worker')}
                style={[
                  styles.roleChip,
                  {
                    backgroundColor: role === 'worker' ? theme.roleChipActiveBg : theme.roleChipBg,
                    borderColor: role === 'worker' ? theme.roleChipActiveBorder : theme.roleChipBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.roleChipText,
                    { color: role === 'worker' ? theme.roleChipActiveText : theme.roleChipText },
                  ]}
                >
                  Worker 👷
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setRole('boss')}
                style={[
                  styles.roleChip,
                  {
                    backgroundColor: role === 'boss' ? theme.roleChipActiveBg : theme.roleChipBg,
                    borderColor: role === 'boss' ? theme.roleChipActiveBorder : theme.roleChipBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.roleChipText,
                    { color: role === 'boss' ? theme.roleChipActiveText : theme.roleChipText },
                  ]}
                >
                  Boss 😎
                </Text>
              </Pressable>
            </View>

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
              placeholder="••••••••"
              placeholderTextColor="#8B96A8"
              secureTextEntry
              textContentType="password"
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
            />

            <Pressable onPress={onLogIn} style={[styles.primaryButton, { backgroundColor: theme.buttonBg }]}>
              <Text style={[styles.primaryButtonText, { color: theme.buttonText }]}>Log in</Text>
            </Pressable>

            <View style={styles.row}>
              <Pressable>
                <Text style={[styles.link, { color: theme.link }]}>Forgot password?</Text>
              </Pressable>
              <Pressable>
                <Text style={[styles.link, { color: theme.link }]}>Create account</Text>
              </Pressable>
            </View>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
              <Text style={[styles.dividerText, { color: theme.dividerText }]}>or continue with</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
            </View>

            <Pressable
              onPress={onBandSSO}
              style={[styles.ssoButton, { backgroundColor: theme.ssoBg, borderColor: theme.ssoBorder }]}
            >
              <Text style={[styles.ssoButtonText, { color: theme.ssoText }]}>Band SSO ⌚</Text>
            </Pressable>
          </View>

          <Text style={[styles.footerText, { color: theme.footer }]}> 
            By continuing, you agree to the Terms and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#07111F',
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
    backgroundColor: '#07111F',
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
    lineHeight: 37,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 28,
    maxWidth: 340,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  roleChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButton: {
    marginTop: 22,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  primaryButtonText: {
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  row: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  dividerRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    height: 1,
    flex: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ssoButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ssoButtonText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  link: {
    fontSize: 14,
    fontWeight: '700',
  },
  footerText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 18,
  },
});
