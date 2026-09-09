import React from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

type WorkerDashboardProps = {
  isDarkTheme: boolean;
  onLogout: () => void;
  userName: string;
};

const stats = [
  { icon: '📋', value: '4', label: 'Active Tasks' },
  { icon: '✅', value: '1', label: 'Completed' },
  { icon: '👥', value: '5', label: 'Team Size' },
];

type TaskTone = 'progress' | 'review' | 'done';

const tasks: Array<{ title: string; status: string; priority: string; due: string; progress: number; tone: TaskTone }> = [
  { title: 'Design system audit', status: 'In Progress', priority: 'High', due: 'Aug 7', progress: 65, tone: 'progress' },
  { title: 'API integration layer', status: 'Review', priority: 'High', due: 'Aug 9', progress: 90, tone: 'review' },
  { title: 'Onboarding flow UX', status: 'Done', priority: 'Medium', due: 'Aug 4', progress: 100, tone: 'done' },
  { title: 'Database migration script', status: 'In Progress', priority: 'Medium', due: 'Aug 12', progress: 42, tone: 'progress' },
];

export default function WorkerDashboard({ isDarkTheme, onLogout, userName }: WorkerDashboardProps) {
  const theme = isDarkTheme
    ? {
        background: '#07111F', surface: 'rgba(11, 22, 39, 0.92)', border: 'rgba(161, 182, 214, 0.2)',
        title: '#F4F8FF', body: '#A7B4C9', accent: '#56A7FF', accentText: '#04111F',
        hero: '#102B59', statCard: 'rgba(255, 255, 255, 0.1)', progressTrack: 'rgba(255, 255, 255, 0.12)',
        progressBg: 'rgba(86, 167, 255, 0.2)', progressText: '#8FC4FF', reviewBg: 'rgba(255, 189, 89, 0.16)',
        reviewText: '#FFD285', doneBg: 'rgba(85, 214, 167, 0.16)', doneText: '#7CE1BB', priority: '#FF8F8F',
      }
    : {
        background: '#EEF5FF', surface: '#FFFFFF', border: '#C7DAF2', title: '#14243A', body: '#4A5D77',
        accent: '#1A67C9', accentText: '#FFFFFF', hero: '#D8EAFE', statCard: 'rgba(255, 255, 255, 0.48)',
        progressTrack: '#D8EAFE', progressBg: '#D8EAFE', progressText: '#1A67C9', reviewBg: '#FFF0CE',
        reviewText: '#8D5600', doneBg: '#D7F4E9', doneText: '#14744E', priority: '#E84545',
      };

  const statuses = {
    progress: { backgroundColor: theme.progressBg, color: theme.progressText },
    review: { backgroundColor: theme.reviewBg, color: theme.reviewText },
    done: { backgroundColor: theme.doneBg, color: theme.doneText },
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.hero, { backgroundColor: theme.hero, borderColor: theme.border }]}>
          <View style={styles.heroTopRow}>
            <View style={styles.identityRow}>
              <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />
              <View>
                <Text style={[styles.eyebrow, { color: theme.body }]}>Worker Dashboard</Text>
                <Text style={[styles.name, { color: theme.title }]}>{userName}</Text>
              </View>
            </View>
            <View style={styles.controls}>
              <Pressable onPress={onLogout} style={[styles.roleButton, { backgroundColor: theme.accent }]}>
                <Text style={[styles.roleButtonText, { color: theme.accentText }]}>Log out</Text>
              </Pressable>
              <View style={[styles.notification, { backgroundColor: theme.accent }]}><Text>🔔</Text></View>
            </View>
          </View>
          <View style={styles.statsRow}>
            {stats.map((item) => (
              <View key={item.label} style={[styles.statCard, { backgroundColor: theme.statCard }]}>
                <Text style={styles.statIcon}>{item.icon}</Text>
                <Text style={[styles.statValue, { color: theme.title }]}>{item.value}</Text>
                <Text style={[styles.statLabel, { color: theme.body }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: theme.title }]}>Manage Tasks</Text>
            <Text style={[styles.viewAll, { color: theme.accent }]}>View all</Text>
          </View>
          {tasks.map((task) => {
            const status = statuses[task.tone];
            return (
              <View key={task.title} style={[styles.taskCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.taskTopRow}>
                  <Text style={[styles.taskTitle, { color: theme.title }]}>{task.title}</Text>
                  <View style={[styles.statusChip, { backgroundColor: status.backgroundColor }]}><Text style={[styles.statusText, { color: status.color }]}>{task.status}</Text></View>
                </View>
                <View style={styles.taskBottomRow}>
                  <Text style={[styles.taskMeta, { color: theme.body }]}><Text style={{ color: theme.priority }}>●</Text> {task.priority} · Due {task.due}</Text>
                  <View style={styles.progressGroup}>
                    <View style={[styles.progressTrack, { backgroundColor: theme.progressTrack }]}><View style={[styles.progressFill, { backgroundColor: theme.accent, width: `${task.progress}%` }]} /></View>
                    <Text style={[styles.progressText, { color: theme.body }]}>{task.progress}%</Text>
                  </View>
                </View>
              </View>
            );
          })}
          <View style={[styles.clarificationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.title }]}>Ask for Clarification</Text>
            <Text style={[styles.clarificationCopy, { color: theme.body }]}>Chat with your boss or AI assistant when work needs context.</Text>
            <View style={[styles.chatButton, { backgroundColor: theme.hero }]}><Text style={[styles.chatButtonText, { color: theme.accent }]}>💬  Open Chat</Text></View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 }, container: { flexGrow: 1, paddingTop: 72, paddingBottom: 36 },
  hero: { borderTopWidth: 1, borderBottomWidth: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  identityRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }, logo: { width: 38, height: 38, borderRadius: 12 },
  eyebrow: { fontSize: 12, fontWeight: '700' }, name: { fontSize: 16, fontWeight: '900', marginTop: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 7 }, roleButton: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  roleButtonText: { fontSize: 11, fontWeight: '800' }, notification: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 18 }, statCard: { flex: 1, minHeight: 100, alignItems: 'center', justifyContent: 'center', borderRadius: 18, paddingHorizontal: 6 },
  statIcon: { fontSize: 19 }, statValue: { fontSize: 22, fontWeight: '900', marginTop: 4 }, statLabel: { fontSize: 11, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 18, gap: 10 }, sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '900' }, viewAll: { fontSize: 13, fontWeight: '800' },
  taskCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 }, taskTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, taskTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  statusChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }, statusText: { fontSize: 11, fontWeight: '800' },
  taskBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, taskMeta: { flex: 1, fontSize: 12, fontWeight: '600' },
  progressGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 }, progressTrack: { width: 64, height: 6, borderRadius: 99, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 99 }, progressText: { fontSize: 11, fontWeight: '800' },
  clarificationCard: { borderWidth: 1, borderRadius: 18, marginTop: 6, padding: 16 }, clarificationCopy: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  chatButton: { alignItems: 'center', borderRadius: 14, marginTop: 14, paddingVertical: 12 }, chatButtonText: { fontSize: 14, fontWeight: '800' },
});
