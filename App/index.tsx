import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import BandAuth from './BandAuth';
import Intro from './Intro';
import Login from './Login';

type RootStackParamList = {
  Intro: undefined;
  Login: undefined;
  BandAuth: undefined;
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
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
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
    BandAuth: 'Band Auth',
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
                onBandSSO={() => navigation.navigate('BandAuth')}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="BandAuth">
            {() => <BandAuth isDarkTheme={isDarkTheme} />}
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
