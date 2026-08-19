import React from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

type WorkerDashboardProps = {
  isDarkTheme: boolean;
  onSwitchRoles: () => void;
};

const tasks = [
  {
    title: 'Design system audit',
    priority: 'High',
    dueDate: 'Aug 7',
    status: 'In Progress',
    percent: 65,
  },
  {
    title: 'API integration layer',
    priority: 'High',
    dueDate: 'Aug 9',
    status: 'Review',
    percent: 90,
  },
  {
    title: 'Onboarding flow UX',
    priority: 'Medium',
    dueDate: 'Aug 4',
    status: 'Done',
    percent: 100,
  },
  {
    title: 'Database migration script',
    priority: 'Medium',
    dueDate: 'Aug 12',
    status: 'In Progress',
    percent: 42,
  },
  {
    title: 'Mobile push notifications',
    priority: 'Low',
    dueDate: 'Aug 15',
    status: 'Blocked',
    percent: 20,
  },
];

export default function WorkerDashboard({ isDarkTheme, onSwitchRoles }: WorkerDashboardProps) {
  const theme = isDarkTheme
    ? {
        background: '#EEF4FF',
        header: '#2D5AD6',
        headerSoft: '#4E78EA',
        cardBg: '#FFFFFF',
        cardBorder: '#C8D8F6',
        title: '#16325C',
        subtitle: '#5A6E91',
        text: '#20345A',
        muted: '#7685A2',
        pillBg: 'rgba(255,255,255,0.16)',
        pillText: '#FFFFFF',
        bellBg: 'rgba(255,255,255,0.16)',
        statBg: 'rgba(255,255,255,0.1)',
        statBorder: 'rgba(255,255,255,0.08)',
        progressTrack: '#D8E3F7',
        progressFill: '#2E63F0',
      }
    : {
        background: '#EEF4FF',
        header: '#2D5AD6',
        headerSoft: '#4E78EA',
        cardBg: '#FFFFFF',
        cardBorder: '#C8D8F6',
        title: '#16325C',
        subtitle: '#5A6E91',
        text: '#20345A',
        muted: '#7685A2',
        pillBg: 'rgba(255,255,255,0.16)',
        pillText: '#FFFFFF',
        bellBg: 'rgba(255,255,255,0.16)',
        statBg: 'rgba(255,255,255,0.1)',
        statBorder: 'rgba(255,255,255,0.08)',
        progressTrack: '#D8E3F7',
        progressFill: '#2E63F0',
      };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.header, { backgroundColor: theme.header }]}>
          <View style={styles.topRow}>
            <View style={styles.avatarWrap}>
              <Image source={require('../assets/icon.png')} style={styles.avatar} resizeMode="cover" />
            </View>

            <View style={styles.profileBlock}>
              <Text style={[styles.dashboardLabel, { color: 'rgba(255,255,255,0.82)' }]}>Worker Dashboard</Text>
              <Text style={[styles.userName, { color: '#FFFFFF' }]}>Beegii bronii James</Text>
            </View>

            <View style={styles.actionCluster}>
              <Pressable onPress={onSwitchRoles} style={[styles.switchButton, { backgroundColor: theme.pillBg }]}>
                <Text style={[styles.switchButtonText, { color: theme.pillText }]}>Switch roles</Text>
              </Pressable>

              <Pressable style={[styles.bellButton, { backgroundColor: theme.bellBg }]}>
                <Text style={styles.bellEmoji}>🔔</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.statRow}>
            <View style={[styles.statCard, { backgroundColor: theme.statBg, borderColor: theme.statBorder }]}>
              <Text style={styles.statIcon}>📋</Text>
              <Text style={styles.statValue}>4</Text>
              <Text style={styles.statLabel}>Active Tasks</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.statBg, borderColor: theme.statBorder }]}>
              <Text style={styles.statIcon}>✅</Text>
              <Text style={styles.statValue}>1</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.statBg, borderColor: theme.statBorder }]}>
              <Text style={styles.statIcon}>👥</Text>
              <Text style={styles.statValue}>5</Text>
              <Text style={styles.statLabel}>Team Size</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.title }]}>Manage Tasks</Text>
          <Text style={[styles.viewAllText, { color: theme.header }]}>View all</Text>
        </View>

        <View style={styles.taskList}>
          {tasks.map((task) => (
            <View key={task.title} style={[styles.taskCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={styles.taskMain}>
                <Text style={[styles.taskTitle, { color: theme.text }]}>{task.title}</Text>
                <Text style={[styles.taskMeta, { color: theme.subtitle }]}> 
                  <Text style={styles.priorityDot}>●</Text> {task.priority} · Due {task.dueDate}
                </Text>
              </View>

              <View style={styles.taskSide}>
                <View style={[styles.statusPill, statusStyles[task.status]]}>
                  <Text style={styles.statusText}>{task.status}</Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: theme.progressTrack }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: theme.progressFill, width: `${task.percent}%` },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: theme.subtitle }]}>{task.percent}%</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const statusStyles: Record<string, object> = {
  'In Progress': { backgroundColor: 'rgba(120, 162, 255, 0.34)' },
  Review: { backgroundColor: 'rgba(255, 195, 93, 0.42)' },
  Done: { backgroundColor: 'rgba(108, 201, 173, 0.42)' },
  Blocked: { backgroundColor: 'rgba(255, 144, 144, 0.34)' },
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 3,
    marginTop: 2,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  profileBlock: {
    flex: 1,
    paddingTop: 2,
  },
  dashboardLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 3,
  },
  userName: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  actionCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchButton: {
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellEmoji: {
    fontSize: 18,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  statCard: {
    flex: 1,
    minHeight: 104,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 8,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
  },
  statLabel: {
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  taskList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  taskCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  taskMain: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  taskMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  priorityDot: {
    color: '#F04A4A',
    fontSize: 12,
  },
  taskSide: {
    width: 94,
    alignItems: 'flex-end',
    gap: 8,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
