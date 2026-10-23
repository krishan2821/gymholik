import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { useTheme } from '../../../src/theme/ThemeContext';

const OWNER_ONLY_SUBROUTES = new Set([
  'staff',
  'trainers',
  'plans',
  'settings',
  'audit',
  'gym-profile',
  'day-close',
]);

export default function MoreLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const role = user?.role || useAuthStore((state) => state.role);

  useEffect(() => {
    if (role === 'TRAINER') {
      router.replace('/(tabs)/members');
      return;
    }

    const segs = segments as string[];
    const subRoute = segs[2];
    if (role && role !== 'OWNER' && subRoute && OWNER_ONLY_SUBROUTES.has(subRoute)) {
      router.replace('/(tabs)/more');
    }
  }, [role, segments, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.bg,
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="staff" options={{ headerShown: false }} />
      <Stack.Screen name="plans" options={{ headerShown: false }} />
      <Stack.Screen name="gym-profile" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="subscription" options={{ headerShown: false }} />
      <Stack.Screen name="trainers/index" options={{ headerShown: false }} />
      <Stack.Screen name="trainers/add" options={{ headerShown: false }} />
      <Stack.Screen name="trainers/types" options={{ headerShown: false }} />
      <Stack.Screen name="trainers/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="trainers/[id]/assign" options={{ headerShown: false }} />
      <Stack.Screen name="audit" options={{ headerShown: false }} />
      <Stack.Screen name="day-close" options={{ headerShown: false }} />
      <Stack.Screen name="gallery" options={{ headerShown: false }} />
    </Stack>
  );
}
