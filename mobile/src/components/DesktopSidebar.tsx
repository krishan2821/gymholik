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
import { theme } from '../theme/theme';
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
    <View style={styles.sidebar}>
      {/* ── Top Header: Logo + Gym Name ──────────────────────── */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <GymholikLogo size={28} />
          <View style={styles.titleCol}>
            <Text style={styles.gymName} numberOfLines={1}>
              {gymName || 'Gymholik Fitness'}
            </Text>
            {role && (
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{role}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── Middle: Navigation Items for Current Role ───────── */}
      <View style={styles.navSection}>
        {allowedTabs.map((tab: TabItemConfig) => {
          const isCheckIn = tab.isRaisedCenter || tab.name === 'attendance';
          const isFocused = currentTab === tab.name;
          const isHovered = hoveredTab === tab.name;
          const Icon = TAB_ICONS[tab.name] || Home;

          // ── Check-in highlighted as Primary Action ──────────
          if (isCheckIn) {
            return (
              <TouchableOpacity
                key={tab.name}
                onPress={() => onNavigate(tab.name, tab.href)}
                style={[
                  styles.checkInButton,
                  isHovered && styles.checkInButtonHovered,
                  isFocused && styles.checkInButtonActive,
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
                    color="#051F20"
                    strokeWidth={2.4}
                  />
                  <Text style={styles.checkInText}>Check-in</Text>
                </View>
                <Sparkles size={14} color="#051F20" style={{ opacity: 0.8 }} />
              </TouchableOpacity>
            );
          }

          // ── Regular Nav Item ────────────────────────────────
          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => onNavigate(tab.name, tab.href)}
              style={[
                styles.navItem,
                isFocused && styles.navItemActive,
                isHovered && !isFocused && styles.navItemHovered,
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
                  color={isFocused ? '#DAF1DE' : 'rgba(218, 241, 222, 0.65)'}
                  strokeWidth={isFocused ? 2.2 : 1.8}
                />
                <Text
                  style={[
                    styles.navItemText,
                    isFocused && styles.navItemTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {tab.title}
                </Text>
              </View>

              {isFocused && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Bottom: User Menu ─────────────────────────────────── */}
      <View style={styles.userMenu}>
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {userName || 'User'}
            </Text>
            <Text style={styles.userRoleSubtitle} numberOfLines={1}>
              {role || 'Staff'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onSignOut}
          style={[
            styles.signOutBtn,
            hoveredSignOut && styles.signOutBtnHovered,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          {...({
            onMouseEnter: () => setHoveredSignOut(true),
            onMouseLeave: () => setHoveredSignOut(false),
            tabIndex: 0,
          } as any)}
        >
          <LogOut size={16} color="#FF7A7A" />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    height: '100%',
    backgroundColor: '#072728',
    borderRightWidth: 1,
    borderRightColor: 'rgba(218, 241, 222, 0.08)',
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
    fontFamily: theme.fonts.headingBold,
    fontSize: 15,
    fontWeight: '700',
    color: '#DAF1DE',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(142, 182, 155, 0.14)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(142, 182, 155, 0.25)',
  },
  roleText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 10,
    fontWeight: '600',
    color: '#8EB69B',
    letterSpacing: 0.4,
  },
  navSection: {
    flex: 1,
    gap: 8,
  },
  checkInButton: {
    backgroundColor: '#8EB69B',
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
          boxShadow: '0 4px 14px rgba(142, 182, 155, 0.28)',
        } as any)
      : {}),
  },
  checkInButtonHovered: {
    backgroundColor: '#A0C6AC',
    ...(Platform.OS === 'web'
      ? ({
          transform: [{ translateY: -1 }],
          boxShadow: '0 6px 18px rgba(142, 182, 155, 0.4)',
        } as any)
      : {}),
  },
  checkInButtonActive: {
    borderWidth: 2,
    borderColor: '#DAF1DE',
  },
  checkInContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkInText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#051F20',
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
  navItemHovered: {
    backgroundColor: 'rgba(218, 241, 222, 0.06)',
  },
  navItemActive: {
    backgroundColor: 'rgba(142, 182, 155, 0.14)',
  },
  navItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navItemText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 14,
    color: 'rgba(218, 241, 222, 0.70)',
    fontWeight: '500',
  },
  navItemTextActive: {
    color: '#DAF1DE',
    fontFamily: theme.fonts.headingSemiBold,
    fontWeight: '700',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8EB69B',
  },
  userMenu: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(218, 241, 222, 0.08)',
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
    backgroundColor: 'rgba(142, 182, 155, 0.18)',
    borderWidth: 1.5,
    borderColor: '#8EB69B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 12,
    fontWeight: '700',
    color: '#DAF1DE',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 13,
    fontWeight: '600',
    color: '#DAF1DE',
  },
  userRoleSubtitle: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 11,
    color: 'rgba(218, 241, 222, 0.55)',
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
  signOutBtnHovered: {
    backgroundColor: 'rgba(255, 122, 122, 0.1)',
  },
  signOutText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '600',
    color: '#FF7A7A',
  },
});
