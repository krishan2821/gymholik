import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  AccessibilityInfo,
  ActivityIndicator,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { ArrowRight, Users, Wallet, QrCode } from 'lucide-react-native';
import { useAuthStore } from '../src/store/useAuthStore';
import { theme } from '../src/theme/theme';
import { Screen } from '../src/components/Screen';
import { GymholikLogo } from '../src/components/GymholikLogo';
import { Button } from '../src/components/Button';
import { GlassCard } from '../src/components/GlassCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface IntroSlide {
  id: string;
  title: string;
  description: string;
  icon: typeof Users;
}

const INTRO_SLIDES: IntroSlide[] = [
  {
    id: 'members',
    title: 'Members',
    description: 'Track active memberships, renewals & admissions effortlessly.',
    icon: Users,
  },
  {
    id: 'payments',
    title: 'Payments',
    description: 'Record fees, view dues & share WhatsApp receipts in seconds.',
    icon: Wallet,
  },
  {
    id: 'attendance',
    title: 'Attendance',
    description: 'Instant QR check-ins & daily absent alerts for all members.',
    icon: QrCode,
  },
];

export default function SplashScreen() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (reduceMotion) {
      fadeAnim.setValue(1);
      scaleAnim.setValue(1);
      contentFadeAnim.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    });
  }, [isLoading, reduceMotion]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 48));
    if (slideIndex !== activeSlide && slideIndex >= 0 && slideIndex < INTRO_SLIDES.length) {
      setActiveSlide(slideIndex);
    }
  };

  const handleGetStarted = () => {
    router.replace('/(auth)/login');
  };

  return (
    <Screen withHeroImage heroOpacity={0.85} style={styles.container}>
      {/* ── Top Hero / Logo Section ───────────────────────────────────── */}
      <View style={styles.topSection}>
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <GymholikLogo size={80} />
          <Text style={styles.brandTitle}>Gymholik</Text>
          <Text style={styles.brandTagline}>Manage your gym, all in one place</Text>
        </Animated.View>
      </View>

      {/* ── Bottom Section: Intro Slides & CTA ───────────────────────── */}
      <Animated.View style={[styles.bottomSection, { opacity: contentFadeAnim }]}>
        <GlassCard style={styles.sliderCard} intensity={30}>
          <FlatList
            ref={flatListRef}
            data={INTRO_SLIDES}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            renderItem={({ item }) => {
              const IconComponent = item.icon;
              return (
                <View style={styles.slideItem}>
                  <View style={styles.iconCircle}>
                    <IconComponent size={24} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.slideTitle}>{item.title}</Text>
                  <Text style={styles.slideDesc}>{item.description}</Text>
                </View>
              );
            }}
          />

          {/* ── Page Dots ────────────────────────────────────────────── */}
          <View style={styles.dotsRow}>
            {INTRO_SLIDES.map((slide, idx) => (
              <TouchableOpacity
                key={slide.id}
                onPress={() => {
                  flatListRef.current?.scrollToIndex({ index: idx, animated: !reduceMotion });
                  setActiveSlide(idx);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[
                  styles.dot,
                  activeSlide === idx ? styles.dotActive : styles.dotInactive,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Go to slide ${idx + 1}`}
              />
            ))}
          </View>
        </GlassCard>

        {/* ── Get Started Button ──────────────────────────────────────── */}
        <View style={styles.ctaWrapper}>
          <Button
            title="Get Started"
            onPress={handleGetStarted}
            variant="primary"
            size="lg"
            icon={<ArrowRight size={20} color={theme.colors.textOnPrimary} />}
            iconPosition="right"
          />
        </View>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xxl,
  },
  logoContainer: {
    alignItems: 'center',
  },
  brandTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 34,
    color: theme.colors.text,
    letterSpacing: 0.5,
    marginTop: theme.spacing.md,
    marginBottom: 4,
  },
  brandTagline: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  bottomSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  sliderCard: {
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  slideItem: {
    width: SCREEN_WIDTH - 64, // Matches card inner width
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.raised,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  slideTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
    color: theme.colors.text,
    marginBottom: 4,
  },
  slideDesc: {
    ...theme.typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: theme.colors.primary,
  },
  dotInactive: {
    width: 8,
    backgroundColor: theme.colors.border,
  },
  ctaWrapper: {
    marginTop: theme.spacing.xs,
  },
});
