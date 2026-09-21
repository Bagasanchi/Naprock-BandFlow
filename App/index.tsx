import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import BandAuth from './BandAuth';
import BandAuthenticatorApp from './BandAuthenticatorApp';
import Dashboard from './Dashboard';
import CreateWork from './CreateWork';
import Intro from './Intro';
import Login from './Login';
import SignUp from './SignUp';
import TaskDetail from './TaskDetail';
import WorkerDashboard from './WorkerDashboard';
import WorkerTasks from './WorkerTasks';
import BossProgress from './BossProgress';
import AssignWork from './AssignWork';
import WorkerDirectory from './WorkerDirectory';
import type { WorkItem } from '../lib/work';
import * as api from '../lib/api';

type RootStackParamList = {
  Intro: undefined;
  Login: undefined;
  SignUp: undefined;
  BandAuth: undefined;
  BandAuthenticatorApp: undefined;
  TaskDetail: {
    title: string;
    priority: string;
    due: string;
    progress: number;
    workerName: string;
  };
  CreateWork: undefined;
  BossDashboard: { userName?: string } | undefined;
  WorkerDashboard: { userName?: string } | undefined;
  WorkerTasks: { userName?: string } | undefined;
  BossProgress: { userName?: string } | undefined;
  AssignWork: { userName?: string } | undefined;
  WorkerDirectory: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function isWorkAssignedToUser(assignedTo: string, userName: string) {
  const assignedName = assignedTo.trim().toLowerCase();
  const loggedInName = userName.trim().toLowerCase();
  if (!assignedName || !loggedInName) return false;
  if (assignedName === loggedInName) return true;
  return assignedName.split(/\s+/)[0] === loggedInName.split(/\s+/)[0];
}

type GlobalThemeToggleProps = {
  isDarkTheme: boolean;
  onToggleTheme: () => void;
};

function GlobalThemeToggle({ isDarkTheme, onToggleTheme }: GlobalThemeToggleProps) {
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        onPress={onToggleTheme}
        style={[
          styles.globalThemeToggle,
          {
            top: insets.top + 8,
            backgroundColor: isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : '#DDEBFC',
          },
        ]}
      >
        <Text style={[styles.globalThemeToggleText, { color: isDarkTheme ? '#E3EEFF' : '#163E6D' }]}>
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
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [currentRouteName, setCurrentRouteName] = useState<keyof RootStackParamList>('Intro');
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  const refreshWork = async () => {
    try {
      setWorkItems(await api.getWork());
    } catch {
      setWorkItems([]);
    }
  };

  const titleByRoute: Record<keyof RootStackParamList, string> = {
    Intro: 'Intro',
    Login: 'Login',
    SignUp: 'Sign up',
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
                  void refreshWork();
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
          <Stack.Screen name="BossDashboard">
            {({ navigation, route }) => (
              <Dashboard
                isDarkTheme={isDarkTheme}
                userName={route.params?.userName ?? 'Workspace member'}
                onLogout={() => { void api.logout(); navigation.reset({ index: 0, routes: [{ name: 'Intro' }] }); }}
                onCreateWork={() => navigation.navigate('CreateWork')}
                onSeeProgress={() => navigation.navigate('BossProgress', { userName: route.params?.userName })}
                onAssignWork={() => navigation.navigate('AssignWork', { userName: route.params?.userName })}
                onManageWorkers={() => navigation.navigate('WorkerDirectory')}
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
                userName={route.params?.userName ?? 'Workspace member'}
                onAssignWork={async (work) => {
                  await api.createWork(work);
                  await refreshWork();
                  navigation.goBack();
                }}
                onBack={() => navigation.goBack()}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="BossProgress">
            {({ navigation, route }) => (
              <BossProgress
                isDarkTheme={isDarkTheme}
                userName={route.params?.userName ?? 'Workspace member'}
                workItems={workItems}
                onBack={() => navigation.goBack()}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="CreateWork">
            {({ navigation }) => (
              <CreateWork
                isDarkTheme={isDarkTheme}
                onPublishWork={async (work) => {
                  await Promise.all(work.map((item) => api.createWork(item)));
                  await refreshWork();
                  navigation.goBack();
                }}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="WorkerDashboard">
            {({ navigation, route }) => (
              <WorkerDashboard
                isDarkTheme={isDarkTheme}
                userName={route.params?.userName ?? 'Workspace member'}
                onLogout={() => { void api.logout(); navigation.reset({ index: 0, routes: [{ name: 'Intro' }] }); }}
                onOpenTask={(task) => navigation.navigate('TaskDetail', { ...task, workerName: route.params?.userName ?? 'Workspace member' })}
                onViewAll={() => navigation.navigate('WorkerTasks', { userName: route.params?.userName })}
                workItems={workItems.filter((item) => isWorkAssignedToUser(item.assignedTo, route.params?.userName ?? 'Workspace member'))}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="WorkerTasks">
            {({ navigation, route }) => (
              <WorkerTasks
                isDarkTheme={isDarkTheme}
                userName={route.params?.userName ?? 'Workspace member'}
                onBack={() => navigation.goBack()}
                onOpenTask={(task) => navigation.navigate('TaskDetail', { ...task, workerName: route.params?.userName ?? 'Workspace member' })}
                workItems={workItems.filter((item) => isWorkAssignedToUser(item.assignedTo, route.params?.userName ?? 'Workspace member'))}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="TaskDetail">
            {({ route }) => (
              <TaskDetail
                isDarkTheme={isDarkTheme}
                title={route.params.title}
                priority={route.params.priority}
                due={route.params.due}
                progress={route.params.progress}
                workerName={route.params.workerName}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
      {currentRouteName !== 'BossDashboard' && currentRouteName !== 'BossProgress' && currentRouteName !== 'AssignWork' && currentRouteName !== 'WorkerDashboard' && currentRouteName !== 'WorkerTasks' && currentRouteName !== 'TaskDetail' && (
        <GlobalPageTitle
          isDarkTheme={isDarkTheme}
          title={titleByRoute[currentRouteName] ?? currentRouteName}
        />
      )}
      <GlobalThemeToggle
        isDarkTheme={isDarkTheme}
        onToggleTheme={() => setIsDarkTheme((prev) => !prev)}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  globalThemeToggle: {
    position: 'absolute',
    right: 16,
    zIndex: 1000,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  },
  globalPageTitleText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
