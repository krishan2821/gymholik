import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import * as Haptics from '../utils/safeHaptics';
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
import { useTheme, useStyles, ThemeValue } from '../theme/ThemeContext';
import { useAuthStore } from '../store/useAuthStore';
import { getTabsForRole } from '../navigation/tabsByRole';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { usePrefersReducedTransparency } from '../hooks/usePrefersReducedTransparency';
import { canUseGlass } from '../utils/platformCapabilities';
import { BlurView } from 'expo-blur';

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
  platformOverride?: 'ios26' | 'ios' | 'android' | 'web';
  roleOverride?: 'OWNER' | 'STAFF' | 'TRAINER';
}

export const FloatingTabBar: React.FC<FloatingTabBarProps> = ({
  state,
  descriptors,
  navigation,
  platformOverride,
  roleOverride,
}) => {
  const { isDesktop } = useBreakpoint();
  const rawInsets = useSafeAreaInsets();
  const insets = Platform.OS === 'web' ? { top: 0, right: 0, bottom: 0, left: 0 } : rawInsets;
  const user = useAuthStore((s) => s.user);
  const role = roleOverride || user?.role;
  const { colors, fonts, layout } = useTheme();
  const styles = useStyles(makeStyles);
  const prefersReducedMotion = usePrefersReducedMotion();
  const reducedTransparency = usePrefersReducedTransparency();

  if (isDesktop && !platformOverride) return null;
  if (!role) return null;

  const currentTab = state.routes[state.index];
  const nestedState = currentTab?.state;
  const isPushed = Boolean(
    nestedState && typeof nestedState.index === 'number' && nestedState.index > 0
  );
  const focusedDescriptor = descriptors && currentTab ? descriptors[currentTab.key] : null;
  const tabBarStyle = focusedDescriptor?.options?.tabBarStyle;

  if (isPushed || tabBarStyle?.display === 'none') return null;

  // Enforce item limits: at most 5 items for Owner and Staff, 4 for Trainer
  const maxTabs = role === 'TRAINER' ? 4 : 5;
  const allowedTabs = getTabsForRole(role).slice(0, maxTabs);

  // Platform determinations
  const isGlass = canUseGlass({ platformOverride, reduceTransparency: reducedTransparency });
  const isAndroid = platformOverride ? platformOverride === 'android' : Platform.OS === 'android';
  const isIOS26 = isGlass;

  const centerTabConfig = allowedTabs.find((t) => t.isRaisedCenter || t.name === 'attendance');
  const centerRoute = centerTabConfig ? state.routes.find((r: any) => r.name === centerTabConfig.name) : null;
  const isCenterFocused = currentTab?.name === centerTabConfig?.name;

  const onCenterPress = () => {
    if (!centerRoute) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const event = navigation.emit({
      type: 'tabPress',
      target: centerRoute.key,
      canPreventDefault: true,
    });
    if (!isCenterFocused && !event.defaultPrevented) {
      navigation.navigate(centerRoute.name);
    }
  };

  const renderContent = () => (
    <View style={styles.tabsRow}>
      {allowedTabs.map((tabConfig) => {
        const route = state.routes.find((r: any) => r.name === tabConfig.name);
        if (!route) return null;

        const descriptor = descriptors?.[route.key];
        const isFocused = currentTab?.name === tabConfig.name;
        const isCenterTab = tabConfig.isRaisedCenter || tabConfig.name === 'attendance';
        const Icon = TAB_ICONS[tabConfig.name] || Home;
        const label = descriptor?.options?.title || tabConfig.title;

        // Center tab placeholder in the row keeps the 5-item grid balanced
        if (isCenterTab) {
          return (
            <View
              key={route.key}
              style={[styles.tabItem, styles.centerPlaceholder]}
              pointerEvents="none"
            />
          );
        }

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

        const badge = descriptor?.options?.tabBarBadge;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            activeOpacity={0.75}
            style={[styles.tabItem]}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: isFocused }}
            {...({
              dataSet: { tabItem: 'regular' },
            } as any)}
          >
            <View style={styles.iconWrap}>
              {/* Android Material style: pill-shaped active indicator behind the icon */}
              {isAndroid && isFocused && (
                <View
                  style={[
                    styles.androidActivePill,
                    { backgroundColor: colors.primarySoft },
                  ]}
                />
              )}

              <Icon
                color={
                  isAndroid && isFocused
                    ? colors.primary
                    : isFocused
                    ? colors.text
                    : colors.textSecondary
                }
                size={22}
                strokeWidth={isFocused ? 2.3 : 1.8}
              />
              {Boolean(badge) && (
                <View
                  style={[
                    styles.badgePill,
                    { backgroundColor: colors.danger, borderColor: colors.surface },
                  ]}
                >
                  <Text style={[styles.badgeText, { fontFamily: fonts.headingBold }]}>
                    {typeof badge === 'number' && badge > 99 ? '99+' : badge}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                {
                  fontFamily: isFocused ? fonts.headingBold : fonts.headingMedium,
                  fontSize: 11,
                  letterSpacing: 0.2,
                  color:
                    isAndroid && isFocused
                      ? colors.primary
                      : isFocused
                      ? colors.text
                      : colors.textSecondary,
                },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>

            {/* iOS active indicator dot */}
            {!isAndroid && (
              isFocused ? (
                <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
              ) : (
                <View style={styles.dotPlaceholder} />
              )
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View
      style={[
        styles.wrapper,
        {
          bottom: (insets.bottom || 0) + 8,
          pointerEvents: 'box-none',
        },
      ]}
    >
      <View style={[styles.columnWrapper, { maxWidth: layout.maxWidth.column }]}>
        <View style={styles.barContainer}>
          {/* 1. Clipped Glass / Solid Capsule Background */}
          <View
            style={[
              styles.capsuleBackground,
              isIOS26
                ? {
                    backgroundColor: colors.glassTint,
                    borderColor: colors.glassBorder,
                    shadowColor: colors.shadow,
                  }
                : {
                    backgroundColor: isAndroid ? colors.surfaceRaised : colors.surface,
                    borderColor: colors.border,
                    shadowColor: colors.shadow,
                  },
              isAndroid && { elevation: 8 },
            ]}
          >
            {isIOS26 && (
              <BlurView
                intensity={45}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
            )}
          </View>

          {/* 2. Tabs Row (Regular tabs + center placeholder) */}
          {renderContent()}

          {/* 3. Raised Centre Check-in Button as a Sibling (Never clipped by capsule) */}
          {Boolean(centerRoute) && (
            <View style={styles.centerButtonWrapper} pointerEvents="box-none">
              <TouchableOpacity
                onPress={onCenterPress}
                activeOpacity={0.85}
                style={[
                  styles.raisedCenterBtn,
                  isIOS26
                    ? {
                        backgroundColor: colors.glassTint,
                        borderColor: colors.bg,
                        borderWidth: 5,
                        shadowColor: colors.shadow,
                      }
                    : {
                        backgroundColor: colors.primary,
                        borderColor: colors.bg,
                        borderWidth: 5,
                        shadowColor: colors.shadow,
                      },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Check-in"
                aria-label="Check-in"
                accessibilityState={{ selected: isCenterFocused }}
                {...({
                  dataSet: { tabItem: 'center' },
                  title: 'Check-in',
                } as any)}
              >
                {isIOS26 && (
                  <BlurView
                    intensity={40}
                    tint="dark"
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <CalendarCheck
                  color={isIOS26 ? colors.primary : colors.textOnPrimary}
                  size={26}
                  strokeWidth={2.4}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99,
  },
  columnWrapper: {
    width: '100%',
    paddingHorizontal: 16,
    alignItems: 'center',
    overflow: 'visible',
  },
  barContainer: {
    width: '100%',
    height: 64,
    position: 'relative',
    overflow: 'visible',
  },
  capsuleBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    overflow: 'hidden',
    ...(Platform.OS === 'ios'
      ? {
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.28,
          shadowRadius: 14,
        }
      : {
          elevation: 8,
        }),
  },
  container: {
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
    ...(Platform.OS === 'ios'
      ? {
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.28,
          shadowRadius: 14,
        }
      : {
          elevation: 8,
        }),
  },
  tabsRow: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  iconWrap: {
    marginBottom: 2,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    height: 30,
  },
  androidActivePill: {
    position: 'absolute',
    width: 52,
    height: 28,
    borderRadius: 14,
    zIndex: 0,
  },
  badgePill: {
    position: 'absolute',
    top: -4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    zIndex: 2,
  },
  badgeText: {
    color: theme.colors.textOnPrimary,
    fontSize: 9,
    lineHeight: 11,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  dotPlaceholder: {
    width: 4,
    height: 4,
    marginTop: 3,
    backgroundColor: 'transparent',
  },
  centerPlaceholder: {
    flex: 1,
    height: '100%',
    backgroundColor: 'transparent',
  },
  centerButtonWrapper: {
    position: 'absolute',
    top: -28,
    left: '50%',
    marginLeft: -30,
    width: 60,
    height: 60,
    zIndex: 101,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...(Platform.OS === 'ios'
      ? {
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
        }
      : {
          elevation: 10,
        }),
  },
});

export default FloatingTabBar;
