import React from 'react';
import { Image, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

type BossDashboardProps = {
  isDarkTheme: boolean;
  onSwitchRoles: () => void;
};

export default function BossDashboard({ isDarkTheme, onSwitchRoles }: BossDashboardProps) {
  const theme = isDarkTheme
    ? {
        background: '#151E31',
        cardBg: '#1D2942',
        cardBorder: 'rgba(255,255,255,0.08)',
        title: '#F4F8FF',
        subtitle: '#B5C1D8',
        text: '#F4F8FF',
        pillBg: '#2F3F63',
        pillText: '#FFFFFF',
        bellBg: '#2F3F63',
        accent: '#79A7FF',
      }
    : {
        background: '#EEF4FF',
        cardBg: '#FFFFFF',
        cardBorder: '#C8D8F6',
        title: '#16325C',
        subtitle: '#5A6E91',
        text: '#20345A',
        pillBg: '#4E78EA',
        pillText: '#FFFFFF',
        bellBg: '#DDE8FF',
        accent: '#2E63F0',
      };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.hero, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.topRow}>
            <View style={styles.avatarWrap}>
              <Image source={require('../assets/icon.png')} style={styles.avatar} resizeMode="cover" />
            </View>
            <View style={styles.profileBlock}>
              <Text style={[styles.dashboardLabel, { color: theme.subtitle }]}>Boss Dashboard</Text>
              <Text style={[styles.userName, { color: theme.title }]}>Beegii bronii James</Text>
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

          <Text style={[styles.bodyText, { color: theme.subtitle }]}>Boss perspective goes here next. This route is ready so the switch button can swap between the two dashboard pages.</Text>

          <View style={styles.badgeRow}>
            <View style={[styles.badge, { borderColor: theme.accent }]}>
              <Text style={[styles.badgeText, { color: theme.accent }]}>Team overview</Text>
            </View>
            <View style={[styles.badge, { borderColor: theme.accent }]}>
              <Text style={[styles.badgeText, { color: theme.accent }]}>Approvals</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  hero: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 3,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  profileBlock: {
    flex: 1,
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
  bodyText: {
    marginTop: 18,
    fontSize: 14,
    lineHeight: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
