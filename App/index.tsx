import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import BandAuth from './BandAuth';
import Dashboard from './Dashboard';
import Intro from './Intro';
import Login from './Login';
import SignUp from './SignUp';
import WorkerDashboard from './WorkerDashboard';

type RootStackParamList = {
  Intro: undefined;
  Login: undefined;
  SignUp: undefined;
  BandAuth: undefined;
  BossDashboard: { userName?: string } | undefined;
  WorkerDashboard: { userName?: string } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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
  const [currentRouteName, setCurrentRouteName] = useState<keyof RootStackParamList>('Intro');
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  const titleByRoute: Record<keyof RootStackParamList, string> = {
    Intro: 'Intro',
    Login: 'Login',
    SignUp: 'Sign up',
    BandAuth: 'Band Auth',
    BossDashboard: 'Boss Dashboard',
    WorkerDashboard: 'Worker Dashboard',
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
                onLogin={(role, userName) => navigation.reset({
                  index: 0,
                  routes: [{
                    name: role === 'boss' ? 'BossDashboard' : 'WorkerDashboard',
                    params: { userName },
                  }],
                })}
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
          <Stack.Screen name="BossDashboard">
            {({ navigation, route }) => (
              <Dashboard
                isDarkTheme={isDarkTheme}
                userName={route.params?.userName ?? 'Workspace member'}
                onLogout={() => navigation.reset({ index: 0, routes: [{ name: 'Intro' }] })}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="WorkerDashboard">
            {({ navigation, route }) => (
              <WorkerDashboard
                isDarkTheme={isDarkTheme}
                userName={route.params?.userName ?? 'Workspace member'}
                onLogout={() => navigation.reset({ index: 0, routes: [{ name: 'Intro' }] })}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
      {currentRouteName !== 'BossDashboard' && currentRouteName !== 'WorkerDashboard' && (
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
