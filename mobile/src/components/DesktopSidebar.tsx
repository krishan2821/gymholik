import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import {
  Home,
  Users,
  CalendarCheck,
  CreditCard,
  Menu,
  NotebookPen,
  User,
  LogOut,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { GymholikLogo } from './GymholikLogo';
import { getTabsForRole, TabItemConfig } from '../navigation/tabsByRole';

const TAB_ICONS: Record<string, React.ComponentType<any>> = {
  index: Home,
  members: Users,
  attendance: CalendarCheck,
  notes: NotebookPen,
  profile: User,
  payments: CreditCard,
  more: Menu,
};

export interface DesktopSidebarProps {
  role?: string;
  currentTab: string;
  gymName?: string | null;
  userName?: string | null;
  onNavigate: (name: string, href: string | null) => void;
  onSignOut: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  role,
  currentTab,
  gymName,
  userName,
  onNavigate,
  onSignOut,
}) => {
  const { colors, fonts } = useTheme();
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [hoveredSignOut, setHoveredSignOut] = useState(false);

  const allowedTabs = getTabsForRole(role);

  const initials = (userName || 'User')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View
      style={[
        styles.sidebar,
        {
          backgroundColor: colors.surface,
          borderRightColor: colors.border,
        },
      ]}
    >
      {/* ── Top Header: Logo + Gym Name ──────────────────────── */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <GymholikLogo size={28} />
          <View style={styles.titleCol}>
            <Text
              style={[
                styles.gymName,
                { fontFamily: fonts.headingBold, color: colors.text },
              ]}
              numberOfLines={1}
            >
              {gymName || 'Gymholik Fitness'}
            </Text>
            {role && (
              <View
                style={[
                  styles.roleBadge,
                  {
                    backgroundColor: colors.primarySoft,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.roleText,
                    { fontFamily: fonts.headingMedium, color: colors.primary },
                  ]}
                >
                  {role}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── Middle: Navigation Items ───────────────────────────── */}
      <View style={styles.navSection}>
        {allowedTabs.map((tab: TabItemConfig) => {
          const isCheckIn = tab.isRaisedCenter || tab.name === 'attendance';
          const isFocused = currentTab === tab.name;
          const isHovered = hoveredTab === tab.name;
          const Icon = TAB_ICONS[tab.name] || Home;

          if (isCheckIn) {
            return (
              <TouchableOpacity
                key={tab.name}
                onPress={() => onNavigate(tab.name, tab.href)}
                style={[
                  styles.checkInButton,
                  { backgroundColor: colors.primary },
                  isFocused && { borderWidth: 2, borderColor: colors.text },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Check-in primary action"
                {...({
                  onMouseEnter: () => setHoveredTab(tab.name),
                  onMouseLeave: () => setHoveredTab(null),
                  tabIndex: 0,
                } as any)}
              >
                <View style={styles.checkInContent}>
                  <CalendarCheck
                    size={20}
                    color={colors.textOnPrimary}
                    strokeWidth={2.4}
                  />
                  <Text
                    style={[
                      styles.checkInText,
                      { fontFamily: fonts.headingBold, color: colors.textOnPrimary },
                    ]}
                  >
                    Check-in
                  </Text>
                </View>
                <Sparkles size={14} color={colors.textOnPrimary} />
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => onNavigate(tab.name, tab.href)}
              style={[
                styles.navItem,
                isFocused && { backgroundColor: colors.primarySoft },
                isHovered && !isFocused && { backgroundColor: colors.surfaceRaised },
              ]}
              accessibilityRole="button"
              accessibilityLabel={tab.title}
              {...({
                onMouseEnter: () => setHoveredTab(tab.name),
                onMouseLeave: () => setHoveredTab(null),
                tabIndex: 0,
              } as any)}
            >
              <View style={styles.navItemLeft}>
                <Icon
                  size={19}
                  color={isFocused ? colors.primary : colors.textSecondary}
                  strokeWidth={isFocused ? 2.2 : 1.8}
                />
                <Text
                  style={[
                    styles.navItemText,
                    {
                      fontFamily: isFocused ? fonts.headingSemiBold : fonts.bodyMedium,
                      color: isFocused ? colors.text : colors.textSecondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {tab.title}
                </Text>
              </View>

              {isFocused && (
                <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Bottom: User Menu ─────────────────────────────────── */}
      <View style={[styles.userMenu, { borderTopColor: colors.border }]}>
        <View style={styles.userCard}>
          <View
            style={[
              styles.userAvatar,
              {
                backgroundColor: colors.primarySoft,
                borderColor: colors.primary,
              },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                { fontFamily: fonts.headingBold, color: colors.text },
              ]}
            >
              {initials}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text
              style={[
                styles.userName,
                { fontFamily: fonts.headingMedium, color: colors.text },
              ]}
              numberOfLines={1}
            >
              {userName || 'User'}
            </Text>
            <Text
              style={[
                styles.userRoleSubtitle,
                { fontFamily: fonts.bodyRegular, color: colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {role || 'Staff'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onSignOut}
          style={[
            styles.signOutBtn,
            hoveredSignOut && { backgroundColor: `${colors.danger}18` },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          {...({
            onMouseEnter: () => setHoveredSignOut(true),
            onMouseLeave: () => setHoveredSignOut(false),
            tabIndex: 0,
          } as any)}
        >
          <LogOut size={16} color={colors.danger} />
          <Text
            style={[
              styles.signOutText,
              { fontFamily: fonts.bodyMedium, color: colors.danger },
            ]}
          >
            Sign out
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    height: '100%',
    borderRightWidth: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingVertical: 24,
    paddingHorizontal: 16,
    zIndex: 100,
    ...(Platform.OS === 'web'
      ? ({
          flexShrink: 0,
          userSelect: 'none',
        } as any)
      : {}),
  },
  header: {
    marginBottom: 28,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleCol: {
    flex: 1,
  },
  gymName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  navSection: {
    flex: 1,
    gap: 8,
  },
  checkInButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        } as any)
      : {}),
  },
  checkInContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkInText: {
    fontSize: 14,
    fontWeight: '700',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'background 0.15s ease',
        } as any)
      : {}),
  },
  navItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  userMenu: {
    borderTopWidth: 1,
    paddingTop: 16,
    gap: 10,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
  },
  userRoleSubtitle: {
    fontSize: 11,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'background 0.15s ease',
        } as any)
      : {}),
  },
  signOutText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default DesktopSidebar;
