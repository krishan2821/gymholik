import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  useReducedMotion,
} from 'react-native-reanimated';
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
import { tabBarTokens } from '../theme/tokens';

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

interface RegularTabItemProps {
  route: any;
  tabConfig: any;
  descriptor: any;
  isFocused: boolean;
  onPress: () => void;
  colors: any;
  fonts: any;
  styles: any;
  isAndroid: boolean;
  reducedMotion: boolean;
}

const RegularTabItem: React.FC<RegularTabItemProps> = ({
  route,
  tabConfig,
  descriptor,
  isFocused,
  onPress,
  colors,
  fonts,
  styles,
  isAndroid,
  reducedMotion,
}) => {
  const Icon = TAB_ICONS[tabConfig.name] || Home;
  const label = descriptor?.options?.title || tabConfig.title;
  const badge = descriptor?.options?.tabBarBadge;

  const iconScale = useSharedValue(1);
  const iconTranslateY = useSharedValue(0);

  useEffect(() => {
    if (isFocused && !reducedMotion) {
      iconScale.value = withSequence(
        withSpring(1.15, { damping: 12, stiffness: 300 }),
        withSpring(1.0, { damping: 14, stiffness: 250 })
      );
      iconTranslateY.value = withSequence(
        withTiming(-2, { duration: 100 }),
        withSpring(0, { damping: 14, stiffness: 250 })
      );
    } else {
      iconScale.value = 1.0;
      iconTranslateY.value = 0;
    }
  }, [isFocused, reducedMotion, iconScale, iconTranslateY]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: iconScale.value },
      { translateY: iconTranslateY.value },
    ],
  }));

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable
      key={route.key}
      onPress={handlePress}
      android_ripple={
        isAndroid
          ? {
              borderless: true,
              radius: tabBarTokens.androidRippleRadius,
              color: colors.primarySoft,
            }
          : undefined
      }
      style={styles.tabItem}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      {...({
        dataSet: { tabItem: 'regular' },
      } as any)}
    >
      <Animated.View style={[styles.iconWrap, iconAnimatedStyle]}>
        <Icon
          color={isFocused ? colors.text : colors.textSecondary}
          size={22}
          strokeWidth={isFocused ? 2.4 : 1.8}
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
      </Animated.View>
      <Text
        style={[
          styles.tabLabel,
          {
            fontFamily: isFocused ? fonts.headingBold : fonts.headingMedium,
            color: isFocused ? colors.text : colors.textSecondary,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
};

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
  const { colors, fonts, layout, isDark } = useTheme();
  const styles = useStyles(makeStyles);
  const sysReducedMotion = usePrefersReducedMotion();
  const reanimatedReducedMotion = useReducedMotion();
  const reducedMotion = sysReducedMotion || reanimatedReducedMotion;
  const reducedTransparency = usePrefersReducedTransparency();
  const { width: windowWidth } = useWindowDimensions();

  // Width tracking for exact responsive slot alignment
  const initialBarWidth =
    Math.min(windowWidth, layout.maxWidth.column) - tabBarTokens.sideMargin * 2;
  const [barWidth, setBarWidth] = useState(initialBarWidth);

  // Platform capabilities
  const isGlass = canUseGlass({ platformOverride, reduceTransparency: reducedTransparency });
  const isAndroid = platformOverride ? platformOverride === 'android' : Platform.OS === 'android';
  const isIOS26 = isGlass;

  // Role tab limits
  const maxTabs = role === 'TRAINER' ? 4 : 5;
  const allowedTabs = role ? getTabsForRole(role).slice(0, maxTabs) : [];

  const currentTab = state?.routes ? state.routes[state.index] : null;
  const nestedState = currentTab?.state;
  const isPushed = Boolean(
    nestedState && typeof nestedState.index === 'number' && nestedState.index > 0
  );
  const focusedDescriptor = descriptors && currentTab ? descriptors[currentTab.key] : null;
  const tabBarStyle = focusedDescriptor?.options?.tabBarStyle;

  // Active slot index
  const activeTabIndex = Math.max(
    0,
    allowedTabs.findIndex((t) => t.name === currentTab?.name)
  );

  const numTabs = Math.max(1, allowedTabs.length);
  const slotWidth = barWidth / numTabs;
  const activePillWidth = Math.max(20, slotWidth - tabBarTokens.activePillMarginHorizontal * 2);

  // 1. Sliding pill shared value & animation
  const initialPillX = activeTabIndex * slotWidth + tabBarTokens.activePillMarginHorizontal;
  const pillTranslateX = useSharedValue(initialPillX);

  useEffect(() => {
    const targetX = activeTabIndex * slotWidth + tabBarTokens.activePillMarginHorizontal;
    if (reducedMotion) {
      pillTranslateX.value = targetX;
    } else {
      pillTranslateX.value = withSpring(targetX, tabBarTokens.springConfig);
    }
  }, [activeTabIndex, slotWidth, reducedMotion, pillTranslateX]);

  const pillAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillTranslateX.value }],
  }));

  // 2. Bar entrance on first mount
  const entranceY = useSharedValue(reducedMotion ? 0 : tabBarTokens.entranceTranslateY);
  const entranceOpacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      entranceY.value = 0;
      entranceOpacity.value = 1;
    } else {
      entranceY.value = withSpring(0, tabBarTokens.springConfig);
      entranceOpacity.value = withTiming(1, { duration: tabBarTokens.entranceDurationMs });
    }
  }, [reducedMotion, entranceY, entranceOpacity]);

  const barEntranceAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: entranceY.value }],
    opacity: entranceOpacity.value,
  }));

  // 3. Centre button press scale & ripple animation
  const centerScale = useSharedValue(1);
  const rippleScale = useSharedValue(1);
  const rippleOpacity = useSharedValue(0);

  const centerButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: centerScale.value }],
  }));

  const rippleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  if (isDesktop && !platformOverride) return null;
  if (!role || allowedTabs.length === 0) return null;
  if (isPushed || tabBarStyle?.display === 'none') return null;

  const centerTabConfig = allowedTabs.find((t) => t.isRaisedCenter || t.name === 'attendance');
  const centerIndex = centerTabConfig
    ? allowedTabs.findIndex((t) => t.name === centerTabConfig.name)
    : 2;
  const centerRoute = centerTabConfig
    ? state.routes.find((r: any) => r.name === centerTabConfig.name)
    : null;
  const isCenterFocused = currentTab?.name === centerTabConfig?.name;

  const triggerRipple = () => {
    if (reducedMotion) return;
    rippleScale.value = 1;
    rippleOpacity.value = tabBarTokens.rippleInitialOpacity;
    rippleScale.value = withTiming(tabBarTokens.rippleMaxScale, {
      duration: tabBarTokens.rippleDurationMs,
    });
    rippleOpacity.value = withTiming(0, {
      duration: tabBarTokens.rippleDurationMs,
    });
  };

  const onCenterPressIn = () => {
    if (!reducedMotion) {
      centerScale.value = withSpring(tabBarTokens.pressInScale, { damping: 14, stiffness: 300 });
    }
  };

  const onCenterPressOut = () => {
    if (!reducedMotion) {
      centerScale.value = withSpring(1.0, { damping: 14, stiffness: 250 });
    }
  };

  const onCenterPress = () => {
    if (!centerRoute) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    triggerRipple();
    const event = navigation.emit({
      type: 'tabPress',
      target: centerRoute.key,
      canPreventDefault: true,
    });
    if (!isCenterFocused && !event.defaultPrevented) {
      navigation.navigate(centerRoute.name);
    }
  };

  // Center button horizontal placement precisely over center slot
  const centerButtonLeft =
    centerIndex * slotWidth + (slotWidth - tabBarTokens.centerCircleTotalDiameter) / 2;

  // Active tint for glass pill on iOS 26
  const activeTint = isDark ? 'dark' : 'light';

  return (
    <View
      style={[
        styles.wrapper,
        {
          bottom: (insets.bottom || 0) + tabBarTokens.bottomOffsetExtra,
        },
      ]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          styles.columnWrapper,
          { maxWidth: layout.maxWidth.column },
          barEntranceAnimatedStyle,
        ]}
        pointerEvents="box-none"
      >
        <View
          style={styles.barContainer}
          pointerEvents="box-none"
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - barWidth) > 1) {
              setBarWidth(w);
            }
          }}
        >
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
                tint={activeTint}
                style={StyleSheet.absoluteFill}
              />
            )}
          </View>

          {/* 2. Sliding Active Pill Indicator */}
          <Animated.View
            style={[
              styles.slidingPill,
              {
                width: activePillWidth,
                height: tabBarTokens.activePillHeight,
                borderRadius: tabBarTokens.activePillRadius,
                backgroundColor: colors.primarySoft,
              },
              pillAnimatedStyle,
            ]}
            pointerEvents="none"
          >
            {isIOS26 && (
              <BlurView
                intensity={25}
                tint={activeTint}
                style={StyleSheet.absoluteFill}
              />
            )}
          </Animated.View>

          {/* 3. Tabs Row (Regular tabs + center slot label on same baseline) */}
          <View style={styles.tabsRow} pointerEvents="box-none">
            {allowedTabs.map((tabConfig) => {
              const route = state.routes.find((r: any) => r.name === tabConfig.name);
              if (!route) return null;

              const descriptor = descriptors?.[route.key];
              const isFocused = currentTab?.name === tabConfig.name;
              const isCenterTab = tabConfig.isRaisedCenter || tabConfig.name === 'attendance';
              const label = descriptor?.options?.title || tabConfig.title;

              if (isCenterTab) {
                return (
                  <Pressable
                    key={route.key}
                    onPress={onCenterPress}
                    style={styles.tabItem}
                    accessibilityRole="tab"
                    accessibilityLabel="Check-in"
                    accessibilityState={{ selected: isCenterFocused }}
                    {...({
                      dataSet: { tabItem: 'center-slot' },
                    } as any)}
                  >
                    {/* Top gap where the protruding circle sits */}
                    <View style={styles.centerSlotTopSpace} pointerEvents="none" />
                    {/* Check-in label on the exact same baseline as regular tabs */}
                    <Text
                      style={[
                        styles.tabLabel,
                        {
                          fontFamily: isCenterFocused ? fonts.headingBold : fonts.headingMedium,
                          color: isCenterFocused ? colors.primary : colors.textSecondary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              }

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return (
                <RegularTabItem
                  key={route.key}
                  route={route}
                  tabConfig={tabConfig}
                  descriptor={descriptor}
                  isFocused={isFocused}
                  onPress={onPress}
                  colors={colors}
                  fonts={fonts}
                  styles={styles}
                  isAndroid={isAndroid}
                  reducedMotion={reducedMotion}
                />
              );
            })}
          </View>

          {/* 4. Raised Centre Check-in Button as a Sibling (Never clipped by capsule) */}
          {Boolean(centerRoute) && (
            <View
              style={[
                styles.centerButtonWrapper,
                {
                  left: centerButtonLeft,
                },
              ]}
              pointerEvents="box-none"
            >
              {/* Ripple Ring Animation */}
              <Animated.View
                style={[
                  styles.rippleRing,
                  {
                    borderColor: colors.primary,
                  },
                  rippleAnimatedStyle,
                ]}
                pointerEvents="none"
              />

              {/* Centre Circle Button (52pt filled, 4pt ring, 60pt total) */}
              <Animated.View style={centerButtonAnimatedStyle}>
                <Pressable
                  onPressIn={onCenterPressIn}
                  onPressOut={onCenterPressOut}
                  onPress={onCenterPress}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[
                    styles.raisedCenterBtn,
                    {
                      borderColor: isCenterFocused ? colors.primary : colors.bg,
                      backgroundColor: isIOS26 ? colors.glassTint : colors.primary,
                      shadowColor: colors.shadow,
                    },
                    isAndroid && { elevation: 12 },
                  ]}
                  accessibilityRole="tab"
                  accessibilityLabel="Check-in"
                  accessibilityState={{ selected: isCenterFocused }}
                  {...({
                    dataSet: { tabItem: 'center-button' },
                  } as any)}
                >
                  {isIOS26 && (
                    <BlurView
                      intensity={40}
                      tint={activeTint}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <CalendarCheck
                    color={isIOS26 ? colors.primary : colors.textOnPrimary}
                    size={24}
                    strokeWidth={isCenterFocused ? 2.4 : 2.0}
                  />
                </Pressable>
              </Animated.View>
            </View>
          )}
        </View>
      </Animated.View>
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
      overflow: 'visible',
    },
    columnWrapper: {
      width: '100%',
      paddingHorizontal: tabBarTokens.sideMargin,
      alignItems: 'center',
      overflow: 'visible',
    },
    barContainer: {
      width: '100%',
      height: tabBarTokens.height,
      position: 'relative',
      overflow: 'visible',
    },
    capsuleBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      height: tabBarTokens.height,
      borderRadius: tabBarTokens.radius,
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
    slidingPill: {
      position: 'absolute',
      top: (tabBarTokens.height - tabBarTokens.activePillHeight) / 2, // 10pt from top
      height: tabBarTokens.activePillHeight,
      borderRadius: tabBarTokens.activePillRadius,
      overflow: 'hidden',
      zIndex: 1,
    },
    tabsRow: {
      flexDirection: 'row',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      zIndex: 2,
      overflow: 'visible',
    },
    tabItem: {
      flex: 1,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 4,
      paddingBottom: 6,
      borderRadius: 24,
      backgroundColor: 'transparent',
      minHeight: 44,
      overflow: 'visible',
    },
    iconWrap: {
      marginBottom: 3,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 44,
      height: 26,
    },
    tabLabel: {
      fontSize: tabBarTokens.labelFontSize,
      lineHeight: tabBarTokens.labelLineHeight,
      letterSpacing: 0.15,
      textAlign: 'center',
    },
    centerSlotTopSpace: {
      width: 44,
      height: 26,
      marginBottom: 3,
      backgroundColor: 'transparent',
    },
    badgePill: {
      position: 'absolute',
      top: -4,
      right: 2,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
      borderWidth: 1.5,
      zIndex: 3,
    },
    badgeText: {
      color: theme.colors.textOnPrimary,
      fontSize: 9,
      lineHeight: 11,
    },
    centerButtonWrapper: {
      position: 'absolute',
      top: tabBarTokens.centerCircleTop, // -16
      width: tabBarTokens.centerCircleTotalDiameter, // 60
      height: tabBarTokens.centerCircleTotalDiameter, // 60
      zIndex: 101,
      elevation: 12,
      overflow: 'visible',
      alignItems: 'center',
      justifyContent: 'center',
    },
    raisedCenterBtn: {
      width: tabBarTokens.centerCircleTotalDiameter, // 60
      height: tabBarTokens.centerCircleTotalDiameter, // 60
      borderRadius: tabBarTokens.centerCircleTotalDiameter / 2, // 30
      borderWidth: tabBarTokens.centerCircleRingWidth, // 4
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
            elevation: 12,
          }),
    },
    rippleRing: {
      position: 'absolute',
      width: tabBarTokens.centerCircleTotalDiameter,
      height: tabBarTokens.centerCircleTotalDiameter,
      borderRadius: tabBarTokens.centerCircleTotalDiameter / 2,
      borderWidth: 2,
    },
  });

export default FloatingTabBar;
