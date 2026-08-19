import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, DefaultTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import BandAuth from './BandAuth';
import Intro from './Intro';
import Login from './Login';
import BandAuthenticatorApp from './BandAuthenticatorApp';

type RootStackParamList = {
  Intro: undefined;
  Login: undefined;
  WorkerDashboard: undefined;
  BossDashboard: undefined;
  BandAuth: undefined;
  BandAuthenticatorApp: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type GlobalThemeToggleProps = {
  isDarkTheme: boolean;
  onToggleTheme: () => void;
};

function GlobalThemeToggle({ isDarkTheme, onToggleTheme }: GlobalThemeToggleProps) {
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
      <Pressable
        onPress={onToggleTheme}
        style={[
          styles.globalThemeToggle,
          {
            top: insets.top + 8,
            backgroundColor: isDarkTheme ? 'rgba(255, 255, 255, 0.10)' : 'rgba(45, 90, 214, 0.92)',
            borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.18)',
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          },
        ]}
      >
        <Text style={[styles.globalThemeToggleText, { color: isDarkTheme ? '#E3EEFF' : '#FFFFFF' }]}>
          {isDarkTheme ? 'Light theme' : 'Dark theme'}
        </Text>
      </Pressable>
    </View>
  );
}

type GlobalPageTitleProps = {
  isDarkTheme: boolean;
  title: string;
};

function GlobalPageTitle({ isDarkTheme, title }: GlobalPageTitleProps) {
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <View
        style={[
          styles.globalPageTitle,
          {
            top: insets.top + 8,
            backgroundColor: isDarkTheme ? 'rgba(255, 255, 255, 0.10)' : 'rgba(45, 90, 214, 0.92)',
            borderColor: isDarkTheme ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.18)',
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          },
        ]}
      >
        <Text style={[styles.globalPageTitleText, { color: isDarkTheme ? '#E3EEFF' : '#FFFFFF' }]}>
          {title}
        </Text>
      </View>
    </View>
  );
}

type WorkerDashboardProps = {
  isDarkTheme: boolean;
  onSwitchRoles: () => void;
};

const workerTasks = [
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

function WorkerDashboard({ isDarkTheme, onSwitchRoles }: WorkerDashboardProps) {
  const theme = isDarkTheme
    ? {
        background: '#EEF4FF',
        header: '#2D5AD6',
        cardBg: '#FFFFFF',
        cardBorder: '#C8D8F6',
        title: '#16325C',
        subtitle: '#5A6E91',
        text: '#20345A',
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
        cardBg: '#FFFFFF',
        cardBorder: '#C8D8F6',
        title: '#16325C',
        subtitle: '#5A6E91',
        text: '#20345A',
        pillBg: 'rgba(255,255,255,0.16)',
        pillText: '#FFFFFF',
        bellBg: 'rgba(255,255,255,0.16)',
        statBg: 'rgba(255,255,255,0.1)',
        statBorder: 'rgba(255,255,255,0.08)',
        progressTrack: '#D8E3F7',
        progressFill: '#2E63F0',
      };

  return (
    <SafeAreaView style={[dashboardStyles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={dashboardStyles.scrollContent}>
        <View style={[dashboardStyles.header, { backgroundColor: theme.header }]}>
          <View style={dashboardStyles.topRow}>
            <View style={dashboardStyles.avatarWrap}>
              <Image source={require('../assets/icon.png')} style={dashboardStyles.avatar} resizeMode="cover" />
            </View>

            <View style={dashboardStyles.profileBlock}>
              <Text style={[dashboardStyles.dashboardLabel, { color: 'rgba(255,255,255,0.82)' }]}>Worker Dashboard</Text>
              <Text style={[dashboardStyles.userName, { color: '#FFFFFF' }]}>Beegii bronii James</Text>
            </View>

            <View style={dashboardStyles.actionCluster}>
              <Pressable onPress={onSwitchRoles} style={[dashboardStyles.switchButton, { backgroundColor: theme.pillBg }]}>
                <Text style={[dashboardStyles.switchButtonText, { color: theme.pillText }]}>Switch roles</Text>
              </Pressable>

              <Pressable style={[dashboardStyles.bellButton, { backgroundColor: theme.bellBg }]}>
                <Text style={dashboardStyles.bellEmoji}>🔔</Text>
              </Pressable>
            </View>
          </View>

          <View style={dashboardStyles.statRow}>
            <View style={[dashboardStyles.statCard, { backgroundColor: theme.statBg, borderColor: theme.statBorder }]}>
              <Text style={dashboardStyles.statIcon}>📋</Text>
              <Text style={dashboardStyles.statValue}>4</Text>
              <Text style={dashboardStyles.statLabel}>Active Tasks</Text>
            </View>
            <View style={[dashboardStyles.statCard, { backgroundColor: theme.statBg, borderColor: theme.statBorder }]}>
              <Text style={dashboardStyles.statIcon}>✅</Text>
              <Text style={dashboardStyles.statValue}>1</Text>
              <Text style={dashboardStyles.statLabel}>Completed</Text>
            </View>
            <View style={[dashboardStyles.statCard, { backgroundColor: theme.statBg, borderColor: theme.statBorder }]}>
              <Text style={dashboardStyles.statIcon}>👥</Text>
              <Text style={dashboardStyles.statValue}>5</Text>
              <Text style={dashboardStyles.statLabel}>Team Size</Text>
            </View>
          </View>
        </View>

        <View style={dashboardStyles.sectionHeaderRow}>
          <Text style={[dashboardStyles.sectionTitle, { color: theme.title }]}>Manage Tasks</Text>
          <Text style={[dashboardStyles.viewAllText, { color: theme.header }]}>View all</Text>
        </View>

        <View style={dashboardStyles.taskList}>
          {workerTasks.map((task) => (
            <View key={task.title} style={[dashboardStyles.taskCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={dashboardStyles.taskMain}>
                <Text style={[dashboardStyles.taskTitle, { color: theme.text }]}>{task.title}</Text>
                <Text style={[dashboardStyles.taskMeta, { color: theme.subtitle }]}>
                  <Text style={dashboardStyles.priorityDot}>●</Text> {task.priority} · Due {task.dueDate}
                </Text>
              </View>

              <View style={dashboardStyles.taskSide}>
                <View style={[dashboardStyles.statusPill, statusStyles[task.status]]}>
                  <Text style={dashboardStyles.statusText}>{task.status}</Text>
                </View>
                <View style={[dashboardStyles.progressTrack, { backgroundColor: theme.progressTrack }]}>
                  <View
                    style={[
                      dashboardStyles.progressFill,
                      { backgroundColor: theme.progressFill, width: `${task.percent}%` },
                    ]}
                  />
                </View>
                <Text style={[dashboardStyles.progressText, { color: theme.subtitle }]}>{task.percent}%</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type BossDashboardProps = {
  isDarkTheme: boolean;
  onSwitchRoles: () => void;
};

function BossDashboard({ isDarkTheme, onSwitchRoles }: BossDashboardProps) {
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
    <SafeAreaView style={[dashboardStyles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[dashboardStyles.container, { backgroundColor: theme.background }]}>
        <View style={[dashboardStyles.hero, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={dashboardStyles.topRow}>
            <View style={dashboardStyles.avatarWrap}>
              <Image source={require('../assets/icon.png')} style={dashboardStyles.avatar} resizeMode="cover" />
            </View>
            <View style={dashboardStyles.profileBlock}>
              <Text style={[dashboardStyles.dashboardLabel, { color: theme.subtitle }]}>Boss Dashboard</Text>
              <Text style={[dashboardStyles.userName, { color: theme.title }]}>Beegii bronii James</Text>
            </View>
            <View style={dashboardStyles.actionCluster}>
              <Pressable onPress={onSwitchRoles} style={[dashboardStyles.switchButton, { backgroundColor: theme.pillBg }]}>
                <Text style={[dashboardStyles.switchButtonText, { color: theme.pillText }]}>Switch roles</Text>
              </Pressable>
              <Pressable style={[dashboardStyles.bellButton, { backgroundColor: theme.bellBg }]}>
                <Text style={dashboardStyles.bellEmoji}>🔔</Text>
              </Pressable>
            </View>
          </View>

          <Text style={[dashboardStyles.bodyText, { color: theme.subtitle }]}>Boss perspective goes here next. This route is ready so the switch button can swap between the two dashboard pages.</Text>

          <View style={dashboardStyles.badgeRow}>
            <View style={[dashboardStyles.badge, { borderColor: theme.accent }]}>
              <Text style={[dashboardStyles.badgeText, { color: theme.accent }]}>Team overview</Text>
            </View>
            <View style={[dashboardStyles.badge, { borderColor: theme.accent }]}>
              <Text style={[dashboardStyles.badgeText, { color: theme.accent }]}>Approvals</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [currentRouteName, setCurrentRouteName] = useState<keyof RootStackParamList>('Intro');
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  const appBackground = isDarkTheme ? '#07111F' : '#EEF4FF';
  const surfaceTint = isDarkTheme ? 'rgba(11, 22, 39, 0.92)' : '#DDEBFC';

  const titleByRoute: Record<keyof RootStackParamList, string> = {
    Intro: 'Intro',
    Login: 'Login',
    WorkerDashboard: 'Worker Dashboard',
    BossDashboard: 'Boss Dashboard',
    BandAuth: 'Band Auth',
    BandAuthenticatorApp: 'Band Authenticator',
  };

  return (
    <View style={[styles.appShell, { backgroundColor: appBackground }]}>
      <SafeAreaProvider>
        <StatusBar style={isDarkTheme ? 'light' : 'dark'} />
        <NavigationContainer
          ref={navigationRef}
          theme={isDarkTheme ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: appBackground, card: surfaceTint, primary: '#2E63F0', border: 'rgba(161, 182, 214, 0.2)', notification: '#2E63F0' } } : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: appBackground, card: surfaceTint, primary: '#2E63F0', border: '#C8D8F6', notification: '#2E63F0' } }}
          onReady={() => {
            const route = navigationRef.getCurrentRoute()?.name;
            if (route) {
              setCurrentRouteName(route);
            }
          }}
          onStateChange={() => {
            const route = navigationRef.getCurrentRoute()?.name;
            if (route && route !== currentRouteName) {
              setCurrentRouteName(route);
            }
          }}
        >
          <Stack.Navigator
            initialRouteName="Intro"
            screenOptions={{
              headerShown: false,
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              contentStyle: { backgroundColor: appBackground },
            }}
          >
            <Stack.Screen name="Intro">
              {({ navigation }) => (
                <Intro
                  isDarkTheme={isDarkTheme}
                  onProceed={() => navigation.navigate('Login')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Login">
              {({ navigation }) => (
                <Login
                  isDarkTheme={isDarkTheme}
                  onBandSSO={() => navigation.navigate('BandAuth')}
                  onLogIn={() => navigation.navigate('WorkerDashboard')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="WorkerDashboard">
              {({ navigation }) => (
                <WorkerDashboard
                  isDarkTheme={isDarkTheme}
                  onSwitchRoles={() => navigation.navigate('BossDashboard')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="BossDashboard">
              {({ navigation }) => (
                <BossDashboard
                  isDarkTheme={isDarkTheme}
                  onSwitchRoles={() => navigation.navigate('WorkerDashboard')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="BandAuth">
              {({ navigation }) => (
                <BandAuth
                  isDarkTheme={isDarkTheme}
                  onUseAppAsAuthenticator={() => navigation.navigate('BandAuthenticatorApp')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="BandAuthenticatorApp">
              {() => <BandAuthenticatorApp isDarkTheme={isDarkTheme} />}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
        <GlobalPageTitle
          isDarkTheme={isDarkTheme}
          title={titleByRoute[currentRouteName] ?? currentRouteName}
        />
        <GlobalThemeToggle
          isDarkTheme={isDarkTheme}
          onToggleTheme={() => setIsDarkTheme((prev) => !prev)}
        />
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
  },
  globalThemeToggle: {
    position: 'absolute',
    right: 16,
    zIndex: 1000,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  globalThemeToggleText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  globalPageTitle: {
    position: 'absolute',
    left: 16,
    zIndex: 1000,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  globalPageTitleText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

const dashboardStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
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

const statusStyles: Record<string, object> = {
  'In Progress': { backgroundColor: 'rgba(120, 162, 255, 0.34)' },
  Review: { backgroundColor: 'rgba(255, 195, 93, 0.42)' },
  Done: { backgroundColor: 'rgba(108, 201, 173, 0.42)' },
  Blocked: { backgroundColor: 'rgba(255, 144, 144, 0.34)' },
};
