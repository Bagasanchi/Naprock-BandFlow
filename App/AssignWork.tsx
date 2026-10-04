import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DatePickerModal from './DatePickerModal';
import WorkloadGauge from './WorkloadGauge';
import type { WorkItem } from '../lib/work';
import { recommendWorkers, type RecommendationBadge, type RecommendationResult } from '../lib/api';

type AssignWorkProps = {
  isDarkTheme: boolean;
  onAssignWork: (work: Omit<WorkItem, 'id' | 'status' | 'progress'>) => Promise<void>;
  onBack: () => void;
  userName: string;
};

const priorities: WorkItem['priority'][] = ['Low', 'Medium', 'High'];
const priorityColors = { High: '#E84545', Medium: '#D99324', Low: '#2EAD72' };
const badgeLabels: Record<RecommendationBadge, string> = { recommended: 'Recommended', skill_mismatch: 'Skill mismatch', high_workload: 'High workload', away: 'Away', offline: 'Offline' };

const initialsOf = (name: string) => name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
const formatDateForStorage = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const formatDateForDisplay = (date: Date) => date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

export default function AssignWork({ isDarkTheme, onAssignWork, onBack, userName }: AssignWorkProps) {
  const [workBrief, setWorkBrief] = useState('');
  const [priority, setPriority] = useState<WorkItem['priority']>('Medium');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [isMatching, setIsMatching] = useState(true);
  const [matchError, setMatchError] = useState('');
  const [selectedWorker, setSelectedWorker] = useState('');
  // Once the boss picks someone by hand, a new ranking no longer moves the selection.
  const [pickedByHand, setPickedByHand] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const latestRequest = useRef(0);

  const theme = isDarkTheme
    ? {
        background: '#170827', surface: '#26103B', surfaceRaised: '#33154B', border: 'rgba(232, 208, 255, 0.18)',
        title: '#FFF7FF', body: '#DFC8F4', muted: '#A987BE', accent: '#C43BEF', accentText: '#FFFFFF', accentSoft: 'rgba(196, 59, 239, 0.18)',
        input: 'rgba(255, 255, 255, 0.08)', green: '#7CE1BB', greenSoft: 'rgba(124, 225, 187, 0.16)',
        amber: '#FFD285', amberSoft: 'rgba(255, 210, 133, 0.16)', red: '#FF8F8F', redSoft: 'rgba(255, 143, 143, 0.16)',
      }
    : {
        background: '#FAF3FF', surface: '#FFFFFF', surfaceRaised: '#F2E4FC', border: '#E8D5F7',
        title: '#2F0A4B', body: '#705485', muted: '#9678A8', accent: '#8F23C9', accentText: '#FFFFFF', accentSoft: '#F0D8FF',
        input: '#FBF7FF', green: '#14744E', greenSoft: '#D7F4E9',
        amber: '#8D5600', amberSoft: '#FFF0CE', red: '#C22F2F', redSoft: '#FDE0E0',
      };
  const badgeColors: Record<RecommendationBadge, { text: string; background: string }> = {
    recommended: { text: theme.green, background: theme.greenSoft },
    skill_mismatch: { text: theme.amber, background: theme.amberSoft },
    high_workload: { text: theme.red, background: theme.redSoft },
    away: { text: theme.body, background: theme.surfaceRaised },
    offline: { text: theme.body, background: theme.surfaceRaised },
  };

  // Rank the team again shortly after the boss stops typing. The first run (empty brief) lists everyone
  // by workload; a slow answer for older text is dropped when newer text has been asked about since.
  useEffect(() => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;
    setIsMatching(true);
    const timer = setTimeout(async () => {
      try {
        const next = await recommendWorkers(workBrief.trim());
        if (latestRequest.current !== requestId) return;
        setResult(next);
        setMatchError('');
        setIsMatching(false);
      } catch (error) {
        if (latestRequest.current !== requestId) return;
        setMatchError(error instanceof Error ? error.message : 'The recommendation could not be loaded.');
        setIsMatching(false);
      }
    }, workBrief.trim() ? 800 : 0);
    return () => clearTimeout(timer);
  }, [workBrief]);

  const recommendations = result?.recommendations ?? [];
  useEffect(() => {
    if (!recommendations.length) return;
    if (!pickedByHand || !recommendations.some((entry) => entry.worker_id === selectedWorker)) setSelectedWorker(recommendations[0].worker_id);
  }, [result]);

  const selected = recommendations.find((entry) => entry.worker_id === selectedWorker);
  const title = workBrief.trim().split('\n')[0].trim();
  const canAssign = Boolean(selected && title) && !isAssigning;

  const publishWork = async () => {
    if (!selected || !title) return;
    setIsAssigning(true);
    setAssignError('');
    try {
      await onAssignWork({ title, priority, due: dueDate ? formatDateForStorage(dueDate) : 'Unscheduled', subtasks: [], assignedTo: selected.worker_id });
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : 'The work could not be assigned.');
      setIsAssigning(false);
    }
  };

  const skillSummary = !result || result.source === 'none' ? 'Describe the work to match skills. Ranked by workload for now.'
    : !result.required_skills.length ? 'No specific skill found in the text. Ranked by workload.'
    : `${result.source === 'ai' ? 'AI picked' : 'Keyword match (AI unavailable)'}: ${result.required_skills.join(', ')}`;

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
          <Text style={[styles.introTitle, { color: theme.title }]}>Skill first, then free hands.</Text>
          <Text style={[styles.introBody, { color: theme.body }]}>Describe the work. BandFlow ranks your team by who has the skill and the fewest open works.</Text>
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacing, { color: theme.body }]}>THE WORK</Text>
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
          <Text style={[styles.briefHint, { color: theme.muted }]}>A sentence or two is enough. The first line becomes the task title.</Text>
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacing, { color: theme.body }]}>PRIORITY</Text>
        <View style={styles.priorityRow}>
          {priorities.map((option) => (
            <Pressable
              key={option}
              onPress={() => setPriority(option)}
              style={[styles.priorityButton, { borderColor: priority === option ? theme.accent : theme.border, backgroundColor: priority === option ? theme.accentSoft : theme.surface }]}
            >
              <View style={[styles.priorityDot, { backgroundColor: priorityColors[option] }]} />
              <Text style={[styles.priorityText, { color: theme.title }]}>{option}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacing, { color: theme.body }]}>DUE WHEN?</Text>
        <View style={styles.dateRow}>
          <Pressable onPress={() => setShowDatePicker(true)} style={[styles.dateButton, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.dateButtonText, { color: dueDate ? theme.title : theme.muted }]}>{dueDate ? formatDateForDisplay(dueDate) : 'No due date'}</Text>
            <Text style={[styles.calendarIcon, { color: theme.accent }]}>▣</Text>
          </Pressable>
          {dueDate && (
            <Pressable onPress={() => setDueDate(null)} style={[styles.clearDateButton, { borderColor: theme.border }]}>
              <Text style={[styles.clearDateText, { color: theme.body }]}>Clear</Text>
            </Pressable>
          )}
        </View>
        <DatePickerModal
          visible={showDatePicker}
          value={dueDate}
          minimumDate={new Date()}
          colors={{
            surface: theme.surface, border: theme.border, title: theme.title, body: theme.body, muted: theme.muted,
            accent: theme.accent, accentText: theme.accentText, accentSoft: theme.accentSoft,
            backdrop: isDarkTheme ? 'rgba(5, 0, 12, 0.6)' : 'rgba(47, 10, 75, 0.35)',
          }}
          onSelect={(date) => {
            setDueDate(date);
            setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
        />

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={[styles.sectionLabel, { color: theme.body }]}>RECOMMENDED OWNER</Text>
            <Text style={[styles.sectionSubtext, { color: theme.muted }]}>{skillSummary}</Text>
          </View>
          {isMatching ? <ActivityIndicator color={theme.accent} size="small" /> : <Text style={[styles.matchLabel, { color: theme.accent }]}>MATCH</Text>}
        </View>

        {matchError ? <Text style={[styles.errorText, { color: theme.red }]}>{matchError}</Text> : null}

        <View style={styles.workerList}>
          {recommendations.map((entry, index) => {
            const isSelected = entry.worker_id === selectedWorker;
            return (
              <Pressable
                key={entry.worker_id}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  setSelectedWorker(entry.worker_id);
                  setPickedByHand(true);
                }}
                style={[styles.workerRow, { backgroundColor: isSelected ? theme.accentSoft : theme.surface, borderColor: isSelected ? theme.accent : theme.border }]}
              >
                <View style={styles.workerTop}>
                  <View style={[styles.rank, { backgroundColor: isSelected ? theme.accent : theme.surfaceRaised }]}>
                    <Text style={[styles.rankText, { color: isSelected ? theme.accentText : theme.body }]}>{String(index + 1).padStart(2, '0')}</Text>
                  </View>
                  <View style={[styles.avatar, { backgroundColor: isSelected ? theme.accent : theme.border }]}><Text style={styles.avatarText}>{initialsOf(entry.name)}</Text></View>
                  <View style={styles.workerCopy}>
                    <Text style={[styles.workerName, { color: theme.title }]} numberOfLines={1}>{entry.name}</Text>
                    <Text style={[styles.reason, { color: theme.body }]}>{entry.reason}</Text>
                  </View>
                  <Text style={[styles.score, { color: entry.score >= 70 ? theme.green : entry.score >= 40 ? theme.amber : theme.red }]}>{entry.score}%</Text>
                  <View style={[styles.radio, { borderColor: isSelected ? theme.accent : theme.border, backgroundColor: isSelected ? theme.accent : 'transparent' }]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                </View>

                {(entry.badges.length > 0 || entry.skills.length > 0) && (
                  <View style={styles.tagRow}>
                    {entry.badges.map((badge) => (
                      <View key={badge} style={[styles.badge, { backgroundColor: badgeColors[badge].background }]}>
                        <Text style={[styles.badgeText, { color: badgeColors[badge].text }]}>{badgeLabels[badge]}</Text>
                      </View>
                    ))}
                    {entry.skills.map((skill) => {
                      const isMatch = entry.matched_skills.includes(skill);
                      return (
                        <View key={skill} style={[styles.skillTag, { borderColor: isMatch ? theme.green : theme.border }]}>
                          <Text style={[styles.skillTagText, { color: isMatch ? theme.green : theme.body }]}>{skill}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={styles.gauge}>
                  <WorkloadGauge workload={entry.workload} isDarkTheme={isDarkTheme} textColor={theme.body} />
                </View>
              </Pressable>
            );
          })}
        </View>
        {!isMatching && !matchError && recommendations.length === 0 && (
          <View style={[styles.emptyWorkers, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.emptyWorkersTitle, { color: theme.title }]}>No worker accounts found</Text>
            <Text style={[styles.emptyWorkersBody, { color: theme.body }]}>Create a worker account before assigning work.</Text>
          </View>
        )}

        {selected && (
          <View style={[styles.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.previewLabel, { color: theme.body }]}>ASSIGNMENT PREVIEW</Text>
            <View style={styles.previewRow}>
              <View style={[styles.previewAvatar, { backgroundColor: theme.accent }]}><Text style={styles.avatarText}>{initialsOf(selected.name)}</Text></View>
              <View style={styles.previewCopy}>
                <Text style={[styles.previewTitle, { color: theme.title }]}>{selected.name} will own this work</Text>
                <Text style={[styles.previewBody, { color: theme.body }]}>{selected.score}% match · {priority} priority · {dueDate ? `due ${formatDateForDisplay(dueDate)}` : 'no due date'}</Text>
              </View>
            </View>
            {selected.badges.includes('high_workload') && (
              <Text style={[styles.previewWarning, { color: theme.red }]}>High workload: {selected.name} already has {selected.open_works} open works. You can still assign.</Text>
            )}
            {selected.badges.includes('skill_mismatch') && (
              <Text style={[styles.previewWarning, { color: theme.amber }]}>Skill mismatch: {selected.name} has none of the skills this work needs. You can still assign.</Text>
            )}
          </View>
        )}

        {assignError ? <Text style={[styles.errorText, styles.sectionSpacing, { color: theme.red }]}>{assignError}</Text> : null}
        <Pressable disabled={!canAssign} onPress={() => void publishWork()} style={[styles.assignButton, { backgroundColor: theme.accent, opacity: canAssign ? 1 : 0.5 }]}>
          {isAssigning
            ? <ActivityIndicator color={theme.accentText} />
            : <Text style={[styles.assignButtonText, { color: theme.accentText }]}>{selected ? `Assign to ${selected.name}  →` : 'Select a worker'}</Text>}
        </Pressable>
        <Text style={[styles.footerNote, { color: theme.muted }]}>{isAssigning ? 'Breaking the work into steps…' : `Signed in as ${userName}`}</Text>
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
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  sectionSpacing: { marginTop: 20 },
  briefBox: { minHeight: 132, borderWidth: 1, borderRadius: 17, padding: 14 },
  briefInput: { flex: 1, minHeight: 76, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  briefHint: { fontSize: 10, fontWeight: '600' },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityButton: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityText: { fontSize: 12, fontWeight: '800' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateButton: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateButtonText: { fontSize: 14, fontWeight: '600' },
  calendarIcon: { fontSize: 18, fontWeight: '900' },
  clearDateButton: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  clearDateText: { fontSize: 12, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 24 },
  sectionHeaderCopy: { flex: 1 },
  sectionSubtext: { fontSize: 11, lineHeight: 15, fontWeight: '600', marginTop: -2, marginBottom: 8 },
  matchLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  errorText: { fontSize: 12, lineHeight: 17, fontWeight: '700', marginBottom: 8 },
  workerList: { gap: 8 },
  workerRow: { borderWidth: 1, borderRadius: 16, padding: 12 },
  workerTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  rank: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 10, fontWeight: '900' },
  avatar: { width: 37, height: 37, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  workerCopy: { flex: 1, minWidth: 0 },
  workerName: { fontSize: 14, fontWeight: '900' },
  reason: { fontSize: 11, lineHeight: 15, fontWeight: '600', marginTop: 2 },
  score: { fontSize: 20, fontWeight: '900' },
  radio: { width: 20, height: 20, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: '900' },
  skillTag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  skillTagText: { fontSize: 10, fontWeight: '800' },
  gauge: { marginTop: 10 },
  preview: { borderWidth: 1, borderRadius: 17, marginTop: 20, padding: 15 },
  previewLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 11 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  previewCopy: { flex: 1 },
  previewTitle: { fontSize: 13, fontWeight: '900' },
  previewBody: { fontSize: 11, lineHeight: 16, fontWeight: '600', marginTop: 3 },
  previewWarning: { fontSize: 11, lineHeight: 16, fontWeight: '800', marginTop: 10 },
  assignButton: { minHeight: 51, borderRadius: 14, marginTop: 16, alignItems: 'center', justifyContent: 'center' },
  assignButtonText: { fontSize: 14, fontWeight: '900' },
  footerNote: { textAlign: 'center', fontSize: 10, fontWeight: '600', marginTop: 9 },
  emptyWorkers: { borderWidth: 1, borderRadius: 16, padding: 15, marginTop: 12 },
  emptyWorkersTitle: { fontSize: 13, fontWeight: '900' },
  emptyWorkersBody: { fontSize: 11, lineHeight: 16, marginTop: 4 },
});
