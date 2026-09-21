import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getWorkers, updateWorkerStatus, type ApiWorker, type WorkerStatus } from '../lib/api';

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

  const theme = isDarkTheme
    ? { background: '#101827', surface: '#182337', border: '#2C3B56', title: '#F4F8FF', body: '#A9B8D0', accent: '#79A7FF', active: '#62D6A7', away: '#FFD285', offline: '#8D9AB0' }
    : { background: '#F3F7FC', surface: '#FFFFFF', border: '#D7E2F0', title: '#172A45', body: '#5E718D', accent: '#2E63F0', active: '#14865C', away: '#A56800', offline: '#68788E' };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={[styles.backButton, { borderColor: theme.border }]}><Text style={[styles.backText, { color: theme.accent }]}>Back</Text></Pressable>
          <View style={styles.headingCopy}>
            <Text style={[styles.title, { color: theme.title }]}>Workers</Text>
            <Text style={[styles.subtitle, { color: theme.body }]}>View worker accounts and availability</Text>
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
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  statusButton: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statusButtonText: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
});
