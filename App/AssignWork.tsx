import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { WorkItem } from '../lib/work';
import { getWorkers } from '../lib/api';

type AssignWorkProps = {
  isDarkTheme: boolean;
  onAssignWork: (work: Omit<WorkItem, 'id' | 'status' | 'progress' | 'due'>) => void;
  onBack: () => void;
  userName: string;
};

type Worker = { id: string; initials: string; name: string; specialty: string; score: string; reason: string };

export default function AssignWork({ isDarkTheme, onAssignWork, onBack, userName }: AssignWorkProps) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(true);
  const [workBrief, setWorkBrief] = useState('');
  const theme = isDarkTheme
    ? {
        background: '#170827', surface: '#26103B', surfaceRaised: '#33154B', border: 'rgba(232, 208, 255, 0.18)',
        title: '#FFF7FF', body: '#DFC8F4', muted: '#A987BE', accent: '#C43BEF', accentText: '#FFFFFF', accentSoft: 'rgba(196, 59, 239, 0.18)',
        input: 'rgba(255, 255, 255, 0.08)', green: '#7CE1BB', greenSoft: 'rgba(124, 225, 187, 0.16)',
      }
    : {
        background: '#FAF3FF', surface: '#FFFFFF', surfaceRaised: '#F2E4FC', border: '#E8D5F7',
        title: '#2F0A4B', body: '#705485', muted: '#9678A8', accent: '#8F23C9', accentText: '#FFFFFF', accentSoft: '#F0D8FF',
        input: '#FBF7FF', green: '#14744E', greenSoft: '#D7F4E9',
      };

  const selected = workers.find((worker) => worker.id === selectedWorker);
  React.useEffect(() => {
    let isMounted = true;
    const loadWorkers = async () => {
      try {
        const profiles = await getWorkers();
        if (!isMounted) return;
        setWorkers(profiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        initials: profile.name.trim().split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase(),
        specialty: 'Workspace worker',
        score: '—',
        reason: 'Available for assignment',
        })));
        setSelectedWorker(profiles[0]?.id ?? '');
        setIsLoadingWorkers(false);
      } catch {
        setIsLoadingWorkers(false);
      }
    };
    void loadWorkers();
    return () => { isMounted = false; };
  }, []);
  const publishWork = () => {
    const title = workBrief.trim().split('\n')[0].trim();
    if (!title || !selected) return;
    onAssignWork({ title, priority: 'Medium', subtasks: [], assignedTo: selected.name });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={10} style={[styles.backButton, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Text style={[styles.backArrow, { color: theme.title }]}>&lt;</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.kicker, { color: theme.accent }]}>SMART ASSIGNMENT</Text>
            <Text style={[styles.heading, { color: theme.title }]}>Find the right owner</Text>
          </View>
          <Text style={[styles.headerMark, { color: theme.accent }]}>✦</Text>
        </View>

        <View style={[styles.intro, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
          <Text style={[styles.introTitle, { color: theme.title }]}>Let the team context do the matching.</Text>
          <Text style={[styles.introBody, { color: theme.body }]}>Describe the work and BandFlow will surface the strongest fit from your team.</Text>
          <View style={[styles.introMeta, { backgroundColor: theme.greenSoft }]}>
            <View style={[styles.liveDot, { backgroundColor: theme.green }]} />
            <Text style={[styles.introMetaText, { color: theme.green }]}>Team availability synced just now</Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.body }]}>THE WORK</Text>
        <View style={[styles.briefBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            value={workBrief}
            onChangeText={setWorkBrief}
            placeholder="What needs to move forward?"
            placeholderTextColor={theme.muted}
            multiline
            textAlignVertical="top"
            style={[styles.briefInput, { color: theme.title }]}
          />
          <Text style={[styles.briefHint, { color: theme.muted }]}>A sentence or two is enough for a useful recommendation.</Text>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionLabel, { color: theme.body }]}>RECOMMENDED OWNER</Text>
            <Text style={[styles.sectionSubtext, { color: theme.muted }]}>Ranked by skills, workload, and momentum</Text>
          </View>
          <Text style={[styles.matchLabel, { color: theme.accent }]}>MATCH</Text>
        </View>

        <View style={styles.workerList}>
          {workers.map((worker, index) => {
            const isSelected = worker.id === selectedWorker;
            return (
              <Pressable
                key={worker.id}
                onPress={() => setSelectedWorker(worker.id)}
                style={[styles.workerRow, { backgroundColor: isSelected ? theme.accentSoft : theme.surface, borderColor: isSelected ? theme.accent : theme.border }]}
              >
                <View style={[styles.rank, { backgroundColor: isSelected ? theme.accent : theme.surfaceRaised }]}>
                  <Text style={[styles.rankText, { color: isSelected ? theme.accentText : theme.body }]}>0{index + 1}</Text>
                </View>
                <View style={[styles.avatar, { backgroundColor: isSelected ? theme.accent : theme.border }]}><Text style={styles.avatarText}>{worker.initials}</Text></View>
                <View style={styles.workerCopy}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.workerName, { color: theme.title }]}>{worker.name}</Text>
                    <Text style={[styles.score, { color: isSelected ? theme.accent : theme.body }]}>{worker.score}</Text>
                  </View>
                  <Text style={[styles.specialty, { color: theme.body }]}>{worker.specialty}</Text>
                  {isSelected && <Text style={[styles.reason, { color: theme.accent }]}>{worker.reason}</Text>}
                </View>
                <View style={[styles.radio, { borderColor: isSelected ? theme.accent : theme.border, backgroundColor: isSelected ? theme.accent : 'transparent' }]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            );
          })}
        </View>
        {!isLoadingWorkers && workers.length === 0 && (
          <View style={[styles.emptyWorkers, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.emptyWorkersTitle, { color: theme.title }]}>No worker accounts found</Text>
            <Text style={[styles.emptyWorkersBody, { color: theme.body }]}>Create a worker account before assigning work.</Text>
          </View>
        )}

        {selected && <View style={[styles.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <Text style={[styles.previewLabel, { color: theme.body }]}>ASSIGNMENT PREVIEW</Text>
          <View style={styles.previewRow}>
            <View style={[styles.previewAvatar, { backgroundColor: theme.accent }]}><Text style={styles.avatarText}>{selected.initials}</Text></View>
            <View style={styles.previewCopy}>
              <Text style={[styles.previewTitle, { color: theme.title }]}>{selected.name} will own this work</Text>
              <Text style={[styles.previewBody, { color: theme.body }]}>They'll get the brief, priority, and a clear starting point.</Text>
            </View>
          </View>
        </View>}

        <Pressable disabled={!selected || !workBrief.trim()} onPress={publishWork} style={[styles.assignButton, { backgroundColor: theme.accent, opacity: selected && workBrief.trim() ? 1 : 0.5 }]}> 
          <Text style={[styles.assignButtonText, { color: theme.accentText }]}>{selected ? `Assign to ${selected.name}  →` : 'Select a worker'}</Text>
        </Pressable>
        <Text style={[styles.footerNote, { color: theme.muted }]}>Signed in as {userName}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 84, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 27, fontWeight: '300', lineHeight: 29 },
  headerCopy: { flex: 1 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  heading: { fontSize: 27, fontWeight: '900', marginTop: 2 },
  headerMark: { fontSize: 28, fontWeight: '900' },
  intro: { borderWidth: 1, borderRadius: 21, marginTop: 22, padding: 18 },
  introTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900' },
  introBody: { fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 6 },
  introMeta: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, marginTop: 14 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  introMetaText: { fontSize: 10, fontWeight: '800' },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  briefBox: { minHeight: 132, borderWidth: 1, borderRadius: 17, padding: 14 },
  briefInput: { flex: 1, minHeight: 76, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  briefHint: { fontSize: 10, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 24 },
  sectionSubtext: { fontSize: 10, fontWeight: '600', marginTop: -2, marginBottom: 8 },
  matchLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  workerList: { gap: 8 },
  workerRow: { minHeight: 70, borderWidth: 1, borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  rank: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 10, fontWeight: '900' },
  avatar: { width: 37, height: 37, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  workerCopy: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  workerName: { fontSize: 13, fontWeight: '900' },
  score: { fontSize: 12, fontWeight: '900' },
  specialty: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  reason: { fontSize: 10, fontWeight: '800', marginTop: 3 },
  radio: { width: 20, height: 20, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
  preview: { borderWidth: 1, borderRadius: 17, marginTop: 20, padding: 15 },
  previewLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 11 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  previewCopy: { flex: 1 },
  previewTitle: { fontSize: 13, fontWeight: '900' },
  previewBody: { fontSize: 11, lineHeight: 16, fontWeight: '600', marginTop: 3 },
  assignButton: { minHeight: 51, borderRadius: 14, marginTop: 16, alignItems: 'center', justifyContent: 'center' },
  assignButtonText: { fontSize: 14, fontWeight: '900' },
  footerNote: { textAlign: 'center', fontSize: 10, fontWeight: '600', marginTop: 9 },
  emptyWorkers: { borderWidth: 1, borderRadius: 16, padding: 15, marginTop: 12 },
  emptyWorkersTitle: { fontSize: 13, fontWeight: '900' },
  emptyWorkersBody: { fontSize: 11, lineHeight: 16, marginTop: 4 },
});
