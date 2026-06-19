import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNav } from './src/navigation/RootNav';
import { PairingProvider } from './src/store/pairing';
import { ThemeProvider } from './src/theme/colors';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PairingProvider>
          <StatusBar style="light" />
          <RootNav />
        </PairingProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}