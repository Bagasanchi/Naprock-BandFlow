import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './App';

// I keep the Expo entrypoint here so the app works in Expo Go and native builds.
registerRootComponent(App);
