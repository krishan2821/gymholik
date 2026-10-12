import React, { useEffect } from 'react';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { View, Text, ActivityIndicator, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../../src/store/useAuthStore';
import { FloatingTabBar } from '../../src/components/FloatingTabBar';
import { AppContainer } from '../../src/components/AppContainer';
import { GymholikLogo } from '../../src/components/GymholikLogo';
import { useBreakpoint } from '../../src/hooks/useBreakpoint';
import { theme } from '../../src/theme/theme';
import {
  getHomeRouteForRole,
  getTabHrefForRole,
  getTabTitleForRole,
  isRouteAllowedForRole,
} from '../../src/navigation/tabsByRole';

import { LogOut } from 'lucide-react-native';

function DesktopTopBar({
  gymName,
  role,
  userName,
  onSignOut,
}: {
  gymName?: string | null;
  role?: string;
  userName?: string | null;
  onSignOut: () => void;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  const avatarRef = React.useCallback((node: any) => {
    if (!node || Platform.OS !== 'web') return;
    node.onkeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setMenuOpen((prev) => !prev);
      }
    };
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    const handleClickOutside = () => {
      setMenuOpen(false);
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    let timer: any = null;
    if (menuOpen) {
      timer = setTimeout(() => {
        window.addEventListener('click', handleClickOutside);
      }, 50);
    }

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
      window.removeEventListener('click', handleClickOutside);
      if (timer) clearTimeout(timer);
    };
  }, [menuOpen]);

  const initials = (userName || 'User')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={styles.desktopTopBar}>
      <View style={styles.desktopTopBarLeft}>
        <GymholikLogo size={24} />
        <Text style={styles.desktopTopBarTitle}>
          {gymName || 'Gymholik'}
        </Text>
        {role && (
          <View style={styles.desktopRoleBadge}>
            <Text style={styles.desktopRoleText}>{role}</Text>
          </View>
        )}
      </View>

      <View style={styles.desktopTopBarRight}>
        <TouchableOpacity
          ref={avatarRef}
          style={styles.avatarButton}
          onPress={() => setMenuOpen((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel="User account menu"
          accessibilityState={{ expanded: menuOpen }}
          {...({
            tabIndex: 0,
            focusable: true,
          } as any)}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </TouchableOpacity>

        {menuOpen && (
          <View style={styles.dropdownMenu}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuUserName} numberOfLines={1}>
                {userName || 'User'}
              </Text>
              {role && (
                <View style={styles.menuRoleBadge}>
                  <Text style={styles.menuRoleText}>{role}</Text>
                </View>
              )}
            </View>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                onSignOut();
              }}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              {...({
                onKeyDown: (e: any) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setMenuOpen(false);
                    onSignOut();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setMenuOpen(false);
                  }
                },
              } as any)}
            >
              <LogOut size={15} color="#FF7A7A" />
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isDesktop } = useBreakpoint();

  // Read role strictly from authenticated user object in auth store
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const role = user?.role;
  const showDesktopTopBar = Platform.OS === 'web' && isDesktop;

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

  return (
    <View style={styles.desktopWrapper}>
      {showDesktopTopBar && (
        <DesktopTopBar
          gymName={user?.gymName}
          role={role}
          userName={user?.name}
          onSignOut={handleSignOut}
        />
      )}
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
      </AppContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#051F20',
  },
  desktopTopBar: {
    width: '100%',
    height: 48,
    backgroundColor: '#051F20',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  desktopTopBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  desktopTopBarTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 15,
    fontWeight: '700',
    color: '#DAF1DE',
    letterSpacing: 0.3,
  },
  desktopRoleBadge: {
    backgroundColor: 'rgba(142, 182, 155, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(142, 182, 155, 0.25)',
  },
  desktopRoleText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 11,
    fontWeight: '600',
    color: '#8EB69B',
    letterSpacing: 0.5,
  },
  desktopTopBarRight: {
    position: 'relative',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 100,
  },
  avatarButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(142, 182, 155, 0.18)',
    borderWidth: 1.5,
    borderColor: '#8EB69B',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  avatarText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 12,
    fontWeight: '700',
    color: '#DAF1DE',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 38,
    right: 0,
    minWidth: 190,
    backgroundColor: '#072728',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.16)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    zIndex: 9999,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
        } as any)
      : {}),
  },
  menuHeader: {
    marginBottom: 6,
  },
  menuUserName: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 13,
    fontWeight: '700',
    color: '#DAF1DE',
    marginBottom: 4,
  },
  menuRoleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(142, 182, 155, 0.14)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(142, 182, 155, 0.25)',
  },
  menuRoleText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 10,
    fontWeight: '600',
    color: '#8EB69B',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(218, 241, 222, 0.08)',
    marginVertical: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  signOutText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '600',
    color: '#FF7A7A',
  },
});

