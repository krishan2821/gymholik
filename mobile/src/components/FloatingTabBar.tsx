import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Home,
  Users,
  CalendarCheck,
  CreditCard,
  Menu,
  NotebookPen,
  User,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme/theme';
import { useAuthStore } from '../store/useAuthStore';
import { getTabsForRole } from '../navigation/tabsByRole';

const TAB_ICONS: Record<string, React.ComponentType<any>> = {
  index: Home,
  members: Users,
  attendance: CalendarCheck,
  notes: NotebookPen,
  profile: User,
  payments: CreditCard,
  more: Menu,
};

export interface FloatingTabBarProps {
  state: any;
  descriptors?: any;
  navigation: any;
  insets?: any;
}

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const role = user?.role;

  // Wait until role is known before rendering tab bar to prevent flashing wrong tabs
  if (!role) {
    return null;
  }

  const currentTab = state.routes[state.index];
  const nestedState = currentTab?.state;
  const isPushed = Boolean(
    nestedState && typeof nestedState.index === 'number' && nestedState.index > 0
  );
  const focusedDescriptor = descriptors && currentTab ? descriptors[currentTab.key] : null;
  const tabBarStyle = focusedDescriptor?.options?.tabBarStyle;

  if (isPushed || tabBarStyle?.display === 'none') {
    return null;
  }

  // Get allowed tabs for this specific role in strict configured order
  const allowedTabs = getTabsForRole(role);

  return (
    <View
      style={[
        styles.wrapper,
        {
          bottom: (insets.bottom || 0) + 8,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.container}>
        {allowedTabs.map((tabConfig) => {
          const route = state.routes.find((r: any) => r.name === tabConfig.name);
          if (!route) return null;

          const descriptor = descriptors?.[route.key];
          const isFocused = currentTab?.name === tabConfig.name;
          const isCenterTab = tabConfig.isRaisedCenter || tabConfig.name === 'attendance';
          const Icon = TAB_ICONS[tabConfig.name] || Home;
          const label = descriptor?.options?.title || tabConfig.title;

          const onPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // ── Raised Center "Check-in" Button ────────────────────────
          if (isCenterTab) {
            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                activeOpacity={0.85}
                style={[styles.tabItem, styles.centerTabItem]}
                accessibilityRole="button"
                accessibilityLabel="Check-in attendance"
                accessibilityState={{ selected: isFocused }}
              >
                <View style={styles.raisedCenterBtn}>
                  <CalendarCheck
                    color="#051F20"
                    size={26}
                    strokeWidth={2.4}
                  />
                </View>
              </TouchableOpacity>
            );
          }

          // ── Regular Tab ────────────────────────────────────────────
          const badge = descriptor?.options?.tabBarBadge;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.75}
              style={styles.tabItem}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: isFocused }}
            >
              <View style={styles.iconWrap}>
                <Icon
                  color={isFocused ? '#DAF1DE' : 'rgba(218, 241, 222, 0.55)'}
                  size={22}
                  strokeWidth={isFocused ? 2.3 : 1.8}
                />
                {Boolean(badge) && (
                  <View style={styles.badgePill}>
                    <Text style={styles.badgeText}>
                      {typeof badge === 'number' && badge > 99 ? '99+' : badge}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isFocused ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
              {/* Small sage dot indicator for active tab */}
              {isFocused ? (
                <View style={styles.activeDot} />
              ) : (
                <View style={styles.dotPlaceholder} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 99,
  },
  container: {
    flexDirection: 'row',
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0B2B26', // Solid fully opaque, no transparency
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.14)',
    overflow: 'visible', // Allows raised center button to sit above edge
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
        }
      : {
          elevation: 8,
        }),
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  iconWrap: {
    marginBottom: 2,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePill: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#0B2B26',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: theme.fonts.headingBold,
    lineHeight: 11,
  },
  tabLabel: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: '#DAF1DE',
    fontFamily: theme.fonts.headingBold,
  },
  tabLabelInactive: {
    color: 'rgba(218, 241, 222, 0.55)',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8EB69B', // small sage dot indicator
    marginTop: 3,
  },
  dotPlaceholder: {
    width: 4,
    height: 4,
    marginTop: 3,
    backgroundColor: 'transparent',
  },

  // Raised Center Button (60px circle in sage #8EB69B, dark icon #051F20, 5px ring in #051F20)
  centerTabItem: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    overflow: 'visible',
  },
  raisedCenterBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#8EB69B', // Sage
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -30, // Sits about 30px above the bar edge
    borderWidth: 5,
    borderColor: '#051F20', // Screen background colour ring
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        }
      : {
          elevation: 6,
        }),
  },
});
