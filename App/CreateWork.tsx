import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type CreateWorkProps = {
  isDarkTheme: boolean;
};

const priorities = ['Low', 'Medium', 'High'];
const workers = [
  { id: 'alex', initials: 'AR', name: 'Alex R.', detail: 'Design and product' },
  { id: 'sam', initials: 'ST', name: 'Sam T.', detail: 'Engineering and APIs' },
  { id: 'jordan', initials: 'JL', name: 'Jordan L.', detail: 'Research and UX' },
  { id: 'chris', initials: 'CM', name: 'Chris M.', detail: 'Data and systems' },
];

export default function CreateWork({ isDarkTheme }: CreateWorkProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [projectMode, setProjectMode] = useState<'solo' | 'group'>('solo');
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>([]);

  const addSubtask = () => {
    const trimmedSubtask = subtaskDraft.trim();
    if (!trimmedSubtask) return;
    setSubtasks((current) => [...current, trimmedSubtask]);
    setSubtaskDraft('');
  };

  const selectWorker = (workerId: string) => {
    if (projectMode === 'solo') {
      setSelectedWorkers([workerId]);
      return;
    }
    setSelectedWorkers((current) => current.includes(workerId)
      ? current.filter((id) => id !== workerId)
      : [...current, workerId]);
  };

  const setMode = (mode: 'solo' | 'group') => {
    setProjectMode(mode);
    if (mode === 'solo' && selectedWorkers.length > 1) {
      setSelectedWorkers(selectedWorkers.slice(0, 1));
    }
  };

  const theme = isDarkTheme
    ? {
        background: '#170827', surface: 'rgba(38, 15, 59, 0.92)', border: 'rgba(232, 208, 255, 0.18)',
        title: '#FFF7FF', body: '#DFC8F4', accent: '#C43BEF', accentText: '#FFFFFF', accentSoft: 'rgba(196, 59, 239, 0.16)',
        input: 'rgba(255, 255, 255, 0.08)', muted: '#B99ACF',
      }
    : {
        background: '#FAF3FF', surface: '#FFFFFF', border: '#E8D5F7', title: '#2F0A4B', body: '#705485',
        accent: '#8F23C9', accentText: '#FFFFFF', accentSoft: '#F0D8FF', input: '#FBF7FF', muted: '#8C6A9D',
      };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
          <Text style={[styles.eyebrow, { color: theme.body }]}>WORKSPACE BUILDER</Text>
          <Text style={[styles.title, { color: theme.title }]}>Create a new piece of work</Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionLabel, { color: theme.body }]}>WORK TITLE</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Launch campaign dashboard"
            placeholderTextColor={theme.muted}
            style={[styles.titleInput, { color: theme.title, backgroundColor: theme.input, borderColor: theme.border }]}
          />

          <View style={styles.labelRow}>
            <Text style={[styles.sectionLabel, { color: theme.body }]}>PRIORITY</Text>
            <Text style={[styles.fieldHint, { color: theme.muted }]}>Set the signal, not the noise</Text>
          </View>
          <View style={styles.priorityRow}>
            {priorities.map((option) => (
              <Pressable
                key={option}
                onPress={() => setPriority(option)}
                style={[styles.priorityButton, { borderColor: priority === option ? theme.accent : theme.border, backgroundColor: priority === option ? theme.accentSoft : 'transparent' }]}
              >
                <View style={[styles.priorityDot, { backgroundColor: option === 'High' ? '#E84545' : option === 'Low' ? '#2EAD72' : '#D99324' }]} />
                <Text style={[styles.priorityText, { color: theme.title }]}>{option}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: theme.body }]}>ASSIGN TO</Text>
          <View style={[styles.modeRow, { backgroundColor: theme.input, borderColor: theme.border }]}>
            {(['solo', 'group'] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setMode(mode)}
                style={[styles.modeButton, { backgroundColor: projectMode === mode ? theme.accent : 'transparent' }]}
              >
                <Text style={[styles.modeText, { color: projectMode === mode ? theme.accentText : theme.body }]}>
                  {mode === 'solo' ? 'Solo project' : 'Group project'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.selectionHint, { color: theme.muted }]}>
            {projectMode === 'solo' ? 'Choose one worker' : 'Choose everyone who should collaborate'}
          </Text>
          <View style={styles.workerList}>
            {workers.map((worker) => {
              const isSelected = selectedWorkers.includes(worker.id);
              return (
                <Pressable
                  key={worker.id}
                  onPress={() => selectWorker(worker.id)}
                  style={[styles.workerRow, { borderColor: isSelected ? theme.accent : theme.border, backgroundColor: isSelected ? theme.accentSoft : theme.input }]}
                >
                  <View style={[styles.avatar, { backgroundColor: isSelected ? theme.accent : theme.border }]}><Text style={styles.avatarText}>{worker.initials}</Text></View>
                  <View style={styles.assignmentCopy}>
                    <Text style={[styles.assignmentName, { color: theme.title }]}>{worker.name}</Text>
                    <Text style={[styles.assignmentHint, { color: theme.body }]}>{worker.detail}</Text>
                  </View>
                  <View style={[styles.selectionMark, { borderColor: isSelected ? theme.accent : theme.border, backgroundColor: isSelected ? theme.accent : 'transparent' }]}>
                    {isSelected && <Text style={styles.selectionCheck}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { color: theme.body }]}>SUBTASKS</Text>
          <View style={[styles.subtaskPreview, { borderColor: theme.border }]}>
            {subtasks.map((item) => (
              <View key={item} style={styles.previewRow}>
                <View style={[styles.previewBox, { borderColor: theme.border }]} />
                <Text style={[styles.previewText, { color: theme.body }]}>{item}</Text>
              </View>
            ))}
            <View style={styles.addSubtaskRow}>
              <TextInput
                value={subtaskDraft}
                onChangeText={setSubtaskDraft}
                onSubmitEditing={addSubtask}
                placeholder="Add a subtask"
                placeholderTextColor={theme.muted}
                style={[styles.subtaskInput, { color: theme.title, borderColor: theme.border }]}
                returnKeyType="done"
              />
              <Pressable onPress={addSubtask} style={[styles.addButton, { backgroundColor: theme.accentSoft }]}>
                <Text style={[styles.addButtonText, { color: theme.accent }]}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Pressable style={[styles.createButton, { backgroundColor: theme.accent }]}>
          <Text style={[styles.createButtonText, { color: theme.accentText }]}>Publish Work  →</Text>
        </Pressable>
        <Text style={[styles.footerNote, { color: theme.muted }]}>You can refine the details after assigning the work.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flexGrow: 1, paddingBottom: 30 },
  hero: { borderTopWidth: 1, borderBottomWidth: 1, paddingHorizontal: 20, paddingTop: 90, paddingBottom: 18 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '900' },
  formCard: { marginHorizontal: 20, marginTop: 18, borderWidth: 1, borderRadius: 18, padding: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 0.9, marginBottom: 8 },
  titleInput: { borderWidth: 1, borderRadius: 12, minHeight: 50, paddingHorizontal: 14, fontSize: 15, marginBottom: 20 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldHint: { fontSize: 11, marginBottom: 8 },
  priorityRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  priorityButton: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityText: { fontSize: 12, fontWeight: '700' },
  modeRow: { borderWidth: 1, borderRadius: 12, padding: 4, flexDirection: 'row', marginBottom: 8 },
  modeButton: { flex: 1, minHeight: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  modeText: { fontSize: 12, fontWeight: '800' },
  selectionHint: { fontSize: 11, marginBottom: 9 },
  workerList: { gap: 8, marginBottom: 20 },
  workerRow: { borderWidth: 1, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  assignmentCopy: { flex: 1, marginLeft: 10 },
  assignmentName: { fontSize: 13, fontWeight: '800' },
  assignmentHint: { fontSize: 11, marginTop: 2 },
  selectionMark: { width: 20, height: 20, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  selectionCheck: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  subtaskPreview: { borderWidth: 1, borderRadius: 12, padding: 12 },
  previewRow: { flexDirection: 'row', alignItems: 'center', minHeight: 31, gap: 9 },
  previewBox: { width: 16, height: 16, borderWidth: 1, borderRadius: 4 },
  previewText: { fontSize: 12 },
  addSubtaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  subtaskInput: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, fontSize: 12 },
  addButton: { minHeight: 38, paddingHorizontal: 13, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { fontSize: 12, fontWeight: '800' },
  createButton: { marginHorizontal: 20, marginTop: 18, minHeight: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  createButtonText: { fontSize: 14, fontWeight: '800' },
  footerNote: { textAlign: 'center', fontSize: 11, marginTop: 9 },
});
