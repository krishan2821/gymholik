import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, TextInput, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useAuthStore } from '../src/store/useAuthStore';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import {
  useAppearanceSync,
  useAppearanceStore,
  loadAppearanceSetting,
} from '../src/theme/useAppearance';
import { toastConfig } from '../src/components/Toast';
import { GlobalConfirmDialog } from '../src/components/ConfirmDialog';
import { queryClient } from '../src/api/queryClient';
import { getHomeRouteForRole } from '../src/navigation/tabsByRole';
import { injectGlobalWebStyles } from '../src/utils/webStyles';

// ── Inner layout: has access to ThemeProvider ─────────────────────────────
function InnerLayout() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useTheme();
  const resolvedMode = useAppearanceStore((s) => s.resolvedMode);

  // Sync OS appearance changes → store
  useAppearanceSync();

  const [fontsLoaded] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Set global text cursor/selection colour from primary token
  useEffect(() => {
    if ((TextInput as any).defaultProps == null) {
      (TextInput as any).defaultProps = {};
    }
    (TextInput as any).defaultProps.cursorColor = colors.primary;
    (TextInput as any).defaultProps.selectionColor = colors.primary;
  }, [colors.primary]);

  useEffect(() => {
    injectGlobalWebStyles();
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Gymholik: Gym management';
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', colors.bg);
      }
    }
    checkAuth();
  }, [colors.bg]);

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
  const statusStyle = resolvedMode === 'dark' ? 'light' : 'dark';

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={statusStyle} />
      {showSplash ? (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.bg,
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <QueryClientProvider client={queryClient}>
          <Slot />
          <GlobalConfirmDialog />
          <Toast config={toastConfig} />
        </QueryClientProvider>
      )}
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  // Load persisted appearance setting before rendering
  useEffect(() => {
    loadAppearanceSetting();
  }, []);

  return (
    <ThemeProvider>
      <InnerLayout />
    </ThemeProvider>
  );
}
