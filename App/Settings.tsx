import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { changePassword, checkServer, getApiUrl } from '../lib/api';
import { getRoleTheme, type Role } from '../lib/roleTheme';
import WristbandLink from './WristbandLink';

type SettingsProps = {
  isDarkTheme: boolean;
  role: Role;
  onSetDarkTheme: (isDark: boolean) => void;
  onBack: () => void;
  onLogout: () => void;
};

type ConnectionState = 'idle' | 'checking' | 'ok' | 'failed';

export default function Settings({ isDarkTheme, role, onSetDarkTheme, onBack, onLogout }: SettingsProps) {
  const theme = getRoleTheme(role, isDarkTheme);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('idle');

  const submitPassword = async () => {
    if (newPassword.length < 6) {
      setPasswordMessage({ text: 'New password must be at least 6 characters.', isError: true });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: 'New passwords do not match.', isError: true });
      return;
    }
    setIsChangingPassword(true);
    setPasswordMessage(null);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setPasswordMessage({ text: 'Password changed.', isError: false });
    } catch (error) {
      setPasswordMessage({ text: error instanceof Error ? error.message : 'Unable to change password.', isError: true });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const testConnection = async () => {
    setConnection('checking');
    try {
      await checkServer();
      setConnection('ok');
    } catch {
      setConnection('failed');
    }
  };

  const inputStyle = [styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.title }];
  const placeholderColor = isDarkTheme ? 'rgba(255, 255, 255, 0.35)' : '#9AA8BC';
  const connectionLabel = { idle: 'Not checked yet', checking: 'Checking…', ok: 'Connected', failed: 'Server unavailable' }[connection];
  const connectionColor = connection === 'ok' ? theme.success : connection === 'failed' ? theme.danger : theme.body;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={onBack} style={[styles.backButton, { borderColor: theme.border }]}><Text style={[styles.backText, { color: theme.accent }]}>Back</Text></Pressable>
            <View style={styles.headingCopy}>
              <Text style={[styles.title, { color: theme.title }]}>Settings</Text>
              <Text style={[styles.subtitle, { color: theme.body }]}>Appearance, security, and connection</Text>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: theme.body }]}>APPEARANCE</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.rowTitle, { color: theme.title }]}>Theme</Text>
            <View style={[styles.segmented, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
              {[{ label: '🌙  Dark', value: true }, { label: '☀️  Light', value: false }].map((option) => {
                const selected = option.value === isDarkTheme;
                return (
                  <Pressable key={option.label} onPress={() => onSetDarkTheme(option.value)} style={[styles.segment, selected && { backgroundColor: theme.accent }]}>
                    <Text style={[styles.segmentText, { color: selected ? theme.accentText : theme.body }]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: theme.body }]}>SECURITY</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable onPress={() => { setShowPasswordForm((current) => !current); setPasswordMessage(null); }} style={styles.row}>
              <Text style={styles.rowIcon}>🔒</Text>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: theme.title }]}>Change password</Text>
                <Text style={[styles.rowDetail, { color: theme.body }]}>Use at least 6 characters</Text>
              </View>
              <Text style={[styles.chevron, { color: theme.body }]}>{showPasswordForm ? '⌃' : '›'}</Text>
            </Pressable>
            {showPasswordForm ? (
              <View style={styles.passwordForm}>
                <TextInput value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current password" placeholderTextColor={placeholderColor} secureTextEntry autoCapitalize="none" style={inputStyle} />
                <TextInput value={newPassword} onChangeText={setNewPassword} placeholder="New password" placeholderTextColor={placeholderColor} secureTextEntry autoCapitalize="none" style={inputStyle} />
                <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" placeholderTextColor={placeholderColor} secureTextEntry autoCapitalize="none" style={inputStyle} />
                <Pressable
                  disabled={isChangingPassword || !currentPassword || !newPassword}
                  onPress={() => void submitPassword()}
                  style={[styles.primaryButton, { backgroundColor: theme.accent, opacity: isChangingPassword || !currentPassword || !newPassword ? 0.5 : 1 }]}
                >
                  {isChangingPassword ? <ActivityIndicator color={theme.accentText} /> : <Text style={[styles.primaryButtonText, { color: theme.accentText }]}>Update password</Text>}
                </Pressable>
              </View>
            ) : null}
            {passwordMessage ? <Text style={[styles.message, { color: passwordMessage.isError ? theme.danger : theme.success }]}>{passwordMessage.text}</Text> : null}
          </View>

          {role === 'worker' ? (
            <>
              <Text style={[styles.sectionLabel, { color: theme.body }]}>WRISTBAND</Text>
              <WristbandLink theme={theme} placeholderColor={placeholderColor} />
            </>
          ) : null}

          <Text style={[styles.sectionLabel, { color: theme.body }]}>CONNECTION</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.row}>
              <Text style={styles.rowIcon}>📡</Text>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: theme.title }]}>BandFlow server</Text>
                <Text style={[styles.rowDetail, { color: theme.body }]} selectable>{getApiUrl()}</Text>
                <Text style={[styles.connectionStatus, { color: connectionColor }]}>● {connectionLabel}</Text>
              </View>
              <Pressable disabled={connection === 'checking'} onPress={() => void testConnection()} style={[styles.smallButton, { borderColor: theme.accent }]}>
                {connection === 'checking' ? <ActivityIndicator color={theme.accent} size="small" /> : <Text style={[styles.smallButtonText, { color: theme.accent }]}>Test</Text>}
              </Pressable>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: theme.body }]}>ABOUT</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.row}>
              <Text style={styles.rowIcon}>ℹ️</Text>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: theme.title }]}>BandFlow</Text>
                <Text style={[styles.rowDetail, { color: theme.body }]}>Version {Constants.expoConfig?.version ?? '1.0.0'}</Text>
              </View>
            </View>
          </View>

          <Pressable onPress={onLogout} style={({ pressed }) => [styles.logout, { borderColor: theme.danger, opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[styles.logoutText, { color: theme.danger }]}>Log out</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 20, paddingTop: 86, paddingBottom: 40, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  backButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  backText: { fontSize: 13, fontWeight: '800' },
  headingCopy: { flex: 1 },
  title: { fontSize: 28, fontWeight: '900' },
  subtitle: { fontSize: 14, marginTop: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginTop: 8, marginLeft: 4 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowIcon: { fontSize: 20, width: 30, textAlign: 'center' },
  rowCopy: { flex: 1, marginLeft: 10, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '800' },
  rowDetail: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 20, fontWeight: '600', marginLeft: 8 },
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 13, fontWeight: '800' },
  passwordForm: { gap: 10 },
  input: { borderWidth: 1, borderRadius: 14, minHeight: 48, paddingHorizontal: 14, fontSize: 15 },
  primaryButton: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  primaryButtonText: { fontSize: 14, fontWeight: '900' },
  message: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  connectionStatus: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  smallButton: { minWidth: 58, minHeight: 36, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginLeft: 8 },
  smallButtonText: { fontSize: 13, fontWeight: '800' },
  logout: { marginTop: 14, minHeight: 50, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  logoutText: { fontSize: 15, fontWeight: '900' },
});
