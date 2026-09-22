import React, { useState } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { WorkItem } from '../lib/work';

type DashboardProps = {
  isDarkTheme: boolean;
  onLogout: () => void;
  onCreateWork: () => void;
  onSeeProgress: () => void;
  onAssignWork: () => void;
  onManageWorkers: () => void;
  onDeleteWork: (workId: string) => Promise<void>;
  workItems: WorkItem[];
  userName: string;
};

export default function Dashboard({ isDarkTheme, onAssignWork, onCreateWork, onLogout, onSeeProgress, onManageWorkers, onDeleteWork, userName, workItems }: DashboardProps) {
  const [showCompleted, setShowCompleted] = useState(false);
  const theme = isDarkTheme
    ? {
        background: '#170827', surface: 'rgba(38, 15, 59, 0.92)', border: 'rgba(232, 208, 255, 0.18)',
        title: '#FFF7FF', body: '#DFC8F4', accent: '#C43BEF', accentText: '#FFFFFF',
        accentSoft: 'rgba(196, 59, 239, 0.16)', statCard: 'rgba(255, 255, 255, 0.1)',
        actionBorder: 'rgba(232, 208, 255, 0.26)', avatar: '#C43BEF',
        progressBg: 'rgba(196, 59, 239, 0.2)', progressText: '#EBC7FF',
        reviewBg: 'rgba(255, 189, 89, 0.16)', reviewText: '#FFD285',
        doneBg: 'rgba(85, 214, 167, 0.16)', doneText: '#7CE1BB',
      }
    : {
        background: '#FAF3FF', surface: '#FFFFFF', border: '#E8D5F7', title: '#2F0A4B', body: '#705485',
        accent: '#8F23C9', accentText: '#FFFFFF', accentSoft: '#F0D8FF', statCard: 'rgba(255, 255, 255, 0.42)',
        actionBorder: '#E3CAF3', avatar: '#8F23C9', progressBg: '#F0D8FF', progressText: '#7420A6',
        reviewBg: '#FFF0CE', reviewText: '#8D5600', doneBg: '#D7F4E9', doneText: '#14744E',
      };

  const statusTheme = {
    progress: { backgroundColor: theme.progressBg, color: theme.progressText },
    review: { backgroundColor: theme.reviewBg, color: theme.reviewText },
    done: { backgroundColor: theme.doneBg, color: theme.doneText },
  };
  const overview = [
    { icon: '📊', value: String(workItems.length), label: 'Total Tasks' },
    { icon: '⚙️', value: String(workItems.filter((item) => item.status === 'In Progress').length), label: 'In Progress' },
    { icon: '🏁', value: String(workItems.filter((item) => item.status === 'Done').length), label: 'Done' },
  ];
  const visibleWorkItems = showCompleted ? workItems : workItems.filter((item) => item.status !== 'Done');
  const actions = [
    { icon: '✏️', title: 'Create Work', detail: 'Define new tasks or projects', onPress: onCreateWork },
    { icon: '📈', title: 'See Work Progress', detail: 'Sprint analytics and team velocity', onPress: onSeeProgress },
    { icon: '👥', title: 'Manage Workers', detail: 'View worker info and edit availability', onPress: onManageWorkers },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.hero, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
          <View style={styles.heroTopRow}>
            <View style={styles.identityRow}>
              <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />
              <View>
                <Text style={[styles.eyebrow, { color: theme.body }]}>Boss Dashboard</Text>
                <Text style={[styles.name, { color: theme.title }]}>{userName}</Text>
              </View>
            </View>
            <Pressable onPress={onLogout} style={[styles.roleButton, { backgroundColor: theme.accent }]}>
              <Text style={[styles.roleButtonText, { color: theme.accentText }]}>Log out</Text>
            </Pressable>
          </View>

          <View style={styles.statsRow}>
            {overview.map((item) => (
              <View key={item.label} style={[styles.statCard, { backgroundColor: theme.statCard }]}>
                <Text style={styles.statIcon}>{item.icon}</Text>
                <Text style={[styles.statValue, { color: theme.title }]}>{item.value}</Text>
                <Text style={[styles.statLabel, { color: theme.body }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.content}>
          {actions.map((action) => (
            <Pressable
              key={action.title}
              onPress={action.onPress}
              style={[styles.actionCard, { backgroundColor: theme.surface, borderColor: theme.actionBorder }]}
            >
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <View style={styles.actionCopy}>
                <Text style={[styles.actionTitle, { color: theme.title }]}>{action.title}</Text>
                <Text style={[styles.actionDetail, { color: theme.body }]}>{action.detail}</Text>
              </View>
            </Pressable>
          ))}

          <Pressable onPress={onAssignWork} style={[styles.primaryAction, { backgroundColor: theme.accent }]}>
            <Text style={styles.actionIcon}>🤖</Text>
            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { color: theme.accentText }]}>Assign Work to Specific Worker</Text>
              <Text style={[styles.actionDetail, { color: theme.accentText }]}>AI-powered recommendations</Text>
            </View>
          </Pressable>

          <View style={[styles.teamCard, { backgroundColor: theme.surface, borderColor: theme.actionBorder }]}>
            <View style={styles.teamHeader}>
              <View style={styles.teamHeaderCopy}>
                <Text style={[styles.teamTitle, { color: theme.title }]}>Team Overview</Text>
                <Text style={[styles.teamSubtitle, { color: theme.body }]}>{showCompleted ? 'All assigned work' : 'Active work only'}</Text>
              </View>
              <Pressable
                onPress={() => setShowCompleted((current) => !current)}
                style={[styles.completedToggle, { borderColor: theme.actionBorder, backgroundColor: showCompleted ? theme.accentSoft : 'transparent' }]}
              >
                <Text style={[styles.completedToggleText, { color: theme.accent }]}>{showCompleted ? 'Hide completed' : `Show completed (${workItems.filter((item) => item.status === 'Done').length})`}</Text>
              </Pressable>
            </View>
            {visibleWorkItems.length === 0 && <Text style={[styles.emptyText, { color: theme.body }]}>{workItems.length === 0 ? 'No work has been assigned yet.' : 'All assigned work is completed.'}</Text>}
            {visibleWorkItems.map((item, index) => {
              const tone = item.status === 'Done' ? 'done' : item.status === 'Review' ? 'review' : 'progress';
              const status = statusTheme[tone];
              return (
                <View key={item.id} style={[styles.teamRow, index !== visibleWorkItems.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
                  <View style={[styles.avatar, { backgroundColor: theme.avatar }]}><Text style={styles.avatarText}>{item.assignedTo.split(' ').map((part) => part[0]).join('').slice(0, 2)}</Text></View>
                  <View style={styles.taskCopy}>
                    <Text style={[styles.taskTitle, { color: theme.title }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.taskMember, { color: theme.body }]}>{item.assignedTo}</Text>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: status.backgroundColor }]}><Text style={[styles.statusText, { color: status.color }]}>{item.status}</Text></View>
                  <Pressable
                    accessibilityLabel={`Delete ${item.title}`}
                    hitSlop={8}
                    onPress={() => Alert.alert('Delete task?', `This will permanently delete "${item.title}".`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => void onDeleteWork(item.id) },
                    ])}
                    style={[styles.deleteButton, { borderColor: theme.actionBorder }]}
                  >
                    <Text style={[styles.deleteButtonText, { color: theme.body }]}>×</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flexGrow: 1, paddingBottom: 36 },
  hero: { borderTopWidth: 1, borderBottomWidth: 1, paddingHorizontal: 20, paddingTop: 90, paddingBottom: 20 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  identityRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  logo: { width: 38, height: 38, borderRadius: 12 },
  eyebrow: { fontSize: 12, fontWeight: '700' },
  name: { fontSize: 17, lineHeight: 22, fontWeight: '900', marginTop: 1 },
  roleButton: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  roleButtonText: { fontSize: 12, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  statCard: { flex: 1, minHeight: 100, alignItems: 'center', justifyContent: 'center', borderRadius: 18, paddingHorizontal: 6, paddingVertical: 10 },
  statIcon: { fontSize: 19 },
  statValue: { fontSize: 22, fontWeight: '900', marginTop: 4 },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 18, gap: 12 },
  actionCard: { minHeight: 74, borderWidth: 1, borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 },
  primaryAction: { minHeight: 74, borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 },
  actionIcon: { fontSize: 24, width: 34, textAlign: 'center' },
  actionCopy: { flex: 1, marginLeft: 12 },
  actionTitle: { fontSize: 15, fontWeight: '800' },
  actionDetail: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  teamCard: { borderWidth: 1, borderRadius: 18, marginTop: 4, overflow: 'hidden', paddingHorizontal: 16 },
  teamHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 16, paddingBottom: 10 },
  teamHeaderCopy: { flex: 1 },
  teamTitle: { fontSize: 16, fontWeight: '900' },
  teamSubtitle: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  completedToggle: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 7 },
  completedToggleText: { fontSize: 10, fontWeight: '900', textAlign: 'center' },
  teamRow: { flexDirection: 'row', alignItems: 'center', minHeight: 61, gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  taskCopy: { flex: 1, minWidth: 0 },
  taskTitle: { fontSize: 13, fontWeight: '800' },
  taskMember: { fontSize: 12, marginTop: 2 },
  statusChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  deleteButton: { width: 28, height: 28, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  deleteButtonText: { fontSize: 22, lineHeight: 23, fontWeight: '500' },
  emptyText: { fontSize: 13, paddingVertical: 18 },
});
