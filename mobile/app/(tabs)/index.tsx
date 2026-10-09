import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  Animated,
  AccessibilityInfo,
  Linking,
  Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import {
  Users,
  CalendarCheck,
  UserPlus,
  AlertTriangle,
  Wallet,
  CreditCard,
  QrCode,
  Phone,
  MessageCircle,
  Bell,
  ChevronRight,
  Sparkles,
  Check,
  TrendingUp,
  Clock,
  ArrowUpRight,
} from 'lucide-react-native';

import { useAuthStore } from '../../src/store/useAuthStore';
import { useCurrentUser } from '../../src/api/auth';
import { useDashboardData, DailyCollection, ExpiringMember } from '../../src/api/dashboard';
import { useGymSettings } from '../../src/api/more';
import { theme } from '../../src/theme/theme';
import { Screen } from '../../src/components/Screen';
import { GlassCard } from '../../src/components/GlassCard';
import { Avatar } from '../../src/components/Avatar';
import { Button } from '../../src/components/Button';
import { Skeleton } from '../../src/components/Skeleton';
import { ErrorState } from '../../src/components/ErrorState';
import { isPhoneMasked } from '../../src/components/MaskedPhone';
import { DASHBOARD } from '../../src/constants/strings';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Count-Up Number Component ───────────────────────────────────────────────
function CountUpNumber({
  value,
  prefix = '',
  suffix = '',
  style,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  style?: any;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (end === 0) {
      setDisplayValue(0);
      return;
    }
    const duration = 650;
    const stepTime = 25;
    const steps = Math.max(1, Math.floor(duration / stepTime));
    const increment = end / steps;

    const timer = setInterval(() => {
      start += increment;
      if ((increment > 0 && start >= end) || (increment < 0 && start <= end)) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <Text style={style}>
      {prefix}
      {displayValue.toLocaleString('en-IN')}
      {suffix}
    </Text>
  );
}

// ─── Pressable with Scale Animation & Haptics ───────────────────────────────
function PressableScale({
  onPress,
  children,
  style,
  scaleTo = 0.96,
  accessibilityLabel,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: any;
  scaleTo?: number;
  accessibilityLabel?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      <Animated.View style={{ width: '100%', transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ─── 7-Day Trend in Sage Bars ─────────────────────────────────────────────────
function TrendBars7Days({
  data,
}: {
  data?: DailyCollection[];
}) {
  const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Always generate 7 days up to today
  const today = new Date();
  const daysList: { dayLabel: string; amount: number; isToday: boolean }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const match = data?.find((p) => p.date === dateStr);
    const amount = match ? match.amountPaise / 100 : 0;
    daysList.push({
      dayLabel: DAY_LABELS[d.getDay()],
      amount,
      isToday: i === 0,
    });
  }

  const amounts = daysList.map((d) => d.amount);
  const allZero = amounts.every((a) => a === 0);
  const maxVal = allZero ? 1 : Math.max(...amounts, 1);
  const TRACK_HEIGHT = 44;
  const BASELINE_HEIGHT = 4;

  return (
    <View style={styles.trendContainer}>
      <View style={styles.trendBarsRow}>
        {daysList.map((item, idx) => {
          const barHeight = allZero
            ? BASELINE_HEIGHT
            : item.amount === 0
            ? BASELINE_HEIGHT
            : Math.max(BASELINE_HEIGHT, Math.round((item.amount / maxVal) * TRACK_HEIGHT));

          const barColor = allZero
            ? 'rgba(142, 182, 155, 0.22)'
            : item.amount === 0
            ? 'rgba(142, 182, 155, 0.22)'
            : item.isToday
            ? theme.colors.primary
            : 'rgba(142, 182, 155, 0.85)';

          return (
            <View key={idx} style={styles.trendCol}>
              <View style={styles.trendBarTrack}>
                <View
                  style={[
                    styles.trendBarFill,
                    {
                      height: barHeight,
                      backgroundColor: barColor,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.trendDayText,
                  item.isToday && styles.trendDayTextToday,
                ]}
              >
                {item.dayLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Circular Progress Ring ──────────────────────────────────────────────────
function CircularProgressRing({
  progress,
  size = 38,
  strokeWidth = 3.5,
  color = theme.colors.primary,
}: {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const strokeDashoffset = circumference - clamped * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(218, 241, 222, 0.12)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <CalendarCheck color={color} size={16} />
        </View>
      </View>
    </View>
  );
}

// ─── Pulsing Amber Dot Indicator ─────────────────────────────────────────────
function PulsingDot() {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.15,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.7,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim, opacityAnim]);

  return (
    <View style={styles.pulsingWrapper}>
      <Animated.View
        style={[
          styles.pulsingOuter,
          {
            transform: [{ scale: pulseAnim }],
            opacity: opacityAnim,
          },
        ]}
      />
      <View style={styles.pulsingInner} />
    </View>
  );
}

// ─── Main Dashboard Screen ───────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const role = user?.role || useAuthStore((state) => state.role);
  const { isAuthenticated, gymId } = useAuthStore();
  const isOwner = role === 'OWNER';

  useEffect(() => {
    if (role === 'TRAINER') {
      router.replace('/(tabs)/members');
    }
  }, [role, router]);

  const { data, isLoading, isError, refetch, isRefetching } = useDashboardData();
  const { data: gymSettings } = useGymSettings();

  const [reduceMotion, setReduceMotion] = useState(false);

  // Staggered Entrance Animations
  const animCardHero = useRef(new Animated.Value(0)).current;
  const animActions = useRef(new Animated.Value(0)).current;
  const animGrid = useRef(new Animated.Value(0)).current;
  const animList = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      animCardHero.setValue(1);
      animActions.setValue(1);
      animGrid.setValue(1);
      animList.setValue(1);
      return;
    }

    Animated.stagger(90, [
      Animated.timing(animCardHero, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(animActions, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(animGrid, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(animList, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduceMotion]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && gymId) {
        refetch();
      }
    }, [refetch, isAuthenticated, gymId])
  );

  // Time-of-day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const { data: currentUser } = useCurrentUser();
  const displayName = currentUser?.name || gymSettings?.ownerName || (isOwner ? 'Owner' : 'Staff');
  const gymName = currentUser?.gymName || gymSettings?.gymName || 'Gymholik Fitness';

  const handleNotificationPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Toast.show({
      type: 'info',
      text1: 'Notifications',
      text2: 'You are all caught up! No pending alerts.',
    });
  };

  const handleCallMember = (phone: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsAppMember = (member: ExpiringMember) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const text = encodeURIComponent(
      `Hi ${member.memberName}, aapki gym membership ${
        member.daysLeft === 0 ? 'aaj expire ho rahi hai' : `${member.daysLeft} din mein expire ho rahi hai`
      }. Kripya renew karwayein. - ${gymName}`
    );
    Linking.openURL(`https://wa.me/91${member.phone}?text=${text}`);
  };

  if (role === 'TRAINER') {
    return null;
  }

  // ── Skeleton Loader ────────────────────────────────────────────────────────
  if (isLoading && !isRefetching) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.skeletonHeader}>
          <Skeleton width="55%" height={26} borderRadius={theme.radius.md} style={{ marginBottom: 8 }} />
          <Skeleton width="35%" height={16} borderRadius={theme.radius.sm} />
        </View>
        <View style={styles.skeletonBody}>
          <GlassCard style={styles.skeletonHeroCard}>
            <Skeleton width="40%" height={14} borderRadius={theme.radius.xs} style={{ marginBottom: 12 }} />
            <Skeleton width="70%" height={38} borderRadius={theme.radius.md} style={{ marginBottom: 16 }} />
            <Skeleton width="100%" height={50} borderRadius={theme.radius.md} />
          </GlassCard>
          <View style={styles.skeletonGrid}>
            <Skeleton width="48%" height={110} borderRadius={theme.radius.lg} />
            <Skeleton width="48%" height={110} borderRadius={theme.radius.lg} />
            <Skeleton width="48%" height={110} borderRadius={theme.radius.lg} />
            <Skeleton width="48%" height={110} borderRadius={theme.radius.lg} />
          </View>
        </View>
      </Screen>
    );
  }

  // ── Error State ────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <Screen style={styles.centered}>
        <ErrorState message={DASHBOARD.LOAD_ERROR} onRetry={() => refetch()} />
      </Screen>
    );
  }

  // Attendance ratio for progress ring
  const activeCount = data?.activeMembers || 0;
  const attendanceCount = data?.todayAttendance || 0;
  const attendanceRatio = activeCount > 0 ? attendanceCount / activeCount : 0;

  // Zero-members check
  const isZeroMembers = activeCount === 0 && (data?.newJoinings || 0) === 0;

  return (
    <Screen
      scrollable
      withHeroImage
      heroOpacity={0.80}
      contentContainerStyle={styles.scrollContent}
      refreshing={isRefetching}
      onRefresh={refetch}
    >
      {/* ── 1. Hero Header with Crop & Overlay ─────────────────────────── */}
      <View style={styles.heroHeader}>
        <View style={styles.headerMain}>
          <View style={styles.greetingRow}>
            <Text
              style={styles.greetingText}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {getGreeting()}, {displayName}
            </Text>
            <TouchableOpacity
              onPress={handleNotificationPress}
              style={styles.bellBtn}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Bell size={20} color={theme.colors.text} />
              {(data?.expiringSoon || 0) > 0 && <View style={styles.bellBadge} />}
            </TouchableOpacity>
          </View>
          <Text style={styles.gymNameText} numberOfLines={1} ellipsizeMode="tail">
            {gymName}
          </Text>
        </View>
      </View>

      {/* ── 2. Glass Hero Card Over Image Bottom Edge ─────────────────── */}
      {isOwner && (
        <Animated.View
          style={[
            styles.animatedBlock,
            {
              opacity: animCardHero,
              transform: [
                {
                  translateY: animCardHero.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <GlassCard style={styles.heroCard} intensity={35}>
            <View style={styles.heroCardTop}>
              <View>
                <Text style={styles.heroCardLabel}>TODAY'S COLLECTION</Text>
                <CountUpNumber
                  value={(data?.todayCollection || 0) / 100}
                  prefix="₹"
                  style={styles.heroCardLargeValue}
                />
              </View>

              <View style={styles.heroMonthBadge}>
                <TrendingUp size={14} color={theme.colors.primary} />
                <Text style={styles.heroMonthText}>
                  Month: ₹{(((data?.monthCollection || 0) / 100)).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            {/* 7-Day Trend */}
            <View style={styles.sparklineWrap}>
              <View style={styles.sparklineHeaderRow}>
                <Text style={styles.sparklineTitle}>Last 7 Days Trend</Text>
                <Text style={styles.sparklineSubtitle}>
                  {data?.last7DaysCollection?.every((p) => p.amountPaise === 0) ||
                  !data?.last7DaysCollection?.length
                    ? 'No collections yet this week'
                    : 'Daily revenue'}
                </Text>
              </View>
              <TrendBars7Days data={data?.last7DaysCollection} />
            </View>
          </GlassCard>
        </Animated.View>
      )}

      {/* ── 3. Quick Actions Row ───────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.quickActionsContainer,
          {
            opacity: animActions,
            transform: [
              {
                translateY: animActions.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.sectionHeader}>QUICK ACTIONS</Text>
        <View style={styles.quickActionsRow}>
          <PressableScale
            onPress={() => router.push('/(tabs)/members/add')}
            style={styles.quickActionItem}
            accessibilityLabel="Add member"
          >
            <View style={styles.quickActionCard}>
              <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.quickActionIcon}>
                <UserPlus size={20} color={theme.colors.primary} />
              </View>
              <Text style={styles.quickActionLabel} numberOfLines={1}>Add Member</Text>
            </View>
          </PressableScale>

          {isOwner && (
            <PressableScale
              onPress={() => router.push('/(tabs)/payments/collect')}
              style={styles.quickActionItem}
              accessibilityLabel="Collect payment"
            >
              <View style={styles.quickActionCard}>
                <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.quickActionIcon}>
                  <CreditCard size={20} color={theme.colors.primary} />
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>Collect Fee</Text>
              </View>
            </PressableScale>
          )}

          <PressableScale
            onPress={() => router.push('/(tabs)/payments/dues')}
            style={styles.quickActionItem}
            accessibilityLabel="View Dues"
          >
            <View style={styles.quickActionCard}>
              <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.quickActionIcon}>
                <AlertTriangle size={20} color={theme.colors.primary} />
              </View>
              <Text style={styles.quickActionLabel} numberOfLines={1}>Dues</Text>
            </View>
          </PressableScale>

          <PressableScale
            onPress={() => router.push('/(tabs)/attendance/scan')}
            style={styles.quickActionItem}
            accessibilityLabel="Scan QR code"
          >
            <View style={styles.quickActionCard}>
              <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.quickActionIcon}>
                <QrCode size={20} color={theme.colors.primary} />
              </View>
              <Text style={styles.quickActionLabel} numberOfLines={1}>Scan QR</Text>
            </View>
          </PressableScale>
        </View>
      </Animated.View>

      {/* ── 4. Stat Grid, 2 Columns, Balanced ──────────────────────────── */}
      <Animated.View
        style={[
          styles.statGridContainer,
          {
            opacity: animGrid,
            transform: [
              {
                translateY: animGrid.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.sectionHeader}>OVERVIEW</Text>
        <View style={styles.grid}>
          {/* Active Members */}
          <PressableScale
            onPress={() => router.push('/(tabs)/members')}
            style={styles.statCardWrapper}
            accessibilityLabel="Active Members"
          >
            <GlassCard style={styles.statCard} contentStyle={styles.statCardInner}>
              <View style={styles.statCardHeader}>
                <View style={[styles.statIconBox, { backgroundColor: 'rgba(142, 182, 155, 0.15)' }]}>
                  <Users size={18} color={theme.colors.primary} />
                </View>
                <ArrowUpRight size={16} color={theme.colors.textMuted} />
              </View>
              <Text style={styles.statCardLabel}>Active Members</Text>
              <CountUpNumber value={activeCount} style={styles.statCardValue} />
            </GlassCard>
          </PressableScale>

          {/* Today's Check-ins with Circular Progress Ring */}
          <PressableScale
            onPress={() => router.push('/(tabs)/attendance')}
            style={styles.statCardWrapper}
            accessibilityLabel="Check-ins today"
          >
            <GlassCard style={styles.statCard} contentStyle={styles.statCardInner}>
              <View style={styles.statCardHeader}>
                <CircularProgressRing progress={attendanceRatio} size={36} />
                <ArrowUpRight size={16} color={theme.colors.textMuted} />
              </View>
              <Text style={styles.statCardLabel}>Check-ins Today</Text>
              <CountUpNumber value={attendanceCount} style={styles.statCardValue} />
            </GlassCard>
          </PressableScale>

          {/* New This Month */}
          <PressableScale
            onPress={() => router.push('/(tabs)/members')}
            style={styles.statCardWrapper}
            accessibilityLabel="New members this month"
          >
            <GlassCard style={styles.statCard} contentStyle={styles.statCardInner}>
              <View style={styles.statCardHeader}>
                <View style={[styles.statIconBox, { backgroundColor: 'rgba(142, 182, 155, 0.15)' }]}>
                  <TrendingUp size={18} color={theme.colors.primary} />
                </View>
                <ArrowUpRight size={16} color={theme.colors.textMuted} />
              </View>
              <Text style={styles.statCardLabel}>New This Month</Text>
              <CountUpNumber value={data?.newJoinings || 0} style={styles.statCardValue} />
            </GlassCard>
          </PressableScale>

          {/* Expiring in 5 Days (Amber with Pulsing Dot) */}
          <PressableScale
            onPress={() => router.push('/(tabs)/members')}
            style={styles.statCardWrapper}
            accessibilityLabel="Expiring in 5 days"
          >
            <GlassCard
              style={[
                styles.statCard,
                (data?.expiringSoon || 0) > 0 && styles.statCardExpiringBorder,
              ]}
              contentStyle={styles.statCardInner}
            >
              <View style={styles.statCardHeader}>
                <View style={[styles.statIconBox, { backgroundColor: 'rgba(245, 181, 68, 0.18)' }]}>
                  <Clock size={18} color={theme.colors.warning} />
                </View>
                {(data?.expiringSoon || 0) > 0 ? (
                  <PulsingDot />
                ) : (
                  <ArrowUpRight size={16} color={theme.colors.textMuted} />
                )}
              </View>
              <Text style={styles.statCardLabel}>Expiring in 5 Days</Text>
              <CountUpNumber
                value={data?.expiringSoon || 0}
                style={[
                  styles.statCardValue,
                  (data?.expiringSoon || 0) > 0 && { color: theme.colors.warning },
                ]}
              />
            </GlassCard>
          </PressableScale>

          {/* Total Outstanding / Dues (Owner only, Coral) */}
          {isOwner && (
            <PressableScale
              onPress={() => router.push('/(tabs)/payments/dues')}
              style={styles.statCardFullWidth}
              accessibilityLabel="Total outstanding dues"
            >
              <GlassCard
                style={[styles.statCard, styles.statCardDueBorder]}
                contentStyle={styles.statCardDueInner}
              >
                <View style={styles.statDueLeft}>
                  <View style={[styles.statIconBox, { backgroundColor: 'rgba(255, 107, 107, 0.18)' }]}>
                    <Wallet size={18} color={theme.colors.error} />
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.statCardLabel}>Total Outstanding</Text>
                    <CountUpNumber
                      value={(data?.totalDue || 0) / 100}
                      prefix="₹"
                      style={[styles.statCardValue, { color: theme.colors.error }]}
                    />
                  </View>
                </View>
                <View style={styles.statDueRight}>
                  <Text style={styles.statDueActionText}>View Dues</Text>
                  <ChevronRight size={16} color={theme.colors.error} />
                </View>
              </GlassCard>
            </PressableScale>
          )}
        </View>
      </Animated.View>

      {/* ── 5. Empty State for Zero Members with 3-Step Setup ───────────── */}
      {isZeroMembers && (
        <View style={styles.setupCardWrapper}>
          <GlassCard style={styles.setupCard} intensity={35}>
            <View style={styles.setupHeader}>
              <View style={styles.setupIconCircle}>
                <Sparkles size={24} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.setupTitle}>Welcome to your Gym!</Text>
                <Text style={styles.setupSubtitle}>
                  Follow these 3 quick steps to set up your operations:
                </Text>
              </View>
            </View>

            {/* Checklist */}
            <View style={styles.checklist}>
              <TouchableOpacity
                style={styles.checkStep}
                onPress={() => router.push('/(tabs)/more/plans')}
                activeOpacity={0.7}
              >
                <View style={styles.stepNumCircle}>
                  <Text style={styles.stepNumText}>1</Text>
                </View>
                <View style={styles.stepDetails}>
                  <Text style={styles.stepTitle}>Create Membership Plans</Text>
                  <Text style={styles.stepDesc}>Set up monthly or quarterly packages</Text>
                </View>
                <ChevronRight size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkStep}
                onPress={() => router.push('/(tabs)/members/add')}
                activeOpacity={0.7}
              >
                <View style={[styles.stepNumCircle, { borderColor: theme.colors.primary }]}>
                  <Text style={[styles.stepNumText, { color: theme.colors.primary }]}>2</Text>
                </View>
                <View style={styles.stepDetails}>
                  <Text style={styles.stepTitle}>Add Your First Member</Text>
                  <Text style={styles.stepDesc}>Enroll details, assign plan & collect fees</Text>
                </View>
                <ChevronRight size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkStep}
                onPress={() => router.push('/(tabs)/attendance')}
                activeOpacity={0.7}
              >
                <View style={styles.stepNumCircle}>
                  <Text style={styles.stepNumText}>3</Text>
                </View>
                <View style={styles.stepDetails}>
                  <Text style={styles.stepTitle}>Track Daily Attendance</Text>
                  <Text style={styles.stepDesc}>Mark check-ins or scan QR codes instantly</Text>
                </View>
                <ChevronRight size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Big CTA Button */}
            <Button
              title="Add Your First Member"
              onPress={() => router.push('/(tabs)/members/add')}
              variant="primary"
              size="lg"
              style={{ marginTop: theme.spacing.lg }}
            />
          </GlassCard>
        </View>
      )}

      {/* ── 6. Expiring Soon List ───────────────────────────────────────── */}
      {!isZeroMembers && data?.expiringSoonList && data.expiringSoonList.length > 0 && (
        <Animated.View
          style={[
            styles.expiringSection,
            {
              opacity: animList,
              transform: [
                {
                  translateY: animList.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.sectionHeader}>EXPIRING SOON</Text>
              <View style={styles.expiringBadgeCount}>
                <Text style={styles.expiringBadgeCountText}>{data.expiringSoonList.length}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/members')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {data.expiringSoonList.map((member) => (
            <GlassCard key={member.memberId} style={styles.expiringMemberCard}>
              <View style={styles.expiringCardContent}>
                <Avatar
                  name={member.memberName}
                  status="expiring"
                  size="md"
                />

                <View style={styles.memberInfoCol}>
                  <Text style={styles.memberNameText} numberOfLines={1}>
                    {member.memberName}
                  </Text>
                  <View style={styles.daysLeftPill}>
                    <Clock size={11} color={theme.colors.warning} />
                    <Text style={styles.daysLeftText}>
                      {member.daysLeft === 0
                        ? 'Expires Today'
                        : member.daysLeft === 1
                        ? '1 day left'
                        : `${member.daysLeft} days left`}
                    </Text>
                  </View>
                </View>

                {/* Call & WhatsApp Action Buttons (hidden when masked) */}
                {!isPhoneMasked(member.phone) && (
                  <View style={styles.actionBtnsRow}>
                    <TouchableOpacity
                      style={styles.callActionBtn}
                      onPress={() => handleCallMember(member.phone)}
                      accessibilityLabel={`Call ${member.memberName}`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Phone size={16} color={theme.colors.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.waActionBtn}
                      onPress={() => handleWhatsAppMember(member)}
                      accessibilityLabel={`WhatsApp ${member.memberName}`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MessageCircle size={16} color={theme.colors.textOnPrimary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </GlassCard>
          ))}
        </Animated.View>
      )}
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    // paddingBottom is applied dynamically = tabBar height + safeArea.bottom
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },

  // Skeleton Loader Styles
  skeletonHeader: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  skeletonBody: {
    paddingHorizontal: theme.spacing.lg,
  },
  skeletonHeroCard: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: theme.spacing.md,
  },

  // 1. Hero Header
  heroHeader: {
    marginBottom: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
  },
  headerMain: {
    width: '100%',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingText: {
    flex: 1,
    marginRight: theme.spacing.sm,
    fontFamily: theme.fonts.headingBold,
    fontSize: 22,
    color: theme.colors.text,
    letterSpacing: 0.2,
  },
  gymNameText: {
    ...theme.typography.caption,
    color: 'rgba(218, 241, 222, 0.80)',
    marginTop: 2,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(11, 43, 38, 0.75)',
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.glow,
  },
  bellBadge: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.warning,
  },

  // 2. Glass Hero Card
  animatedBlock: {
    width: '100%',
    marginBottom: theme.spacing.lg,
  },
  heroCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
  },
  heroCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  heroCardLabel: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 11,
    color: theme.colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  heroCardLargeValue: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 32,
    color: theme.colors.text,
    lineHeight: 38,
  },
  heroMonthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(142, 182, 155, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(142, 182, 155, 0.3)',
  },
  heroMonthText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.primary,
  },

  // 7-Day Trend Bars
  sparklineWrap: {
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(218, 241, 222, 0.08)',
  },
  sparklineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sparklineTitle: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 12,
    color: theme.colors.text,
  },
  sparklineSubtitle: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
  },
  trendContainer: {
    width: '100%',
    paddingTop: 4,
  },
  trendBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
  },
  trendCol: {
    alignItems: 'center',
    flex: 1,
  },
  trendBarTrack: {
    height: 44,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: 20,
  },
  trendBarFill: {
    width: 10,
    borderRadius: 5,
  },
  trendDayText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 6,
  },
  trendDayTextToday: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.bodyMedium,
  },
  trendZeroCaption: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },

  // 3. Quick Actions
  quickActionsContainer: {
    marginBottom: theme.spacing.lg,
  },
  sectionHeader: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 11,
    color: theme.colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: theme.spacing.sm,
    paddingLeft: 2,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickActionItem: {
    flex: 1,
  },
  quickActionCard: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 43, 38, 0.70)',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.14)',
    paddingVertical: 14,
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(142, 182, 155, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(142, 182, 155, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    alignSelf: 'center',
  },
  quickActionLabel: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 11,
    color: theme.colors.text,
    textAlign: 'center',
  },

  // 4. Stat Grid
  statGridContainer: {
    marginBottom: theme.spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: theme.spacing.md,
  },
  statCardWrapper: {
    width: '48%',
  },
  statCard: {
    borderRadius: theme.radius.lg,
  },
  statCardInner: {
    padding: theme.spacing.md,
    minHeight: 116,
    justifyContent: 'space-between',
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardLabel: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 8,
  },
  statCardValue: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 22,
    color: theme.colors.text,
    marginTop: 2,
  },
  statCardExpiringBorder: {
    borderColor: 'rgba(245, 181, 68, 0.35)',
  },
  statCardFullWidth: {
    width: '100%',
  },
  statCardDueBorder: {
    borderColor: 'rgba(255, 107, 107, 0.35)',
  },
  statCardDueInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  statDueLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statDueRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  statDueActionText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 12,
    color: theme.colors.error,
  },

  // Pulsing Dot
  pulsingWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsingOuter: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.warning,
  },
  pulsingInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.warning,
  },

  // 5. Zero Members Empty State
  setupCardWrapper: {
    marginBottom: theme.spacing.xl,
  },
  setupCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    borderColor: 'rgba(142, 182, 155, 0.3)',
  },
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  setupIconCircle: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(142, 182, 155, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  setupTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
    color: theme.colors.text,
  },
  setupSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  checklist: {
    gap: 12,
    marginTop: theme.spacing.xs,
  },
  checkStep: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 43, 38, 0.65)',
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    minHeight: 52,
  },
  stepNumCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 13,
    color: theme.colors.text,
  },
  stepDetails: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 14,
    color: theme.colors.text,
  },
  stepDesc: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
    marginTop: 1,
  },

  // 6. Expiring Soon List
  expiringSection: {
    marginBottom: theme.spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    paddingHorizontal: 2,
  },
  expiringBadgeCount: {
    backgroundColor: 'rgba(245, 181, 68, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  expiringBadgeCountText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 11,
    color: theme.colors.warning,
  },
  seeAllText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 13,
    color: theme.colors.primary,
  },
  expiringMemberCard: {
    marginBottom: 8,
    borderRadius: theme.radius.md,
  },
  expiringCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  memberInfoCol: {
    flex: 1,
    marginLeft: 12,
  },
  memberNameText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: 4,
  },
  daysLeftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 181, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  daysLeftText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    color: theme.colors.warning,
  },
  actionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callActionBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waActionBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
