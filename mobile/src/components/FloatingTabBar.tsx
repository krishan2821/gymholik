import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Dimensions,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TAB_ICONS: Record<string, React.ComponentType<any>> = {
  index: Home,
  members: Users,
  attendance: CalendarCheck,
  notes: NotebookPen,
  profile: User,
  payments: CreditCard,
  more: Menu,
};

const TAB_LABELS: Record<string, string> = {
  index: 'Home',
  members: 'Members',
  attendance: 'Check-in',
  notes: 'Notes',
  profile: 'Profile',
  payments: 'Payments',
  more: 'More',
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
  const allowedTabs = getTabsForRole(role);
  const allowedNames = allowedTabs.map((t) => t.name);

  // Render ONLY tabs allowed for the current role
  const visibleRoutes = state.routes
    .filter((route: any) => {
      const descriptor = descriptors?.[route.key];
      const isHrefAllowed = descriptor?.options?.href !== null;
      const isRoleAllowed = allowedNames.length === 0 || allowedNames.includes(route.name);
      return isHrefAllowed && isRoleAllowed;
    })
    .sort((a: any, b: any) => {
      return allowedNames.indexOf(a.name) - allowedNames.indexOf(b.name);
    });
  const numTabs = visibleRoutes.length;

  // Find index of currently focused route within visible tabs
  const activeRoute = state.routes[state.index];
  const activeVisibleIndex = Math.max(
    0,
    visibleRoutes.findIndex((r: any) => r.key === activeRoute?.key)
  );

  // Horizontal position of sliding indicator
  const indicatorX = useRef(new Animated.Value(0)).current;

  // Calculate container width & tab width
  const containerMargin = 16;
  const containerWidth = SCREEN_WIDTH - containerMargin * 2;
  const tabWidth = containerWidth / (numTabs || 1);

  // Icon scale animation map
  const scaleAnims = useRef(visibleRoutes.map(() => new Animated.Value(1))).current;
  const indicatorOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const isCenter = visibleRoutes[activeVisibleIndex]?.name === 'attendance';
    Animated.timing(indicatorOpacity, {
      toValue: isCenter ? 0 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    Animated.spring(indicatorX, {
      toValue: activeVisibleIndex * tabWidth,
      useNativeDriver: true,
      tension: 68,
      friction: 10,
    }).start();

    // Scale up selected icon
    if (scaleAnims[activeVisibleIndex]) {
      Animated.sequence([
        Animated.timing(scaleAnims[activeVisibleIndex], {
          toValue: 1.2,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnims[activeVisibleIndex], {
          toValue: 1.05,
          tension: 80,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [activeVisibleIndex, tabWidth, indicatorOpacity]);

  const currentTab = state.routes[state.index];
  const nestedState = currentTab?.state;
  const isPushed = Boolean(nestedState && typeof nestedState.index === 'number' && nestedState.index > 0);
  const focusedDescriptor = descriptors && currentTab ? descriptors[currentTab.key] : null;
  const tabBarStyle = focusedDescriptor?.options?.tabBarStyle;

  if (isPushed || tabBarStyle?.display === 'none') {
    return null;
  }

  return (
    <View
      style={[
        styles.wrapper,
        {
          bottom: Platform.OS === 'ios' ? (insets.bottom > 0 ? insets.bottom + 4 : 20) : 16,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.container}>
        {/* Sliding Sage Indicator (behind regular tabs) */}
        <Animated.View
          style={[
            styles.indicator,
            {
              width: tabWidth,
              opacity: indicatorOpacity,
              transform: [{ translateX: indicatorX }],
            },
          ]}
        >
          <View style={styles.indicatorPill} />
        </Animated.View>

        {/* Tab Items */}
        {visibleRoutes.map((route: any, index: number) => {
          const isFocused = activeVisibleIndex === index;
          const isCenterTab = route.name === 'attendance';
          const Icon = TAB_ICONS[route.name] || Home;
          const descriptor = descriptors?.[route.key];
          const label = descriptor?.options?.title || TAB_LABELS[route.name] || route.name;

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
                <View style={[styles.raisedCenterBtn, isFocused && styles.raisedCenterBtnActive]}>
                  <CalendarCheck
                    color={theme.colors.textOnPrimary}
                    size={26}
                    strokeWidth={2.3}
                  />
                </View>
                <Text
                  style={[
                    styles.centerLabel,
                    isFocused && styles.centerLabelActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          }

          // ── Regular Tab ────────────────────────────────────────────
          const badge = descriptor?.options?.tabBarBadge;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.8}
              style={styles.tabItem}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: isFocused }}
            >
              <Animated.View
                style={[
                  styles.iconWrap,
                  {
                    transform: [{ scale: scaleAnims[index] || 1 }],
                  },
                ]}
              >
                <Icon
                  color={isFocused ? theme.colors.primary : theme.colors.textMuted}
                  size={21}
                  strokeWidth={isFocused ? 2.3 : 1.8}
                />
                {Boolean(badge) && (
                  <View style={styles.badgePill}>
                    <Text style={styles.badgeText}>
                      {typeof badge === 'number' && badge > 99 ? '99+' : badge}
                    </Text>
                  </View>
                )}
              </Animated.View>
              <Text
                style={[
                  styles.tabLabel,
                  isFocused && styles.tabLabelActive,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
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
    backgroundColor: '#0B2B26',
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.12)',
    // overflow must be visible so the raised center button can protrude above the bar
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
        }
      : {
          elevation: 10,
        }),
  },
  indicator: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  indicatorPill: {
    width: '78%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: 'rgba(142, 182, 155, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(142, 182, 155, 0.30)',
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    paddingTop: 4,
  },
  iconWrap: {
    marginBottom: 3,
    position: 'relative',
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
    borderColor: 'rgba(11, 43, 38, 0.95)',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: theme.fonts.headingBold,
    lineHeight: 11,
  },
  tabLabel: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 10,
    color: theme.colors.textMuted,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: theme.colors.text,
    fontFamily: theme.fonts.headingBold,
  },

  // Raised Center Button
  centerTabItem: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    // Give extra room for the button that lifts above the bar
    overflow: 'visible',
  },
  raisedCenterBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    marginTop: -18,
    borderWidth: 3,
    borderColor: '#0B2B26',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: theme.colors.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.55,
          shadowRadius: 14,
        }
      : {
          elevation: 10,
        }),
  },
  raisedCenterBtnActive: {
    backgroundColor: theme.colors.primaryLight,
  },
  centerLabel: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 9.5,
    color: theme.colors.textMuted,
    letterSpacing: 0.2,
  },
  centerLabelActive: {
    color: theme.colors.primary,
  },
});
