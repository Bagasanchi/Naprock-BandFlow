import React, { useState } from 'react';
import { Image, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

type TaskDetailProps = {
  isDarkTheme: boolean;
  title: string;
  priority: string;
  due: string;
  progress: number;
  workerName: string;
};

const subtasksByTitle: Record<string, string[]> = {
  'Design system audit': ['Review current components', 'Document consistency issues', 'Compare patterns across screens', 'Share audit recommendations', 'Prepare the final audit summary'],
  'API integration layer': ['Confirm API requirements', 'Set up the integration structure', 'Implement service connection', 'Test response handling', 'Document the integration'],
  'Onboarding flow UX': ['Review onboarding steps', 'Map the current user journey', 'Improve first-time user flow', 'Test the updated experience', 'Share UX recommendations'],
  'Database migration script': ['Review the migration plan', 'Back up existing records', 'Write and test the script', 'Verify migrated records', 'Document the migration result'],
};

function getSubtasks(title: string) {
  return subtasksByTitle[title] ?? ['Review the work requirements', 'Break the work into steps', 'Complete the main deliverable', 'Test the completed work', 'Submit the work for review'];
}

export default function TaskDetail({ isDarkTheme, title, priority, due, progress, workerName }: TaskDetailProps) {
  const [completedSubtasks, setCompletedSubtasks] = useState<boolean[]>(() => getSubtasks(title).map(() => false));
  const theme = isDarkTheme
    ? {
        background: '#07111F',
        hero: '#102B59',
        border: 'rgba(161, 182, 214, 0.2)',
        title: '#F4F8FF',
        body: '#A7B4C9',
        progressTrack: 'rgba(255, 255, 255, 0.16)',
        progressFill: '#56A7FF',
        surface: 'rgba(11, 22, 39, 0.92)',
        verified: '#7CE1BB',
        unverified: '#FF8F8F',
      }
    : {
        background: '#EEF5FF',
        hero: '#D8EAFE',
        border: '#C7DAF2',
        title: '#14243A',
        body: '#4A5D77',
        progressTrack: '#BFD7F3',
        progressFill: '#1A67C9',
        surface: '#FFFFFF',
        verified: '#14744E',
        unverified: '#E84545',
      };

  const priorityLabel = priority.toLowerCase() === 'high' ? 'High' : 'Low';
  const priorityColor = priorityLabel === 'High' ? '#E84545' : '#2EAD72';
  const status = progress >= 100 ? 'Completed' : 'In Progress';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.hero, { backgroundColor: theme.hero, borderColor: theme.border }]}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.taskTitle, { color: theme.title }]}>{title}</Text>
          <Text style={[styles.statusText, { color: theme.title, borderColor: theme.border }]}>{status}</Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.priorityGroup}>
            <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
            <Text style={[styles.metaText, { color: theme.body }]}>{priorityLabel} priority</Text>
          </View>
          <Text style={[styles.metaText, { color: theme.body }]}>Due {due}</Text>
        </View>

        <View style={styles.overallProgressGroup}>
          <View style={[styles.overallProgressTrack, { backgroundColor: theme.progressTrack }]}>
            <View style={[styles.overallProgressFill, { backgroundColor: theme.progressFill, width: `${Math.min(progress, 100)}%` }]} />
          </View>
          <Text style={[styles.progressValue, { color: theme.title }]}>{progress}%</Text>
        </View>
      </View>

      <View style={[styles.statusBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.statusIcon, { borderColor: theme.border }]}>
          <Text style={styles.statusIconText}>🔒</Text>
        </View>
        <View style={styles.statusCopy}>
          <Text style={[styles.statusHeading, { color: theme.body }]}>Authenticated Status</Text>
          <Text style={[styles.statusTitle, { color: theme.title }]}>Band Verified • {workerName} • Just now</Text>
        </View>
        <Text style={[styles.authStatus, { color: theme.verified, borderColor: theme.verified }]}>Verified</Text>
      </View>

      <View style={[styles.assignedBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.assignedLabel, { color: theme.body }]}>ASSIGNED TO</Text>
        <View style={styles.assignedPerson}>
          <Image source={require('../assets/icon.png')} style={styles.profileImage} resizeMode="contain" />
          <Text style={[styles.assignedName, { color: theme.title }]}>{workerName}</Text>
        </View>
      </View>

      <View style={[styles.subtasksBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.subtasksTitle, { color: theme.title }]}>SUBTASKS</Text>
        {getSubtasks(title).map((subtask, index) => (
          <Pressable
            key={subtask}
            onPress={() => setCompletedSubtasks((current) => current.map((completed, itemIndex) => itemIndex === index ? !completed : completed))}
            style={styles.subtaskRow}
          >
            <View style={[styles.checkbox, { borderColor: theme.border, backgroundColor: completedSubtasks[index] ? theme.progressFill : 'transparent' }]}>
              {completedSubtasks[index] && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.subtaskText, { color: theme.body }, completedSubtasks[index] && styles.completedSubtask]}>{subtask}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.breakDownButton}>
        <Text style={styles.breakDownText}>🔧  Break Down</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  hero: { borderTopWidth: 1, borderBottomWidth: 1, paddingHorizontal: 20, paddingTop: 90, paddingBottom: 20 },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  taskTitle: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: '900' },
  statusText: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 12, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  priorityGroup: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  priorityDot: { width: 12, height: 12, borderRadius: 6 },
  metaText: { fontSize: 13, fontWeight: '700' },
  overallProgressGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  overallProgressTrack: { flex: 1, height: 8, borderRadius: 99, overflow: 'hidden' },
  overallProgressFill: { height: '100%', borderRadius: 99 },
  progressValue: { width: 38, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  statusBox: { marginHorizontal: 20, marginTop: 18, borderWidth: 1, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: { width: 42, height: 42, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statusIconText: { fontSize: 23 },
  statusCopy: { flex: 1 },
  statusHeading: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  statusTitle: { fontSize: 12, lineHeight: 17, fontWeight: '900' },
  authStatus: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, fontSize: 12, fontWeight: '900' },
  assignedLabel: { marginBottom: 10, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  assignedBox: { marginHorizontal: 20, marginTop: 22, borderWidth: 1, borderRadius: 16, padding: 14 },
  assignedPerson: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileImage: { width: 42, height: 42, borderRadius: 21 },
  assignedName: { fontSize: 15, fontWeight: '800' },
  subtasksBox: { flex: 1, marginHorizontal: 20, marginTop: 16, marginBottom: 10, borderWidth: 1, borderRadius: 16, padding: 16 },
  subtasksTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 0.8, marginBottom: 12 },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', minHeight: 38, gap: 10 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  subtaskText: { flex: 1, fontSize: 13, lineHeight: 18 },
  completedSubtask: { textDecorationLine: 'line-through', opacity: 0.65 },
  breakDownButton: { marginHorizontal: 20, marginTop: 16, marginBottom: 18, minHeight: 48, borderRadius: 14, backgroundColor: '#AAB2BC', alignItems: 'center', justifyContent: 'center' },
  breakDownText: { color: '#FFFFFF', fontSize: 14 },
});
