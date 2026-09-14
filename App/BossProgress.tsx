import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { WorkItem } from '../lib/work';

type BossProgressProps = {
  isDarkTheme: boolean;
  onBack: () => void;
  workItems: WorkItem[];
  userName: string;
};

const velocity = [42, 58, 49, 72, 66, 84, 78];
export default function BossProgress({ isDarkTheme, onBack, userName, workItems }: BossProgressProps) {
  const theme = isDarkTheme
    ? {
        background: '#170827', surface: '#26103B', surfaceRaised: '#33154B', border: 'rgba(232, 208, 255, 0.18)',
        title: '#FFF7FF', body: '#DFC8F4', muted: '#A987BE', accent: '#C43BEF', accentSoft: 'rgba(196, 59, 239, 0.2)',
        gold: '#FFD285', goldSoft: 'rgba(255, 210, 133, 0.16)', green: '#7CE1BB', greenSoft: 'rgba(124, 225, 187, 0.16)',
        track: 'rgba(255, 255, 255, 0.12)',
      }
    : {
        background: '#FAF3FF', surface: '#FFFFFF', surfaceRaised: '#F2E4FC', border: '#E8D5F7',
        title: '#2F0A4B', body: '#705485', muted: '#9678A8', accent: '#8F23C9', accentSoft: '#F0D8FF',
        gold: '#A86600', goldSoft: '#FFF0CE', green: '#14744E', greenSoft: '#D7F4E9', track: '#EAD9F4',
      };

  const toneColors = { violet: theme.accent, gold: theme.gold, green: theme.green };
  const toneBackgrounds = { violet: theme.accentSoft, gold: theme.goldSoft, green: theme.greenSoft };
  const completedCount = workItems.filter((item) => item.status === 'Done').length;
  const activeCount = workItems.filter((item) => item.status !== 'Done').length;
  const averageProgress = workItems.length ? Math.round(workItems.reduce((total, item) => total + item.progress, 0) / workItems.length) : 0;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={10} style={[styles.backButton, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Text style={[styles.backArrow, { color: theme.title }]}>&lt;</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.kicker, { color: theme.accent }]}>COMMAND CENTER</Text>
            <Text style={[styles.heading, { color: theme.title }]}>Work progress</Text>
          </View>
          <View style={[styles.liveBadge, { backgroundColor: theme.greenSoft }]}>
            <View style={[styles.liveDot, { backgroundColor: theme.green }]} />
            <Text style={[styles.liveText, { color: theme.green }]}>Live</Text>
          </View>
        </View>

        <View style={[styles.hero, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroKicker, { color: theme.body }]}>SPRINT 08 / TEAM PULSE</Text>
            <Text style={[styles.heroTitle, { color: theme.title }]}>A healthy week for {userName.split(' ')[0]}.</Text>
            <Text style={[styles.heroBody, { color: theme.body }]}>Your team has shipped steadily and the finish line is in sight.</Text>
          </View>
          <View style={[styles.healthBadge, { borderColor: theme.accent }]}>
            <Text style={[styles.healthValue, { color: theme.title }]}>78</Text>
            <Text style={[styles.healthLabel, { color: theme.body }]}>health</Text>
          </View>
          <View style={[styles.heroTrack, { backgroundColor: theme.track }]}>
            <View style={[styles.heroFill, { backgroundColor: theme.accent, width: '78%' }]} />
          </View>
        </View>

        <View style={styles.metricRow}>
          <View style={[styles.metric, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.metricValue, { color: theme.title }]}>{workItems.length}</Text>
            <Text style={[styles.metricLabel, { color: theme.body }]}>total tasks</Text>
          </View>
          <View style={[styles.metric, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.metricValue, { color: theme.title }]}>{averageProgress}%</Text>
            <Text style={[styles.metricLabel, { color: theme.body }]}>team velocity</Text>
          </View>
          <View style={[styles.metric, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.metricValue, { color: theme.green }]}>{completedCount}</Text>
            <Text style={[styles.metricLabel, { color: theme.body }]}>shipped</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.title }]}>Velocity, at a glance</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.body }]}>Last seven work days</Text>
          </View>
          <Text style={[styles.trend, { color: theme.green }]}>+18%</Text>
        </View>
        <View style={[styles.chart, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.chartBars}>
            {velocity.map((value, index) => (
              <View key={value + index} style={styles.barColumn}>
                <View style={[styles.barTrack, { backgroundColor: theme.track }]}>
                  <View style={[styles.bar, { backgroundColor: index === velocity.length - 1 ? theme.accent : theme.accentSoft, height: `${value}%` }]} />
                </View>
                <Text style={[styles.barLabel, { color: theme.muted }]}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.teamPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeaderCompact}>
            <Text style={[styles.sectionTitle, { color: theme.title }]}>Team pulse</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.body }]}>{activeCount} active</Text>
          </View>
          {workItems.length === 0 && <Text style={[styles.emptyText, { color: theme.body }]}>No assigned work yet.</Text>}
          {workItems.map((member, index) => {
            const tone = member.status === 'Done' ? 'green' : member.status === 'Review' ? 'gold' : 'violet';
            const initials = member.assignedTo.split(' ').map((part) => part[0]).join('').slice(0, 2);
            return (
            <View key={member.id} style={[styles.memberRow, index !== workItems.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
              <View style={[styles.avatar, { backgroundColor: toneColors[tone] }]}><Text style={styles.avatarText}>{initials}</Text></View>
              <View style={styles.memberCopy}>
                <View style={styles.memberTitleRow}>
                  <Text style={[styles.memberName, { color: theme.title }]}>{member.assignedTo}</Text>
                  <Text style={[styles.memberProgress, { color: toneColors[tone] }]}>{member.progress}%</Text>
                </View>
                <Text style={[styles.memberTask, { color: theme.body }]}>{member.title}</Text>
                <View style={[styles.memberTrack, { backgroundColor: theme.track }]}>
                  <View style={[styles.memberFill, { backgroundColor: toneColors[tone], width: `${member.progress}%` }]} />
                </View>
              </View>
              <View style={[styles.memberStatus, { backgroundColor: toneBackgrounds[tone] }]}>
                <Text style={[styles.memberStatusText, { color: toneColors[tone] }]}>{member.status}</Text>
              </View>
            </View>
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
  backArrow: { fontSize: 27, fontWeight: '300', lineHeight: 29 },
  headerCopy: { flex: 1 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  heading: { fontSize: 28, fontWeight: '900', marginTop: 2 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontSize: 11, fontWeight: '900' },
  hero: { minHeight: 164, marginTop: 22, borderWidth: 1, borderRadius: 22, padding: 18, overflow: 'hidden' },
  heroCopy: { paddingRight: 72 },
  heroKicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  heroTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 8 },
  heroBody: { fontSize: 12, lineHeight: 17, fontWeight: '600', marginTop: 5 },
  healthBadge: { position: 'absolute', top: 19, right: 18, width: 60, height: 60, borderWidth: 3, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  healthValue: { fontSize: 18, fontWeight: '900' },
  healthLabel: { fontSize: 9, fontWeight: '700', marginTop: -1 },
  heroTrack: { position: 'absolute', left: 18, right: 18, bottom: 18, height: 7, borderRadius: 99, overflow: 'hidden' },
  heroFill: { height: '100%', borderRadius: 99 },
  metricRow: { flexDirection: 'row', gap: 9, marginTop: 12 },
  metric: { flex: 1, minHeight: 78, borderWidth: 1, borderRadius: 16, padding: 12, justifyContent: 'center' },
  metricValue: { fontSize: 20, fontWeight: '900' },
  metricLabel: { fontSize: 10, fontWeight: '700', marginTop: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 26, marginBottom: 10 },
  sectionHeaderCompact: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 7 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  sectionSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  trend: { fontSize: 12, fontWeight: '900' },
  chart: { height: 164, borderWidth: 1, borderRadius: 18, paddingHorizontal: 18, paddingTop: 17, paddingBottom: 12 },
  chartBars: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 },
  barColumn: { flex: 1, alignItems: 'center', gap: 7 },
  barTrack: { width: '100%', height: 108, borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 7 },
  barLabel: { fontSize: 10, fontWeight: '800' },
  teamPanel: { marginTop: 24, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingTop: 16, overflow: 'hidden' },
  memberRow: { minHeight: 77, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  memberCopy: { flex: 1 },
  memberTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberName: { fontSize: 12, fontWeight: '900' },
  memberProgress: { fontSize: 11, fontWeight: '900' },
  memberTask: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  memberTrack: { height: 5, borderRadius: 99, overflow: 'hidden', marginTop: 8 },
  memberFill: { height: '100%', borderRadius: 99 },
  memberStatus: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 5 },
  memberStatusText: { fontSize: 9, fontWeight: '900' },
  emptyText: { fontSize: 13, paddingVertical: 18 },
});
