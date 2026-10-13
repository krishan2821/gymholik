import React, { useEffect } from 'react';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../../src/store/useAuthStore';
import { FloatingTabBar } from '../../src/components/FloatingTabBar';
import { AppContainer } from '../../src/components/AppContainer';
import { DesktopSidebar } from '../../src/components/DesktopSidebar';
import { useBreakpoint } from '../../src/hooks/useBreakpoint';
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
  const { isDesktop } = useBreakpoint();

  // Read role strictly from authenticated user object in auth store
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const role = user?.role;

  const handleSignOut = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

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

  const segs = segments as string[];
  const currentTabName = segs[1] || 'index';

  const renderScreens = () => [
    <Tabs.Screen
      key="index"
      name="index"
      options={{
        title: getTabTitleForRole(role, 'index'),
        href: getTabHrefForRole(role, 'index'),
      }}
    />,
    <Tabs.Screen
      key="members"
      name="members"
      options={{
        title: getTabTitleForRole(role, 'members'),
        href: getTabHrefForRole(role, 'members'),
      }}
    />,
    <Tabs.Screen
      key="attendance"
      name="attendance"
      options={{
        title: getTabTitleForRole(role, 'attendance'),
        href: getTabHrefForRole(role, 'attendance'),
      }}
    />,
    <Tabs.Screen
      key="notes"
      name="notes"
      options={{
        title: getTabTitleForRole(role, 'notes'),
        href: getTabHrefForRole(role, 'notes'),
      }}
    />,
    <Tabs.Screen
      key="profile"
      name="profile"
      options={{
        title: getTabTitleForRole(role, 'profile'),
        href: getTabHrefForRole(role, 'profile'),
      }}
    />,
    <Tabs.Screen
      key="payments"
      name="payments"
      options={{
        title: getTabTitleForRole(role, 'payments'),
        href: getTabHrefForRole(role, 'payments'),
      }}
    />,
    <Tabs.Screen
      key="more"
      name="more"
      options={{
        title: getTabTitleForRole(role, 'more'),
        href: getTabHrefForRole(role, 'more'),
      }}
    />,
  ];

  // ── Desktop Layout (Width >= 1024): Left 240px Sidebar + Centered Content ─
  if (isDesktop) {
    return (
      <View style={styles.desktopRoot}>
        <DesktopSidebar
          role={role}
          currentTab={currentTabName}
          gymName={user?.gymName}
          userName={user?.name}
          onNavigate={(name, href) => {
            if (href) router.push(href as any);
          }}
          onSignOut={handleSignOut}
        />
        <View style={styles.desktopMainContainer}>
          <Tabs
            tabBar={() => null}
            screenOptions={{
              headerShown: false,
              sceneStyle: {
                backgroundColor: theme.colors.background,
              },
            }}
          >
            {renderScreens()}
          </Tabs>
        </View>
      </View>
    );
  }

  // ── Mobile & Tablet Layout (Width < 1024): AppContainer + Floating Tab Bar ─
  return (
    <View style={styles.mobileRoot}>
      <AppContainer>
        <Tabs
          tabBar={(props) => <FloatingTabBar {...props} />}
          screenOptions={{
            headerShown: false,
            sceneStyle: {
              backgroundColor: theme.colors.background,
            },
          }}
        >
          {renderScreens()}
        </Tabs>
      </AppContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopRoot: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    backgroundColor: '#051F20',
  },
  desktopMainContainer: {
    flex: 1,
    height: '100%',
    backgroundColor: '#051F20',
  },
  mobileRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#051F20',
  },
});
