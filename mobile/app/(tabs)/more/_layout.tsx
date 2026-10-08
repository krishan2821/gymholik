import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { theme } from '../../../src/theme/theme';
import {
  MORE,
  STAFF,
  PLANS,
  SETTINGS,
  SUBSCRIPTION,
  CHANGE_PASSWORD,
  TRAINERS,
  TRAINER_TYPES,
  AUDIT_LOGS,
} from '../../../src/constants/strings';

export default function MoreLayout() {
  const router = useRouter();
  const segments = useSegments();
  const user = useAuthStore((state) => state.user);
  const role = user?.role || useAuthStore((state) => state.role);

  useEffect(() => {
    if (role === 'TRAINER') {
      const segs = segments as string[];
      const subRoute = segs[2];
      // Trainers can only access password change under more
      if (subRoute !== 'password') {
        router.replace('/(tabs)/members');
      }
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
            onPress={() => router.back()}
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
        name="password"
        options={{
          title: CHANGE_PASSWORD.SCREEN_TITLE,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="trainers/index"
        options={{
          title: TRAINERS.SCREEN_TITLE,
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
    </Stack>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(11, 43, 38, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
});
