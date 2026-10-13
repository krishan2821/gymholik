import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { theme } from '../../../src/theme/theme';
import { safeBack } from '../../../src/utils/navigation';
import {
  MORE,
  STAFF,
  PLANS,
  SETTINGS,
  SUBSCRIPTION,
  TRAINERS,
  TRAINER_TYPES,
  AUDIT_LOGS,
  GYM_PROFILE,
} from '../../../src/constants/strings';

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
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
        headerShadowVisible: false,
        headerTintColor: theme.colors.text,
        headerBackVisible: false,
        headerTitleStyle: {
          fontFamily: theme.fonts.headingBold,
          fontSize: 18,
          color: theme.colors.text,
        },
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
        animation: 'slide_from_right',
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => safeBack('/(tabs)/more')}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft color={theme.colors.text} size={20} />
          </TouchableOpacity>
        ),
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: MORE.SCREEN_TITLE,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          title: 'Edit Profile',
        }}
      />
      <Stack.Screen
        name="staff"
        options={{
          title: STAFF.SCREEN_TITLE,
        }}
      />
      <Stack.Screen
        name="plans"
        options={{
          title: PLANS.SCREEN_TITLE,
        }}
      />
      <Stack.Screen
        name="gym-profile"
        options={{
          title: GYM_PROFILE.SCREEN_TITLE,
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: SETTINGS.SCREEN_TITLE,
        }}
      />
      <Stack.Screen
        name="subscription"
        options={{
          title: SUBSCRIPTION.SCREEN_TITLE,
        }}
      />
      <Stack.Screen
        name="trainers/index"
        options={{
          title: TRAINERS.SCREEN_TITLE,
        }}
      />
      <Stack.Screen
        name="trainers/add"
        options={{
          title: TRAINERS.ADD_SCREEN_TITLE,
        }}
      />
      <Stack.Screen
        name="trainers/types"
        options={{
          title: TRAINER_TYPES.SCREEN_TITLE,
        }}
      />
      <Stack.Screen
        name="trainers/[id]"
        options={{
          title: TRAINERS.DETAIL_TITLE,
        }}
      />
      <Stack.Screen
        name="trainers/[id]/assign"
        options={{
          title: TRAINERS.ASSIGN_MEMBERS_TITLE,
        }}
      />
      <Stack.Screen
        name="audit"
        options={{
          title: AUDIT_LOGS.SCREEN_TITLE,
        }}
      />
      <Stack.Screen
        name="day-close"
        options={{
          title: 'Day Close',
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
});
