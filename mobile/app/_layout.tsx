import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useAuthStore } from '../src/store/useAuthStore';
import { theme } from '../src/theme/theme';
import { toastConfig } from '../src/components/Toast';
import { queryClient } from '../src/api/queryClient';
import { getHomeRouteForRole } from '../src/navigation/tabsByRole';

// Set global text cursor and selection colour to #8EB69B across all inputs
if ((TextInput as any).defaultProps == null) {
  (TextInput as any).defaultProps = {};
}
(TextInput as any).defaultProps.cursorColor = '#8EB69B';
(TextInput as any).defaultProps.selectionColor = '#8EB69B';

export default function RootLayout() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isLoading || !fontsLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      const user = useAuthStore.getState().user;
      const role = user?.role || useAuthStore.getState().role;
      router.replace(getHomeRouteForRole(role) as any);
    }
  }, [isAuthenticated, isLoading, fontsLoaded, segments]);

  const showSplash = isLoading || !fontsLoaded;

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style="light" />
      {showSplash ? (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.colors.background,
          }}
        >
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <QueryClientProvider client={queryClient}>
          <Slot />
          <Toast config={toastConfig} />
        </QueryClientProvider>
      )}
    </SafeAreaProvider>
  );
}
