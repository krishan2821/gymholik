import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { useTheme, useStyles, ThemeValue } from '../../../src/theme/ThemeContext';
import { PAYMENTS, DUES, COLLECT } from '../../../src/constants/strings';
import { safeBack } from '../../../src/utils/navigation';

export default function PaymentsLayout() {
  const router = useRouter();
  const { colors, fonts } = useTheme();
  const styles = useStyles(makeStyles);
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
          backgroundColor: colors.bg,
        },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerBackVisible: false,
        headerTitleStyle: {
          fontFamily: fonts.headingBold,
          fontSize: 18,
          color: colors.text,
        },
        contentStyle: {
          backgroundColor: colors.bg,
        },
        animation: 'slide_from_right',
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => safeBack('/(tabs)/payments')}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft color={colors.text} size={20} />
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
          headerShown: false,
          presentation: 'card',
        }}
      />
    </Stack>
  );
}

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
  });
