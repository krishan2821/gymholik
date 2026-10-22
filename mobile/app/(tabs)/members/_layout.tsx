import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft, X } from 'lucide-react-native';
import { useTheme, useStyles, ThemeValue } from '../../../src/theme/ThemeContext';
import { MEMBERS, MEMBER_PROFILE, RENEW } from '../../../src/constants/strings';
import { safeBack } from '../../../src/utils/navigation';

export default function MembersLayout() {
  const router = useRouter();
  const { colors, fonts } = useTheme();
  const styles = useStyles(makeStyles);

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
            onPress={() => safeBack('/(tabs)/members')}
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
          title: MEMBERS.SCREEN_TITLE,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="add"
        options={{
          title: MEMBERS.ADD_MEMBER,
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: MEMBER_PROFILE.SCREEN_TITLE,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[id]/renew"
        options={{
          title: RENEW.SCREEN_TITLE,
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
