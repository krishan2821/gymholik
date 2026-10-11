import React, { useEffect } from 'react';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../../src/store/useAuthStore';
import { FloatingTabBar } from '../../src/components/FloatingTabBar';
import { theme } from '../../src/theme/theme';
import {
  getHomeRouteForRole,
  getTabHrefForRole,
  getTabTitleForRole,
  isRouteAllowedForRole,
} from '../../src/navigation/tabsByRole';

export default function TabLayout() {
  const router = useRouter();
  const segments = useSegments();

  // Read role strictly from authenticated user object in auth store
  const user = useAuthStore((state) => state.user);
  const role = user?.role;

  // Deep-link guard: if user opens a route forbidden for their role, redirect to role's home
  useEffect(() => {
    if (!role) return;

    // segments e.g. ['(tabs)'] or ['(tabs)', 'notes'] or ['(tabs)', 'payments', 'dues']
    const segs = segments as string[];
    const currentTab = segs[1] || 'index';

    if (!isRouteAllowedForRole(role, currentTab)) {
      const home = getHomeRouteForRole(role);
      router.replace(home as any);
    }
  }, [segments, role, router]);

  // Prevent flash of wrong tabs: do not render tabs until authenticated user role is available
  if (!role) {
    return (
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
    );
  }

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      {/* 1. Home (Dashboard Money) — OWNER & STAFF only */}
      <Tabs.Screen
        name="index"
        options={{
          title: getTabTitleForRole(role, 'index'),
          href: getTabHrefForRole(role, 'index'),
        }}
      />

      {/* 2. Members / My Members — ALL ROLES */}
      <Tabs.Screen
        name="members"
        options={{
          title: getTabTitleForRole(role, 'members'),
          href: getTabHrefForRole(role, 'members'),
        }}
      />

      {/* 3. Check-in (Raised Center) — ALL ROLES */}
      <Tabs.Screen
        name="attendance"
        options={{
          title: getTabTitleForRole(role, 'attendance'),
          href: getTabHrefForRole(role, 'attendance'),
        }}
      />

      {/* 4. Notes — TRAINER only */}
      <Tabs.Screen
        name="notes"
        options={{
          title: getTabTitleForRole(role, 'notes'),
          href: getTabHrefForRole(role, 'notes'),
        }}
      />

      {/* 5. Profile — TRAINER only */}
      <Tabs.Screen
        name="profile"
        options={{
          title: getTabTitleForRole(role, 'profile'),
          href: getTabHrefForRole(role, 'profile'),
        }}
      />

      {/* 6. Payments — OWNER & STAFF only */}
      <Tabs.Screen
        name="payments"
        options={{
          title: getTabTitleForRole(role, 'payments'),
          href: getTabHrefForRole(role, 'payments'),
        }}
      />

      {/* 7. More — OWNER & STAFF only */}
      <Tabs.Screen
        name="more"
        options={{
          title: getTabTitleForRole(role, 'more'),
          href: getTabHrefForRole(role, 'more'),
        }}
      />
    </Tabs>
  );
}
