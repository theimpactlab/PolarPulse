import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/lib/useColorScheme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/state/auth-store';
import { useAppStore } from '@/lib/state/app-store';
import { polarOAuthService } from '@/lib/services/polar-oauth';
import { Platform } from 'react-native';

// Only import KeyboardProvider on native platforms
const KeyboardProvider =
  Platform.OS !== 'web'
    ? require('react-native-keyboard-controller').KeyboardProvider
    : ({ children }: { children: React.ReactNode }) => <>{children}</>;

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Custom dark theme matching our design
const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0D0D0F',
    card: '#1A1A1E',
    text: '#F9FAFB',
    border: '#242428',
    primary: '#00D1A7',
  },
};

function RootLayoutNav({ colorScheme }: { colorScheme: 'light' | 'dark' | null | undefined }) {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    const initApp = async () => {
      // Initialize auth
      await initialize();

      // Check Polar connection status from backend
      // This syncs local state with backend in case OAuth completed on another device/browser
      try {
        const isConnected = await polarOAuthService.checkPolarConnection();
        const currentlyConnected = useAppStore.getState().isPolarConnected;

        if (isConnected && !currentlyConnected) {
          // Backend shows connected but local state doesn't - update local state
          useAppStore.setState({ isPolarConnected: true, isDemoMode: false });
          console.log('Polar connection status synced from backend');
        }
      } catch (err) {
        console.log('Failed to check Polar connection:', err);
      }

      SplashScreen.hideAsync();
    };

    initApp();
  }, [initialize]);

  return (
    <ThemeProvider value={CustomDarkTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="signup" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="workout/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="polar-callback" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}



export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <RootLayoutNav colorScheme={colorScheme} />
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}