import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, AppState, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BandAuth from './BandAuth';
import BandAuthenticatorApp from './BandAuthenticatorApp';
import Dashboard from './Dashboard';
import CreateWork from './CreateWork';
import Intro from './Intro';
import Login from './Login';
import SignUp from './SignUp';
import ForgotPassword from './ForgotPassword';
import TaskDetail from './TaskDetail';
import WorkerDashboard from './WorkerDashboard';
import WorkerTasks from './WorkerTasks';
import BossProgress from './BossProgress';
import AssignWork from './AssignWork';
import WorkerDirectory from './WorkerDirectory';
import SideMenu, { type SideMenuShortcut } from './SideMenu';
import Profile from './Profile';
import Settings from './Settings';
import type { BandDelivery, WorkItem } from '../lib/work';
import * as api from '../lib/api';
import type { Role } from '../lib/roleTheme';
// hello
type RootStackParamList = {
  Intro: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: { email?: string } | undefined;
  BandAuth: undefined;
  BandAuthenticatorApp: undefined;
  TaskDetail: { id: string; workerName: string };
  CreateWork: undefined;
  BossDashboard: { userName?: string } | undefined;
  WorkerDashboard: { userName?: string } | undefined;
  WorkerTasks: { userName?: string } | undefined;
  BossProgress: { userName?: string } | undefined;
  AssignWork: { userName?: string } | undefined;
  WorkerDirectory: undefined;
  Profile: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const themeKey = 'bandflow_theme';

type GlobalPageTitleProps = {
  isDarkTheme: boolean;
  title: string;
};

function GlobalPageTitle({ isDarkTheme, title }: GlobalPageTitleProps) {
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.globalPageTitle,
          {
            top: insets.top + 8,
            backgroundColor: isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : '#DDEBFC',
          },
        ]}
      >
        <Text style={[styles.globalPageTitleText, { color: isDarkTheme ? '#E3EEFF' : '#163E6D' }]}>
          {title}
        </Text>
      </View>
    </View>
  );
}

export default function App() {
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  // Remember Dark/Light between launches, like the website does.
  useEffect(() => {
    AsyncStorage.getItem(themeKey).then((saved) => {
      if (saved === 'light') setIsDarkTheme(false);
    }).catch(() => {});
  }, []);

  const setTheme = (isDark: boolean) => {
    setIsDarkTheme(isDark);
    void AsyncStorage.setItem(themeKey, isDark ? 'dark' : 'light').catch(() => {});
  };
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [currentRouteName, setCurrentRouteName] = useState<keyof RootStackParamList>('Intro');
  const [profile, setProfile] = useState<api.ApiProfile | null>(null);
  const [sessionRole, setSessionRole] = useState<Role>('worker');
  const [sessionName, setSessionName] = useState('Workspace member');
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const role = profile?.role ?? sessionRole;
  // Profile edits change the name everywhere without logging in again.
  const displayName = profile?.fullName ?? sessionName;

  const logout = () => {
    void api.logout();
    setProfile(null);
    setWorkItems([]);
    navigationRef.reset({ index: 0, routes: [{ name: 'Intro' }] });
  };

  // The server already returns only the signed-in worker's own tasks (all tasks for a boss).
  // On a failed refresh keep the last list rather than blanking the screen.
  const refreshWork = async () => {
    try {
      setWorkItems(await api.getWork());
    } catch {
      // Keep showing the previous list; the next refresh will try again.
    }
  };

  // Progress changes on the server when the wristband reports DONE, so keep the list fresh
  // while signed in: every 20 seconds and whenever the app returns to the foreground.
  useEffect(() => {
    if (!profile) return;
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void refreshWork();
    }, 20000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshWork();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [profile?.id]);

  // Open straight to the dashboard when a saved login is still valid.
  const restoreSession = async () => {
    const restored = await api.restoreSession();
    if (!restored) return;
    setProfile(restored);
    setSessionRole(restored.role);
    setSessionName(restored.fullName);
    void refreshWork();
    if (navigationRef.getCurrentRoute()?.name === 'Intro') {
      navigationRef.reset({ index: 0, routes: [{ name: restored.role === 'boss' ? 'BossDashboard' : 'WorkerDashboard' }] });
    }
  };

  const reportBandDelivery = (results: Array<{ band?: BandDelivery }>) => {
    const failed = results.find((result) => !result.band?.sent);
    if (!failed) {
      Alert.alert('Work published', results.length > 1 ? `${results.length} tasks were created. The wristband shows the most recent one.` : 'The first step is now on the wristband.');
      return;
    }
    Alert.alert(
      'Work saved, not on the wristband',
      `${failed.band?.error ?? 'The BLE bridge did not answer.'}\n\nThe work is saved. To show it on the watch, start the bridge (python app.py in the naprock folder) with the watch switched on.`,
    );
  };

  const menuShortcuts: SideMenuShortcut[] = role === 'boss'
    ? [
        { icon: '✏️', title: 'Create Work', detail: 'Define new tasks or projects', onPress: () => navigationRef.navigate('CreateWork') },
        { icon: '🤖', title: 'Assign Work', detail: 'Pick the right owner', onPress: () => navigationRef.navigate('AssignWork') },
        { icon: '📈', title: 'Work Progress', detail: 'Team progress at a glance', onPress: () => navigationRef.navigate('BossProgress') },
        { icon: '👥', title: 'Manage Workers', detail: 'Worker info and availability', onPress: () => navigationRef.navigate('WorkerDirectory') },
      ]
    : [
        { icon: '📋', title: 'All Tasks', detail: 'Everything assigned to you', onPress: () => navigationRef.navigate('WorkerTasks') },
      ];

  const titleByRoute: Record<keyof RootStackParamList, string> = {
    Intro: 'Intro',
    Login: 'Login',
    SignUp: 'Sign up',
    ForgotPassword: 'Forgot Password',
    BandAuth: 'Band Auth',
    BandAuthenticatorApp: 'Band Authenticator',
    TaskDetail: 'Task Details',
    CreateWork: 'Create Work',
    BossDashboard: 'Boss Dashboard',
    WorkerDashboard: 'Worker Dashboard',
    WorkerTasks: 'All Tasks',
    BossProgress: 'Work Progress',
    AssignWork: 'Assign Work',
    WorkerDirectory: 'Workers',
    Profile: 'Profile',
    Settings: 'Settings',
  };

  return (
    <SafeAreaProvider>
      <StatusBar style={isDarkTheme ? 'light' : 'dark'} />
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          const route = navigationRef.getCurrentRoute()?.name;
          if (route) {
            setCurrentRouteName(route);
          }
          void restoreSession();
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
                onLogin={(role, userName) => {
                  setSessionRole(role);
                  setSessionName(userName);
                  void refreshWork();
                  api.getProfile().then(setProfile).catch(() => setProfile(null));
                  navigation.reset({
                    index: 0,
                    routes: [{
                      name: role === 'boss' ? 'BossDashboard' : 'WorkerDashboard',
                      params: { userName },
                    }],
                  });
                }}
                onBandSSO={() => navigation.navigate('BandAuth')}
                onCreateAccount={() => navigation.navigate('SignUp')}
                onForgotPassword={(email) => navigation.navigate('ForgotPassword', { email })}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="SignUp">
            {({ navigation }) => (
              <SignUp
                isDarkTheme={isDarkTheme}
                onSignUp={() => navigation.navigate('Login')}
                onBackToLogin={() => navigation.navigate('Login')}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="ForgotPassword">
            {({ navigation, route }) => (
              <ForgotPassword
                isDarkTheme={isDarkTheme}
                initialEmail={route.params?.email}
                onBackToLogin={() => navigation.navigate('Login')}
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
          <Stack.Screen name="BossDashboard" listeners={{ focus: () => void refreshWork() }}>
            {({ navigation, route }) => (
              <Dashboard
                isDarkTheme={isDarkTheme}
                userName={displayName}
                avatar={profile?.avatar}
                onOpenProfile={() => navigation.navigate('Profile')}
                onLogout={logout}
                onCreateWork={() => navigation.navigate('CreateWork')}
                onSeeProgress={() => navigation.navigate('BossProgress', { userName: route.params?.userName })}
                onAssignWork={() => navigation.navigate('AssignWork', { userName: route.params?.userName })}
                onManageWorkers={() => navigation.navigate('WorkerDirectory')}
                onDeleteWork={async (workId) => {
                  await api.deleteWork(workId);
                  await refreshWork();
                }}
                onOpenTask={(task) => navigation.navigate('TaskDetail', { id: task.id, workerName: task.assignedTo })}
                onRefresh={refreshWork}
                workItems={workItems}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="WorkerDirectory">
            {({ navigation }) => <WorkerDirectory isDarkTheme={isDarkTheme} onBack={() => navigation.goBack()} />}
          </Stack.Screen>
          <Stack.Screen name="AssignWork">
            {({ navigation, route }) => (
              <AssignWork
                isDarkTheme={isDarkTheme}
                userName={displayName}
                onAssignWork={async (work) => {
                  const result = await api.createWork(work);
                  await refreshWork();
                  navigation.goBack();
                  reportBandDelivery([result]);
                }}
                onBack={() => navigation.goBack()}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="BossProgress" listeners={{ focus: () => void refreshWork() }}>
            {({ navigation, route }) => (
              <BossProgress
                isDarkTheme={isDarkTheme}
                userName={displayName}
                workItems={workItems}
                onRefresh={refreshWork}
                onBack={() => navigation.goBack()}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="CreateWork">
            {({ navigation }) => (
              <CreateWork
                isDarkTheme={isDarkTheme}
                onPublishWork={async (work) => {
                  const results = await Promise.all(work.map((item) => api.createWork(item)));
                  await refreshWork();
                  navigation.goBack();
                  reportBandDelivery(results);
                }}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="WorkerDashboard" listeners={{ focus: () => void refreshWork() }}>
            {({ navigation, route }) => (
              <WorkerDashboard
                isDarkTheme={isDarkTheme}
                userName={displayName}
                avatar={profile?.avatar}
                onOpenProfile={() => navigation.navigate('Profile')}
                onLogout={logout}
                onOpenTask={(task) => navigation.navigate('TaskDetail', { id: task.id, workerName: displayName })}
                onViewAll={() => navigation.navigate('WorkerTasks', { userName: route.params?.userName })}
                onRefresh={refreshWork}
                workItems={workItems}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="WorkerTasks" listeners={{ focus: () => void refreshWork() }}>
            {({ navigation, route }) => (
              <WorkerTasks
                isDarkTheme={isDarkTheme}
                userName={displayName}
                onBack={() => navigation.goBack()}
                onOpenTask={(task) => navigation.navigate('TaskDetail', { id: task.id, workerName: displayName })}
                onRefresh={refreshWork}
                workItems={workItems}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="TaskDetail" listeners={{ focus: () => void refreshWork() }}>
            {({ navigation, route }) => {
              const task = workItems.find((item) => item.id === route.params.id);
              if (!task) {
                return (
                  <View style={[styles.missingTask, { backgroundColor: isDarkTheme ? '#07111F' : '#EEF5FF' }]}>
                    <ActivityIndicator color={isDarkTheme ? '#56A7FF' : '#1A67C9'} />
                  </View>
                );
              }
              return (
                <TaskDetail
                  isDarkTheme={isDarkTheme}
                  task={task}
                  workerName={route.params.workerName}
                  onRefresh={refreshWork}
                  onToggleSubtask={async (subtaskId, done) => {
                    await api.setSubtaskDone(task.id, subtaskId, done);
                    await refreshWork();
                  }}
                  onStatusChanged={async (status) => {
                    await api.updateWorkStatus(task.id, status);
                    await refreshWork();
                    navigation.goBack();
                  }}
                />
              );
            }}
          </Stack.Screen>
          <Stack.Screen name="Profile">
            {({ navigation }) => (
              <Profile
                isDarkTheme={isDarkTheme}
                role={role}
                onBack={() => navigation.goBack()}
                onProfileChanged={(updated) => {
                  setProfile(updated);
                  void refreshWork();
                }}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Settings">
            {({ navigation }) => (
              <Settings
                isDarkTheme={isDarkTheme}
                role={role}
                onSetDarkTheme={setTheme}
                onBack={() => navigation.goBack()}
                onLogout={logout}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
      {currentRouteName !== 'BossDashboard' && currentRouteName !== 'BossProgress' && currentRouteName !== 'AssignWork' && currentRouteName !== 'WorkerDashboard' && currentRouteName !== 'WorkerTasks' && currentRouteName !== 'TaskDetail' && currentRouteName !== 'Profile' && currentRouteName !== 'Settings' && (
        <GlobalPageTitle
          isDarkTheme={isDarkTheme}
          title={titleByRoute[currentRouteName] ?? currentRouteName}
        />
      )}
      {(currentRouteName === 'BossDashboard' || currentRouteName === 'WorkerDashboard') && (
        <SideMenu
          isDarkTheme={isDarkTheme}
          role={role}
          name={displayName}
          email={profile?.email}
          jobTitle={profile?.jobTitle}
          avatar={profile?.avatar}
          onOpenProfile={() => navigationRef.navigate('Profile')}
          shortcuts={menuShortcuts}
          onOpenSettings={() => navigationRef.navigate('Settings')}
          onLogout={logout}
        />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  missingTask: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globalPageTitle: {
    position: 'absolute',
    left: 16,
    zIndex: 1000,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  globalPageTitleText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
