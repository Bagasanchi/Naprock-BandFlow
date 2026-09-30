import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getBandLink, linkBand, unlinkBand, type BandLinkStatus } from '../lib/api';
import type { RoleTheme } from '../lib/roleTheme';

type WristbandLinkProps = {
  theme: RoleTheme;
  placeholderColor: string;
};

// Pairs the signed-in worker with a wristband: the watch shows a 6-digit code and the worker types it here.
export default function WristbandLink({ theme, placeholderColor }: WristbandLinkProps) {
  const [status, setStatus] = useState<BandLinkStatus | null>(null);
  const [code, setCode] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    getBandLink().then(setStatus).catch(() => setStatus(null));
  }, []);

  const submit = async () => {
    setIsBusy(true);
    setMessage(null);
    try {
      const result = await linkBand(code);
      setStatus(await getBandLink());
      setCode('');
      setMessage({ text: result.band?.sent ? 'Wristband linked. Your current step is on the watch.' : 'Wristband linked. Your tasks now appear on the watch.', isError: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Could not link the wristband.', isError: true });
    } finally {
      setIsBusy(false);
    }
  };

  const confirmUnlink = () => {
    Alert.alert('Unlink wristband?', 'The watch will go back to showing a pairing code.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlink',
        style: 'destructive',
        onPress: async () => {
          try {
            await unlinkBand();
            setStatus({ linked: false, linkedAt: null, lastSeenAt: null });
            setMessage(null);
          } catch (error) {
            setMessage({ text: error instanceof Error ? error.message : 'Could not unlink the wristband.', isError: true });
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.row}>
        <Text style={styles.icon}>⌚</Text>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.title }]}>{status?.linked ? 'Wristband linked' : 'Link your wristband'}</Text>
          <Text style={[styles.detail, { color: theme.body }]}>
            {status?.linked ? 'Your assigned work shows on the watch.' : 'Switch the watch on and enter the 6-digit code it shows.'}
          </Text>
        </View>
        {status?.linked ? (
          <Pressable onPress={confirmUnlink} style={[styles.smallButton, { borderColor: theme.danger }]}>
            <Text style={[styles.smallButtonText, { color: theme.danger }]}>Unlink</Text>
          </Pressable>
        ) : null}
      </View>
      {status && !status.linked ? (
        <View style={styles.form}>
          <TextInput
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            placeholderTextColor={placeholderColor}
            keyboardType="number-pad"
            maxLength={6}
            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.title }]}
          />
          <Pressable
            disabled={isBusy || code.length !== 6}
            onPress={() => void submit()}
            style={[styles.primaryButton, { backgroundColor: theme.accent, opacity: isBusy || code.length !== 6 ? 0.5 : 1 }]}
          >
            {isBusy ? <ActivityIndicator color={theme.accentText} /> : <Text style={[styles.primaryButtonText, { color: theme.accentText }]}>Link wristband</Text>}
          </Pressable>
        </View>
      ) : null}
      {message ? <Text style={[styles.message, { color: message.isError ? theme.danger : theme.success }]}>{message.text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 20, width: 30, textAlign: 'center' },
  copy: { flex: 1, marginLeft: 10, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '800' },
  detail: { fontSize: 12, marginTop: 2 },
  smallButton: { minWidth: 58, minHeight: 36, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginLeft: 8 },
  smallButtonText: { fontSize: 13, fontWeight: '800' },
  form: { gap: 10 },
  input: { borderWidth: 1, borderRadius: 14, minHeight: 52, paddingHorizontal: 14, fontSize: 24, fontWeight: '800', letterSpacing: 6, textAlign: 'center' },
  primaryButton: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 14, fontWeight: '900' },
  message: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
