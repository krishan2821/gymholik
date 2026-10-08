import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft, X } from 'lucide-react-native';
import { theme } from '../../../src/theme/theme';
import { MEMBERS, MEMBER_PROFILE, RENEW } from '../../../src/constants/strings';

export default function MembersLayout() {
  const router = useRouter();

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
          title: MEMBERS.SCREEN_TITLE,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="add"
        options={{
          title: MEMBERS.ADD_MEMBER,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: MEMBER_PROFILE.SCREEN_TITLE,
        }}
      />
      <Stack.Screen
        name="[id]/renew"
        options={{
          title: RENEW.SCREEN_TITLE,
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
