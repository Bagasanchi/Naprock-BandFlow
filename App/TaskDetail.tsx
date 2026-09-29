import React, { useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Avatar from './Avatar';
import type { SubtaskDetail, WorkItem } from '../lib/work';

type TaskDetailProps = {
  isDarkTheme: boolean;
  task: WorkItem;
  workerName: string;
  onStatusChanged: (status: WorkItem['status']) => Promise<void>;
  onRefresh: () => Promise<void>;
};

const priorityColors: Record<string, string> = { High: '#E84545', Medium: '#D99324', Low: '#2EAD72' };

export default function TaskDetail({ isDarkTheme, task, workerName, onStatusChanged, onRefresh }: TaskDetailProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
        actionText: '#07111F',
        breakDownBackground: '#2C3B56',
        breakDownText: '#E3EEFF',
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
        actionText: '#FFFFFF',
        breakDownBackground: '#D7E4F5',
        breakDownText: '#244E7E',
        unverified: '#E84545',
      };

  // Subtask state comes from the server: the wristband's DONE button moves it forward.
  const subtasks: SubtaskDetail[] = task.subtaskDetails?.length
    ? task.subtaskDetails
    : task.subtasks.map((description, index) => ({ id: `${index}`, description, status: task.status === 'Done' ? 'done' : 'pending', order_index: index + 1, started_at: null, completed_at: null }));
  const activeSubtask = subtasks.find((subtask) => subtask.status === 'active');
  const doneCount = subtasks.filter((subtask) => subtask.status === 'done').length;
  const priorityColor = priorityColors[task.priority] ?? priorityColors.Medium;

  const submitStatus = async (nextStatus: WorkItem['status']) => {
    setIsUpdating(true);
    try {
      await onStatusChanged(nextStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void refresh()} tintColor={theme.progressFill} colors={[theme.progressFill]} />}
      >
        <View style={[styles.hero, { backgroundColor: theme.hero, borderColor: theme.border }]}>
          <View style={styles.headerTopRow}>
            <Text style={[styles.taskTitle, { color: theme.title }]}>{task.title}</Text>
            <Text style={[styles.statusText, { color: theme.title, borderColor: theme.border }]}>{task.status}</Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.priorityGroup}>
              <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
              <Text style={[styles.metaText, { color: theme.body }]}>{task.priority} priority</Text>
            </View>
            <Text style={[styles.metaText, { color: theme.body }]}>Due {task.due}</Text>
          </View>

          <View style={styles.overallProgressGroup}>
            <View style={[styles.overallProgressTrack, { backgroundColor: theme.progressTrack }]}>
              <View style={[styles.overallProgressFill, { backgroundColor: theme.progressFill, width: `${Math.min(task.progress, 100)}%` }]} />
            </View>
            <Text style={[styles.progressValue, { color: theme.title }]}>{task.progress}%</Text>
          </View>
        </View>

        <View style={[styles.statusBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.statusIcon, { borderColor: theme.border }]}>
            <Text style={styles.statusIconText}>⌚</Text>
          </View>
          <View style={styles.statusCopy}>
            <Text style={[styles.statusHeading, { color: theme.body }]}>On the wristband</Text>
            <Text style={[styles.statusTitle, { color: theme.title }]}>
              {activeSubtask ? activeSubtask.description : task.status === 'Done' || (subtasks.length > 0 && doneCount === subtasks.length) ? 'All steps finished' : 'Nothing sent yet'}
            </Text>
          </View>
          <Text style={[styles.authStatus, { color: activeSubtask ? theme.progressFill : theme.verified, borderColor: activeSubtask ? theme.progressFill : theme.verified }]}>
            {doneCount}/{subtasks.length}
          </Text>
        </View>

        <View style={[styles.assignedBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.assignedLabel, { color: theme.body }]}>ASSIGNED TO</Text>
          <View style={styles.assignedPerson}>
            <Avatar name={workerName} size={42} backgroundColor={theme.progressFill} />
            <Text style={[styles.assignedName, { color: theme.title }]}>{workerName}</Text>
          </View>
        </View>

        <View style={[styles.subtasksBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.subtasksTitle, { color: theme.title }]}>SUBTASKS</Text>
          {subtasks.map((subtask) => {
            const isDone = subtask.status === 'done';
            const isActive = subtask.status === 'active';
            return (
              <View key={subtask.id} style={styles.subtaskRow}>
                <View style={[styles.checkbox, { borderColor: isDone ? theme.verified : isActive ? theme.progressFill : theme.border, backgroundColor: isDone ? theme.verified : 'transparent' }]}>
                  {isDone && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.subtaskText, { color: isActive ? theme.title : theme.body }, isActive && styles.activeSubtask, isDone && styles.completedSubtask]}>{subtask.description}</Text>
                {isActive && <Text style={[styles.onWatch, { color: theme.progressFill, borderColor: theme.progressFill }]}>On watch</Text>}
              </View>
            );
          })}
          {subtasks.length === 0 && <Text style={[styles.subtaskText, { color: theme.body }]}>No subtasks were added.</Text>}
          <Text style={[styles.subtaskHint, { color: theme.body }]}>Steps are completed from the wristband. Pull down to refresh.</Text>
        </View>

        <Pressable style={[styles.breakDownButton, { backgroundColor: theme.breakDownBackground }]}>
          <Text style={[styles.breakDownText, { color: theme.breakDownText }]}>🔧  Break Down</Text>
        </Pressable>
        {task.status !== 'Done' && (
          <View style={styles.actionRow}>
            <Pressable disabled={isUpdating || task.status === 'Review'} onPress={() => void submitStatus('Review')} style={[styles.actionButton, { backgroundColor: theme.progressFill, opacity: isUpdating || task.status === 'Review' ? 0.6 : 1 }]}>
              <Text style={[styles.actionText, { color: theme.actionText }]}>{task.status === 'Review' ? 'Submitted for review' : 'Submit for review'}</Text>
            </Pressable>
            <Pressable disabled={isUpdating} onPress={() => void submitStatus('Done')} style={[styles.actionButton, { backgroundColor: theme.verified, opacity: isUpdating ? 0.6 : 1 }]}>
              <Text style={[styles.actionText, { color: theme.actionText }]}>Mark as done</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flexGrow: 1, paddingBottom: 18 },
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
  assignedName: { fontSize: 15, fontWeight: '800' },
  subtasksBox: { marginHorizontal: 20, marginTop: 16, marginBottom: 10, borderWidth: 1, borderRadius: 16, padding: 16 },
  subtasksTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 0.8, marginBottom: 12 },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', minHeight: 38, gap: 10 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  subtaskText: { flex: 1, fontSize: 13, lineHeight: 18 },
  completedSubtask: { textDecorationLine: 'line-through', opacity: 0.65 },
  activeSubtask: { fontWeight: '800' },
  onWatch: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: '900', overflow: 'hidden' },
  subtaskHint: { fontSize: 11, lineHeight: 16, marginTop: 10 },
  breakDownButton: { marginHorizontal: 20, marginTop: 16, marginBottom: 18, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  breakDownText: { fontSize: 14, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 18 },
  actionButton: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  actionText: { fontSize: 13, fontWeight: '900', textAlign: 'center' },
});
