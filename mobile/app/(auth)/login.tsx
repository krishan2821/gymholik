import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  AccessibilityInfo,
  Linking,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, AlertCircle, X, MessageCircle, HelpCircle } from 'lucide-react-native';

import { useAuthStore } from '../../src/store/useAuthStore';
import { loginUser, classifyError } from '../../src/api';
import { theme } from '../../src/theme/theme';
import { Screen } from '../../src/components/Screen';
import { GlassCard } from '../../src/components/GlassCard';
import { Button } from '../../src/components/Button';
import { GymholikLogo } from '../../src/components/GymholikLogo';
import { getHomeRouteForRole } from '../../src/navigation/tabsByRole';

// ─── Validation schema ─────────────────────────────────────────────────────────
const loginSchema = z.object({
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number starting with 6–9'),
  password: z.string().min(1, 'Password is required'),
  gymCode: z
    .string()
    .optional()
    .refine((val) => !val || val.trim().length === 0 || val.trim().length >= 4, {
      message: 'Gym code must be at least 4 characters if entered',
    }),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [forgotSheetVisible, setForgotSheetVisible] = useState(false);
  const [logoTapCount, setLogoTapCount] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const gymCodeRef = useRef<TextInput>(null);
  const setAuthData = useAuthStore((state) => state.setAuthData);

  // ── Animations: Card Slide-Up & Error Shake ───────────────────────────────
  const cardSlideAnim = useRef(new Animated.Value(60)).current;
  const cardFadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      cardSlideAnim.setValue(0);
      cardFadeAnim.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.timing(cardFadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(cardSlideAnim, {
        toValue: 0,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduceMotion]);

  const triggerShake = useCallback(() => {
    if (reduceMotion) return;
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [reduceMotion, shakeAnim]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '', gymCode: '' },
  });

  // ── Logo tap 5× → hidden Super Admin screen ──────────────────────────────
  const handleLogoTap = useCallback(() => {
    setLogoTapCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        router.push('/(auth)/super-admin-login' as any);
        return 0;
      }
      return next;
    });
  }, []);

  // ── Submit handler ────────────────────────────────────────────────────────
  const onSubmit = async (values: LoginFormData) => {
    setServerError(null);
    try {
      const trimmedCode = values.gymCode?.trim() ? values.gymCode.trim().toUpperCase() : undefined;
      const tokens = await loginUser({
        phone: values.phone,
        password: values.password,
        gymCode: trimmedCode,
      });

      await setAuthData(
        tokens.accessToken,
        tokens.refreshToken,
        tokens.role,
        tokens.userId,
        tokens.gymId ?? '',
        tokens.gymCode ?? trimmedCode ?? null
      );

      const homeRoute = getHomeRouteForRole(tokens.role);
      router.replace(homeRoute as any);
    } catch (error: unknown) {
      const apiErr = classifyError(error);
      setServerError(apiErr.message);
      triggerShake();
    }
  };

  const handleWhatsAppHelp = () => {
    Linking.openURL(
      'https://wa.me/919999999999?text=' +
        encodeURIComponent('Hi Gymholik Support, I need help resetting my password.')
    );
  };

  return (
    <Screen
      scrollable
      withHeroImage
      heroOpacity={0.85}
      keyboardAvoiding
      contentContainerStyle={styles.scroll}
    >
      {/* ── Top Header with Mint Logo (No Checkerboard) ──────────────── */}
      <View style={styles.topSection}>
        <TouchableOpacity
          onPress={handleLogoTap}
          activeOpacity={0.85}
          style={styles.logoBtn}
          accessibilityLabel="Gymholik logo"
        >
          <GymholikLogo size={68} />
        </TouchableOpacity>
        <Text style={styles.brandTitle}>Gymholik</Text>
        <Text style={styles.brandTagline}>Manage your gym, all in one place</Text>
      </View>

      {/* ── Slide-up Glass Card over silhouette background ───────────── */}
      <Animated.View
        style={[
          styles.cardWrapper,
          {
            opacity: cardFadeAnim,
            transform: [{ translateY: cardSlideAnim }, { translateX: shakeAnim }],
          },
        ]}
      >
        <GlassCard style={styles.card} intensity={35}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSubtitle}>Sign in to continue</Text>

          {/* ── Coral Error Banner ────────────────────────────────────── */}
          {serverError && (
            <View style={styles.errorBanner} accessibilityRole="alert">
              <AlertCircle color={theme.colors.error} size={18} />
              <Text style={styles.errorBannerText}>{serverError}</Text>
              <TouchableOpacity
                onPress={() => setServerError(null)}
                style={styles.errorDismiss}
                accessibilityLabel="Dismiss error"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X color={theme.colors.error} size={16} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Mobile Number Input ───────────────────────────────────── */}
          <Text style={styles.label}>Mobile number</Text>
          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <View
                style={[
                  styles.inputRow,
                  errors.phone && styles.inputRowError,
                ]}
              >
                <View style={styles.prefixBox}>
                  <Text style={styles.prefix}>+91</Text>
                  <View style={styles.prefixDivider} />
                </View>
                <TextInput
                  style={styles.inputField}
                  placeholder="98765 43210"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={10}
                  returnKeyType="next"
                  autoFocus
                  onBlur={onBlur}
                  onChangeText={(v) => onChange(v.replace(/\D/g, ''))}
                  value={value}
                  onSubmitEditing={() => gymCodeRef.current?.focus()}
                  accessibilityLabel="Mobile number"
                />
              </View>
            )}
          />
          {errors.phone && (
            <Text style={styles.fieldError}>{errors.phone.message}</Text>
          )}

          {/* ── Gym Code (Optional for Owner) ─────────────────────────── */}
          <View style={styles.labelRow}>
            <Text style={styles.label}>Gym code</Text>
            <Text style={styles.optionalBadge}>Optional for owner</Text>
          </View>
          <Controller
            control={control}
            name="gymCode"
            render={({ field: { onChange, onBlur, value } }) => (
              <View
                style={[
                  styles.inputRow,
                  errors.gymCode && styles.inputRowError,
                ]}
              >
                <TextInput
                  ref={gymCodeRef}
                  style={[styles.inputField, { letterSpacing: 2 }]}
                  placeholder="e.g. FITZON1234"
                  placeholderTextColor={theme.colors.textMuted}
                  returnKeyType="next"
                  autoCapitalize="characters"
                  onBlur={onBlur}
                  onChangeText={(v) => onChange(v.toUpperCase())}
                  value={value}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  accessibilityLabel="Gym code"
                />
              </View>
            )}
          />
          {errors.gymCode ? (
            <Text style={styles.fieldError}>{errors.gymCode.message}</Text>
          ) : (
            <Text style={styles.fieldHint}>
              Gym code aapke owner se lein ya registration ke waqt mila hoga.
            </Text>
          )}

          {/* ── Password Input ────────────────────────────────────────── */}
          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <View
                style={[
                  styles.inputRow,
                  errors.password && styles.inputRowError,
                ]}
              >
                <TextInput
                  ref={passwordRef}
                  style={[styles.inputField, styles.passwordField]}
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.textMuted}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  onSubmitEditing={handleSubmit(onSubmit)}
                  accessibilityLabel="Password"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.eyeBtn}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff color={theme.colors.primary} size={20} />
                  ) : (
                    <Eye color={theme.colors.textMuted} size={20} />
                  )}
                </TouchableOpacity>
              </View>
            )}
          />
          {errors.password && (
            <Text style={styles.fieldError}>{errors.password.message}</Text>
          )}

          {/* ── Forgot Password Link ──────────────────────────────────── */}
          <TouchableOpacity
            style={styles.forgotRow}
            onPress={() => setForgotSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Forgot password?"
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* ── Sign In Button ────────────────────────────────────────── */}
          <Button
            title="Sign In"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting}
            variant="primary"
            size="lg"
          />
        </GlassCard>

        {/* ── Register Link ─────────────────────────────────────────── */}
        <View style={styles.registerRow}>
          <Text style={styles.registerPrompt}>New gym? </Text>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/register')}
            accessibilityRole="link"
            accessibilityLabel="Create an account"
            style={styles.registerTouch}
          >
            <Text style={styles.registerLink}>Create an account</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Forgot Password Bottom Sheet Modal ──────────────────────── */}
      <Modal
        visible={forgotSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setForgotSheetVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.sheetContent} intensity={40}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetIconCircle}>
              <HelpCircle size={28} color={theme.colors.primary} />
            </View>

            <Text style={styles.sheetTitle}>Reset Password</Text>
            <Text style={styles.sheetBody}>
              Agar aap gym staff hain, toh please contact your gym owner to reset your password.
            </Text>
            <Text style={styles.sheetSubBody}>
              Agar aap gym owner hain, toh hamari support team se WhatsApp par sampark karein:
            </Text>

            <TouchableOpacity
              style={styles.waHelpBtn}
              onPress={handleWhatsAppHelp}
              activeOpacity={0.8}
            >
              <MessageCircle color={theme.colors.textOnPrimary} size={18} style={{ marginRight: 8 }} />
              <Text style={styles.waHelpBtnText}>Contact WhatsApp Support</Text>
            </TouchableOpacity>

            <Button
              title="Close"
              onPress={() => setForgotSheetVisible(false)}
              variant="secondary"
              size="md"
              style={{ marginTop: theme.spacing.sm }}
            />
          </GlassCard>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
  },
  topSection: {
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  logoBtn: {
    marginBottom: theme.spacing.sm,
  },
  brandTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 32,
    color: theme.colors.text,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  brandTagline: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  cardWrapper: {
    width: '100%',
  },
  card: {
    padding: theme.spacing.xl,
    borderRadius: theme.radius.xl,
  },
  cardTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 24,
    color: theme.colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: '#FF6B6B',
    padding: 12,
    marginBottom: theme.spacing.md,
  },
  errorBannerText: {
    color: theme.colors.error,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  errorDismiss: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 6,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '600',
    marginBottom: 6,
  },
  optionalBadge: {
    ...theme.typography.small,
    color: theme.colors.primary,
    backgroundColor: theme.colors.raised,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.raised,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    minHeight: 52,
  },
  inputRowError: {
    borderColor: theme.colors.error,
  },
  prefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
  },
  prefix: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 15,
    color: theme.colors.primary,
    marginRight: 8,
  },
  prefixDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.border,
    marginRight: 8,
  },
  inputField: {
    flex: 1,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 15,
    color: theme.colors.text,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  passwordField: {
    paddingVertical: 14,
  },
  eyeBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  fieldError: {
    ...theme.typography.small,
    color: theme.colors.error,
    marginTop: 4,
    marginLeft: 2,
  },
  fieldHint: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
    marginTop: 6,
    marginLeft: 2,
    lineHeight: 16,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: 10,
    marginBottom: theme.spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  forgotText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    minHeight: 44,
  },
  registerPrompt: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  registerTouch: {
    minHeight: 44,
    justifyContent: 'center',
  },
  registerLink: {
    ...theme.typography.body,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingBold,
    fontWeight: '700',
  },

  // ── Bottom Sheet Modal ─────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.85)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    alignItems: 'center',
    borderTopWidth: 1.5,
    borderTopColor: theme.colors.border,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  sheetIconCircle: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.raised,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  sheetTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 20,
    color: theme.colors.text,
    marginBottom: 8,
  },
  sheetBody: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
  },
  sheetSubBody: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  waHelpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    width: '100%',
    paddingVertical: 14,
    borderRadius: theme.radius.full,
    marginBottom: theme.spacing.sm,
  },
  waHelpBtnText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 15,
    color: theme.colors.textOnPrimary,
    fontWeight: '700',
  },
});
