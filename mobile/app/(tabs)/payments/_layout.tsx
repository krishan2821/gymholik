import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { theme } from '../../../src/theme/theme';
import { PAYMENTS, DUES, COLLECT } from '../../../src/constants/strings';

export default function PaymentsLayout() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const role = user?.role || useAuthStore((state) => state.role);

  useEffect(() => {
    if (role === 'TRAINER') {
      router.replace('/(tabs)/members');
    }
  }, [role, router]);

  if (role === 'TRAINER') {
    return null;
  }

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
          title: PAYMENTS.SCREEN_TITLE,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="dues"
        options={{
          title: DUES.SCREEN_TITLE,
        }}
      />
      <Stack.Screen
        name="collect"
        options={{
          title: COLLECT.SCREEN_TITLE,
          presentation: 'card',
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
