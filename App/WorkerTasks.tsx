import React, { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { WorkItem } from '../lib/work';

type WorkerTask = {
  title: string;
  status: string;
  priority: string;
  due: string;
  progress: number;
  tone: 'progress' | 'review' | 'done';
  category: string;
};

type WorkerTasksProps = {
  isDarkTheme: boolean;
  onBack: () => void;
  onOpenTask: (task: { id: string; title: string; priority: string; due: string; progress: number; status: WorkItem['status']; subtasks: string[] }) => void;
  workItems: WorkItem[];
  userName: string;
};

const filters = ['All', 'Active', 'Done'];

export default function WorkerTasks({ isDarkTheme, onBack, onOpenTask, userName, workItems }: WorkerTasksProps) {
  const [selectedFilter, setSelectedFilter] = useState('All');
  const theme = isDarkTheme
    ? {
        background: '#07111F', surface: '#0D1D31', surfaceRaised: '#122A45', border: 'rgba(161, 182, 214, 0.2)',
        title: '#F4F8FF', body: '#A7B4C9', accent: '#56A7FF', accentSoft: 'rgba(86, 167, 255, 0.16)',
        warm: '#FFC857', warmSoft: 'rgba(255, 200, 87, 0.16)', muted: '#7690B0', progressTrack: 'rgba(255, 255, 255, 0.12)',
        done: '#7CE1BB', review: '#FFD285', danger: '#FF8F8F',
      }
    : {
        background: '#EEF5FF', surface: '#FFFFFF', surfaceRaised: '#E3F0FF', border: '#C7DAF2',
        title: '#14243A', body: '#4A5D77', accent: '#1A67C9', accentSoft: '#D8EAFE', warm: '#C77A00',
        warmSoft: '#FFF0CE', muted: '#71829A', progressTrack: '#D8EAFE', done: '#14744E', review: '#8D5600', danger: '#E84545',
      };

  const filteredTasks = useMemo(() => {
    if (selectedFilter === 'Active') return workItems.filter((task) => task.status !== 'Done');
    if (selectedFilter === 'Done') return workItems.filter((task) => task.status === 'Done');
    return workItems;
  }, [selectedFilter, workItems]);

  const activeTasks = workItems.filter((task) => task.status !== 'Done');
  const averageProgress = activeTasks.length ? Math.round(activeTasks.reduce((total, task) => total + task.progress, 0) / activeTasks.length) : 0;
  const statusColors = { progress: theme.accent, review: theme.warm, done: theme.done };
  const statusBackgrounds = { progress: theme.accentSoft, review: theme.warmSoft, done: isDarkTheme ? 'rgba(124, 225, 187, 0.16)' : '#D7F4E9' };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={10} style={[styles.backButton, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Text style={[styles.backArrow, { color: theme.title }]}>‹</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.kicker, { color: theme.accent }]}>YOUR WORKSPACE</Text>
            <Text style={[styles.heading, { color: theme.title }]}>Task atlas</Text>
          </View>
          <View style={[styles.countBadge, { backgroundColor: theme.accentSoft }]}>
            <Text style={[styles.countValue, { color: theme.accent }]}>{workItems.length}</Text>
            <Text style={[styles.countLabel, { color: theme.body }]}>items</Text>
          </View>
        </View>

        <View style={[styles.spotlight, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
          <View style={styles.spotlightCopy}>
            <Text style={[styles.spotlightLabel, { color: theme.body }]}>CURRENT RHYTHM</Text>
            <Text style={[styles.spotlightTitle, { color: theme.title }]}>You are in the flow, {userName.split(' ')[0]}.</Text>
            <Text style={[styles.spotlightBody, { color: theme.body }]}>Keep the momentum on your active work.</Text>
          </View>
          <View style={[styles.progressRing, { borderColor: theme.accent }]}>
            <Text style={[styles.ringValue, { color: theme.title }]}>{averageProgress}%</Text>
            <Text style={[styles.ringLabel, { color: theme.body }]}>avg.</Text>
          </View>
          <View style={[styles.spotlightTrack, { backgroundColor: theme.progressTrack }]}>
            <View style={[styles.spotlightFill, { backgroundColor: theme.accent, width: `${averageProgress}%` }]} />
          </View>
        </View>

        <View style={styles.filterRow}>
          {filters.map((filter) => {
            const isSelected = filter === selectedFilter;
            return (
              <Pressable
                key={filter}
                onPress={() => setSelectedFilter(filter)}
                style={[styles.filterChip, { backgroundColor: isSelected ? theme.title : theme.surface, borderColor: isSelected ? theme.title : theme.border }]}
              >
                <Text style={[styles.filterText, { color: isSelected ? theme.background : theme.body }]}>{filter}</Text>
              </Pressable>
            );
          })}
          <Text style={[styles.filterHint, { color: theme.muted }]}>{filteredTasks.length} shown</Text>
        </View>

        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: theme.title }]}>Everything on your plate</Text>
          <Text style={[styles.listSubtitle, { color: theme.body }]}>Tap a task to open it</Text>
        </View>

        <View style={styles.list}>
          {filteredTasks.map((task, index) => {
            const tone = task.status === 'Done' ? 'done' : task.status === 'Review' ? 'review' : 'progress';
            return (
            <Pressable
              key={task.title}
              onPress={() => onOpenTask(task)}
              style={({ pressed }) => [styles.taskRow, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.82 : 1 }]}
            >
              <View style={[styles.indexRail, { backgroundColor: statusColors[tone] }]} />
              <View style={styles.taskBody}>
                <View style={styles.taskHeadingRow}>
                  <Text style={[styles.taskNumber, { color: theme.muted }]}>0{index + 1}</Text>
                  <Text style={[styles.taskTitle, { color: theme.title }]}>{task.title}</Text>
                </View>
                <View style={styles.taskMetaRow}>
                  <Text style={[styles.category, { color: theme.body }]}>Assigned work</Text>
                  <Text style={[styles.dot, { color: theme.muted }]}>•</Text>
                  <Text style={[styles.due, { color: task.priority === 'High' ? theme.danger : theme.body }]}>{task.priority} · {task.due}</Text>
                </View>
                <View style={styles.progressRow}>
                  <View style={[styles.progressTrack, { backgroundColor: theme.progressTrack }]}>
                    <View style={[styles.progressFill, { backgroundColor: statusColors[tone], width: `${task.progress}%` }]} />
                  </View>
                  <Text style={[styles.progressValue, { color: theme.body }]}>{task.progress}%</Text>
                </View>
              </View>
              <View style={[styles.statusChip, { backgroundColor: statusBackgrounds[tone] }]}>
                <Text style={[styles.statusText, { color: statusColors[tone] }]}>{task.status}</Text>
              </View>
            </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 84, paddingBottom: 42 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 30, fontWeight: '300', lineHeight: 31, marginTop: -3 },
  headerCopy: { flex: 1 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  heading: { fontSize: 29, fontWeight: '900', letterSpacing: 0, marginTop: 2 },
  countBadge: { minWidth: 54, paddingVertical: 8, paddingHorizontal: 9, borderRadius: 14, alignItems: 'center' },
  countValue: { fontSize: 17, fontWeight: '900' },
  countLabel: { fontSize: 10, fontWeight: '700' },
  spotlight: { marginTop: 22, borderWidth: 1, borderRadius: 22, padding: 18, minHeight: 154, overflow: 'hidden' },
  spotlightCopy: { paddingRight: 74 },
  spotlightLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  spotlightTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 8 },
  spotlightBody: { fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 5 },
  progressRing: { position: 'absolute', top: 20, right: 18, width: 60, height: 60, borderWidth: 3, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: 15, fontWeight: '900' },
  ringLabel: { fontSize: 9, fontWeight: '700', marginTop: -1 },
  spotlightTrack: { position: 'absolute', left: 18, right: 18, bottom: 18, height: 7, borderRadius: 99, overflow: 'hidden' },
  spotlightFill: { height: '100%', borderRadius: 99 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24 },
  filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  filterText: { fontSize: 12, fontWeight: '900' },
  filterHint: { flex: 1, textAlign: 'right', fontSize: 11, fontWeight: '700' },
  listHeader: { marginTop: 27, marginBottom: 11 },
  listTitle: { fontSize: 17, fontWeight: '900' },
  listSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  list: { gap: 10 },
  taskRow: { minHeight: 112, borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  indexRail: { width: 4, borderRadius: 4 },
  taskBody: { flex: 1 },
  taskHeadingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  taskNumber: { fontSize: 11, fontWeight: '900', marginTop: 2 },
  taskTitle: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '900' },
  taskMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  category: { fontSize: 11, fontWeight: '700' },
  dot: { fontSize: 11 },
  due: { fontSize: 11, fontWeight: '800' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  progressTrack: { flex: 1, height: 6, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99 },
  progressValue: { width: 32, fontSize: 10, fontWeight: '900', textAlign: 'right' },
  statusChip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 5 },
  statusText: { fontSize: 9, fontWeight: '900' },
});
