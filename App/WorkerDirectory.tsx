import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getWorkers, resetWorkerPassword, updateWorkerSkills, updateWorkerStatus, type ApiWorker, type WorkerStatus } from '../lib/api';
import SkillTagsEditor from './SkillTagsEditor';
import WorkloadGauge from './WorkloadGauge';

type WorkerDirectoryProps = {
  isDarkTheme: boolean;
  onBack: () => void;
};

const statuses: WorkerStatus[] = ['active', 'away', 'offline'];

export default function WorkerDirectory({ isDarkTheme, onBack }: WorkerDirectoryProps) {
  const [workers, setWorkers] = useState<ApiWorker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [resettingId, setResettingId] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ workerId: string; text: string; isError: boolean } | null>(null);

  const loadWorkers = async () => {
    setErrorMessage('');
    try {
      setWorkers(await getWorkers());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load workers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkers();
  }, []);

  const setStatus = async (workerId: string, status: WorkerStatus) => {
    setUpdatingId(workerId);
    setErrorMessage('');
    try {
      await updateWorkerStatus(workerId, status);
      setWorkers((current) => current.map((worker) => worker.id === workerId ? { ...worker, status } : worker));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update worker status.');
    } finally {
      setUpdatingId('');
    }
  };

  // Skills save as soon as a tag is added or removed; a failed save puts the old list back.
  const setSkills = async (workerId: string, skills: string[]) => {
    const previous = workers.find((worker) => worker.id === workerId)?.skills ?? [];
    setErrorMessage('');
    setWorkers((current) => current.map((worker) => worker.id === workerId ? { ...worker, skills } : worker));
    try {
      const saved = await updateWorkerSkills(workerId, skills);
      setWorkers((current) => current.map((worker) => worker.id === workerId ? { ...worker, skills: saved.skills } : worker));
    } catch (error) {
      setWorkers((current) => current.map((worker) => worker.id === workerId ? { ...worker, skills: previous } : worker));
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save the skills.');
    }
  };

  const openReset = (workerId: string) => {
    setResettingId((current) => current === workerId ? '' : workerId);
    setTemporaryPassword('');
    setResetMessage(null);
  };

  const saveTemporaryPassword = async (worker: ApiWorker) => {
    if (temporaryPassword.length < 6) {
      setResetMessage({ workerId: worker.id, text: 'Use at least 6 characters.', isError: true });
      return;
    }
    setIsSavingPassword(true);
    setResetMessage(null);
    try {
      await resetWorkerPassword(worker.id, temporaryPassword);
      setWorkers((current) => current.map((item) => item.id === worker.id ? { ...item, password_reset_requested_at: null } : item));
      setResettingId('');
      setResetMessage({ workerId: worker.id, text: `Temporary password set. Share it with ${worker.name.split(' ')[0]}; they can change it in Settings.`, isError: false });
    } catch (error) {
      setResetMessage({ workerId: worker.id, text: error instanceof Error ? error.message : 'Unable to reset the password.', isError: true });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const theme = isDarkTheme
    ? { background: '#101827', surface: '#182337', border: '#2C3B56', title: '#F4F8FF', body: '#A9B8D0', accent: '#79A7FF', active: '#62D6A7', away: '#FFD285', offline: '#8D9AB0', inputBg: 'rgba(255, 255, 255, 0.06)', danger: '#FF8F8F' }
    : { background: '#F3F7FC', surface: '#FFFFFF', border: '#D7E2F0', title: '#172A45', body: '#5E718D', accent: '#2E63F0', active: '#14865C', away: '#A56800', offline: '#68788E', inputBg: '#F7FAFF', danger: '#D93A3A' };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={[styles.backButton, { borderColor: theme.border }]}><Text style={[styles.backText, { color: theme.accent }]}>Back</Text></Pressable>
          <View style={styles.headingCopy}>
            <Text style={[styles.title, { color: theme.title }]}>Workers</Text>
            <Text style={[styles.subtitle, { color: theme.body }]}>Accounts, availability, skills and workload</Text>
          </View>
        </View>

        {isLoading ? <ActivityIndicator color={theme.accent} style={styles.loader} /> : null}
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        {!isLoading && !errorMessage && workers.length === 0 ? <Text style={[styles.empty, { color: theme.body }]}>No worker accounts yet.</Text> : null}

        {workers.map((worker) => {
          const status = worker.status ?? 'active';
          return (
            <View key={worker.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.avatar, { backgroundColor: theme.accent }]}><Text style={styles.avatarText}>{worker.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</Text></View>
                <View style={styles.identity}>
                  <Text style={[styles.name, { color: theme.title }]}>{worker.name}</Text>
                  <Text style={[styles.detail, { color: theme.body }]}>{worker.email}</Text>
                  <Text style={[styles.detail, { color: theme.body }]}>Joined {worker.created_at?.slice(0, 10) ?? 'unknown'}</Text>
                </View>
                <Text style={[styles.statusLabel, { color: theme[status] }]}>{status}</Text>
              </View>
              {worker.password_reset_requested_at ? (
                <View style={[styles.resetBadge, { backgroundColor: `${theme.away}22`, borderColor: theme.away }]}>
                  <Text style={[styles.resetBadgeText, { color: theme.away }]}>🔑  Password reset requested {worker.password_reset_requested_at.slice(0, 16).replace('T', ' ')}</Text>
                </View>
              ) : null}
              {worker.workload ? (
                <View style={styles.section}>
                  <WorkloadGauge workload={worker.workload} isDarkTheme={isDarkTheme} textColor={theme.body} />
                </View>
              ) : null}
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: theme.body }]}>SKILLS</Text>
                <SkillTagsEditor
                  skills={worker.skills ?? []}
                  onChange={(skills) => void setSkills(worker.id, skills)}
                  colors={{ border: theme.border, title: theme.title, body: theme.body, accent: theme.accent, accentSoft: `${theme.accent}22`, inputBg: theme.inputBg, placeholder: isDarkTheme ? 'rgba(255, 255, 255, 0.35)' : '#9AA8BC', danger: theme.danger }}
                />
              </View>
              <View style={styles.statusRow}>
                {statuses.map((option) => {
                  const selected = option === status;
                  return (
                    <Pressable key={option} disabled={updatingId === worker.id} onPress={() => void setStatus(worker.id, option)} style={[styles.statusButton, { borderColor: selected ? theme[option] : theme.border, backgroundColor: selected ? `${theme[option]}22` : 'transparent' }]}>
                      {updatingId === worker.id && selected ? <ActivityIndicator color={theme[option]} size="small" /> : <Text style={[styles.statusButtonText, { color: selected ? theme[option] : theme.body }]}>{option}</Text>}
                    </Pressable>
                  );
                })}
              </View>
              <Pressable onPress={() => openReset(worker.id)} style={[styles.resetToggle, { borderColor: theme.border }]}>
                <Text style={[styles.resetToggleText, { color: theme.accent }]}>{resettingId === worker.id ? 'Cancel' : 'Reset password'}</Text>
              </Pressable>
              {resettingId === worker.id ? (
                <View style={styles.resetForm}>
                  <TextInput
                    value={temporaryPassword}
                    onChangeText={setTemporaryPassword}
                    placeholder="Temporary password"
                    placeholderTextColor={isDarkTheme ? 'rgba(255, 255, 255, 0.35)' : '#9AA8BC'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.resetInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.title }]}
                  />
                  <Pressable disabled={isSavingPassword} onPress={() => void saveTemporaryPassword(worker)} style={[styles.resetSave, { backgroundColor: theme.accent }]}>
                    {isSavingPassword ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.resetSaveText}>Set</Text>}
                  </Pressable>
                </View>
              ) : null}
              {resetMessage?.workerId === worker.id ? <Text style={[styles.resetMessage, { color: resetMessage.isError ? theme.danger : theme.active }]}>{resetMessage.text}</Text> : null}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flexGrow: 1, padding: 20, paddingTop: 86, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  backButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  backText: { fontSize: 13, fontWeight: '800' },
  headingCopy: { flex: 1 },
  title: { fontSize: 28, fontWeight: '900' },
  subtitle: { fontSize: 14, marginTop: 4 },
  loader: { marginTop: 32 },
  error: { color: '#E85D75', fontSize: 13, lineHeight: 18 },
  empty: { fontSize: 14, marginTop: 20 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '900' },
  identity: { flex: 1 },
  name: { fontSize: 16, fontWeight: '800' },
  detail: { fontSize: 12, marginTop: 3 },
  statusLabel: { fontSize: 12, fontWeight: '900', textTransform: 'capitalize' },
  section: { marginTop: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 0.9, marginBottom: 8 },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  statusButton: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statusButtonText: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  resetBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 12 },
  resetBadgeText: { fontSize: 11, fontWeight: '800' },
  resetToggle: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 12 },
  resetToggleText: { fontSize: 12, fontWeight: '800' },
  resetForm: { flexDirection: 'row', gap: 8, marginTop: 10 },
  resetInput: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  resetSave: { minWidth: 64, minHeight: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  resetSaveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  resetMessage: { fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 8 },
});
