import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Animated,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { AlertCircle } from 'lucide-react-native';

import { sendOtp, verifyOtp, classifyError, ApiError } from '../../src/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { getHomeRouteForRole } from '../../src/navigation/tabsByRole';
import { theme } from '../../src/theme/theme';
import { Screen } from '../../src/components/Screen';
import { GlassCard } from '../../src/components/GlassCard';
import { GymholikLogo } from '../../src/components/GymholikLogo';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { LOGIN, VALIDATION } from '../../src/constants/strings';

const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;
const OTP_LENGTH = 6;
const DEFAULT_RESEND_SECONDS = 30;

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatRetryDuration(seconds?: number | null): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0 && secs > 0) {
    return `${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins} minute${mins === 1 ? '' : 's'}`;
  }
  return `${secs} second${secs === 1 ? '' : 's'}`;
}

function resolveBannerErrorMessage(apiErr: ApiError): string {
  const code = apiErr.errorCode;
  if (!apiErr.status || code === 'NETWORK_ERROR') {
    return LOGIN.ERRORS.NETWORK;
  }
  if (code === 'INVALID_OTP') {
    return LOGIN.ERRORS.INVALID_OTP;
  }
  if (code === 'RATE_LIMITED' || apiErr.status === 429) {
    return LOGIN.ERRORS.RATE_LIMITED(formatRetryDuration(apiErr.retryAfterSeconds));
  }
  if (code === 'ACCOUNT_INACTIVE') {
    return LOGIN.ERRORS.ACCOUNT_INACTIVE;
  }
  if (
    code === 'SUBSCRIPTION_EXPIRED' ||
    code === 'GYM_TRIAL_EXPIRED' ||
    apiErr.status === 402
  ) {
    return LOGIN.ERRORS.SUBSCRIPTION_EXPIRED;
  }
  if (code === 'GYM_SUSPENDED') {
    return LOGIN.ERRORS.GYM_SUSPENDED;
  }
  return apiErr.message || LOGIN.ERRORS.GENERIC;
}

export default function OtpLoginScreen() {
  const params = useLocalSearchParams<{ error?: string }>();
  const setAuthData = useAuthStore((s) => s.setAuthData);
  const setRegistrationSession = useAuthStore((s) => s.setRegistrationSession);
  const clearRegistrationSession = useAuthStore((s) => s.clearRegistrationSession);

  // ── State ─────────────────────────────────────────────────────────────────
  const [phone, setPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [isOtpFocused, setIsOtpFocused] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(
    params.error ? String(params.error) : null
  );
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (params.error) {
      setBannerError(String(params.error));
    }
  }, [params.error]);

  // ── Refs & Locks ──────────────────────────────────────────────────────────
  const phoneInputRef = useRef<TextInput>(null);
  const otpInputRef = useRef<TextInput>(null);
  const sendingLockRef = useRef(false);
  const verifyingLockRef = useRef(false);

  // ── Animations ────────────────────────────────────────────────────────────
  const revealOpacity = useRef(new Animated.Value(0)).current;
  const revealTranslateY = useRef(new Animated.Value(16)).current;
  const shakeX = useRef(new Animated.Value(0)).current;

  // Check system reduce-motion preference
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(Boolean(enabled));
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (enabled) => {
        if (mounted) setReduceMotion(Boolean(enabled));
      }
    );
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  // Countdown timer for Resend OTP
  useEffect(() => {
    if (!otpSent || resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpSent, resendSeconds]);

  // ── Haptics helpers ───────────────────────────────────────────────────────
  const triggerSuccessHaptic = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const triggerErrorHaptic = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }, []);

  // ── Animation helpers ─────────────────────────────────────────────────────
  const animateRevealOtpSection = useCallback(() => {
    if (reduceMotion) {
      revealOpacity.setValue(1);
      revealTranslateY.setValue(0);
      return;
    }
    revealOpacity.setValue(0);
    revealTranslateY.setValue(16);
    Animated.parallel([
      Animated.timing(revealOpacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(revealTranslateY, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduceMotion, revealOpacity, revealTranslateY]);

  const triggerOtpShake = useCallback(() => {
    if (reduceMotion) {
      shakeX.setValue(0);
      return;
    }
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -4, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [reduceMotion, shakeX]);

  // ── Validation ────────────────────────────────────────────────────────────
  const isPhoneValid = INDIAN_PHONE_REGEX.test(phone);
  const showPhoneInlineError =
    !otpSent &&
    phone.length > 0 &&
    ((phone.length === 10 && !isPhoneValid) ||
      (phoneTouched && !isPhoneValid) ||
      !/^[6-9]/.test(phone));
  const phoneInlineError = showPhoneInlineError ? VALIDATION.PHONE_INVALID : undefined;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePhoneChange = (raw: string) => {
    setBannerError(null);
    let digits = raw.replace(/\D/g, '');
    // Strip leading 91 if user pasted +91XXXXXXXXXX (12 digits)
    if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    setPhone(digits.slice(0, 10));
  };

  const handleGetOtp = async () => {
    setPhoneTouched(true);
    if (!isPhoneValid || sendingLockRef.current) return;

    sendingLockRef.current = true;
    setIsSendingOtp(true);
    setBannerError(null);

    try {
      const response = await sendOtp(phone);
      const cooldown =
        response?.data?.resendAfterSeconds ?? DEFAULT_RESEND_SECONDS;
      setResendSeconds(cooldown);
      setOtp('');
      setOtpSent(true);
      animateRevealOtpSection();
      triggerSuccessHaptic();

      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
    } catch (err: unknown) {
      const apiErr = classifyError(err);
      setBannerError(resolveBannerErrorMessage(apiErr));
      triggerErrorHaptic();
    } finally {
      setIsSendingOtp(false);
      sendingLockRef.current = false;
    }
  };

  const handleChangeNumber = () => {
    clearRegistrationSession();
    setOtpSent(false);
    setOtp('');
    setResendSeconds(0);
    setBannerError(null);
    revealOpacity.setValue(0);
    revealTranslateY.setValue(16);
    setTimeout(() => {
      phoneInputRef.current?.focus();
    }, 80);
  };

  const handleResendOtp = async () => {
    if (resendSeconds > 0 || sendingLockRef.current || isVerifyingOtp) return;

    sendingLockRef.current = true;
    setIsSendingOtp(true);
    setBannerError(null);
    setOtp('');

    try {
      const response = await sendOtp(phone);
      const cooldown =
        response?.data?.resendAfterSeconds ?? DEFAULT_RESEND_SECONDS;
      setResendSeconds(cooldown);
      triggerSuccessHaptic();
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 80);
    } catch (err: unknown) {
      const apiErr = classifyError(err);
      if (apiErr.retryAfterSeconds && apiErr.retryAfterSeconds > 0) {
        setResendSeconds(apiErr.retryAfterSeconds);
      }
      setBannerError(resolveBannerErrorMessage(apiErr));
      triggerErrorHaptic();
    } finally {
      setIsSendingOtp(false);
      sendingLockRef.current = false;
    }
  };

  const handleOtpChange = (raw: string) => {
    setBannerError(null);
    const digits = raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(digits);
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== OTP_LENGTH || verifyingLockRef.current) return;

    verifyingLockRef.current = true;
    setIsVerifyingOtp(true);
    setBannerError(null);

    try {
      const response = await verifyOtp(phone, otp);
      const data = response.data;
      triggerSuccessHaptic();

      if (data.isNewUser) {
        if (!data.registrationToken) {
          throw new Error('Missing registration token');
        }
        // Keep registrationToken in memory only (never in SecureStore) and navigate to Registration
        setRegistrationSession(data.registrationToken, phone);
        router.push('/(auth)/register');
        return;
      }

      if (!data.accessToken || !data.refreshToken || !data.user) {
        throw new Error('Incomplete authentication payload');
      }

      const { accessToken, refreshToken, user } = data;
      await setAuthData(
        accessToken,
        refreshToken,
        user.role,
        user.id,
        user.gymId ?? '',
        user.name,
        phone,
        user.gymName ?? null
      );

      // Navigate by role using tabsByRole config and replace stack so Back cannot return to Login
      const destination = getHomeRouteForRole(user.role);
      router.replace(destination as any);
    } catch (err: unknown) {
      const apiErr = classifyError(err);
      setBannerError(resolveBannerErrorMessage(apiErr));
      triggerErrorHaptic();

      if (apiErr.errorCode === 'INVALID_OTP' || apiErr.status === 401) {
        triggerOtpShake();
        setOtp('');
        setTimeout(() => {
          otpInputRef.current?.focus();
        }, 80);
      }
    } finally {
      setIsVerifyingOtp(false);
      verifyingLockRef.current = false;
    }
  };

  const activeBoxIndex = Math.min(otp.length, OTP_LENGTH - 1);

  return (
    <Screen
      scrollable
      withHeroImage
      heroOpacity={0.85}
      keyboardAvoiding
      safeBottom={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header: Mint Logo + Welcome Back + Subtitle */}
      <View style={styles.headerSection}>
        <GymholikLogo size={68} style={styles.logo} />
        <Text style={styles.title}>{LOGIN.TITLE}</Text>
        <Text style={styles.subtitle}>{LOGIN.SUBTITLE}</Text>
      </View>

      {/* Main Glass Card */}
      <GlassCard style={styles.glassCard} contentStyle={styles.cardInner}>
        {/* Mobile Number Field (Editable in State 1, Read-only with Change number link in State 2) */}
        <Input
          ref={phoneInputRef}
          label={LOGIN.PHONE_LABEL}
          prefix={LOGIN.PHONE_PREFIX}
          placeholder={LOGIN.PHONE_PLACEHOLDER}
          keyboardType="phone-pad"
          maxLength={10}
          autoFocus={!otpSent}
          editable={!otpSent && !isSendingOtp}
          value={phone}
          onChangeText={handlePhoneChange}
          onBlur={() => setPhoneTouched(true)}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (!otpSent && isPhoneValid) {
              handleGetOtp();
            }
          }}
          error={phoneInlineError}
          containerStyle={otpSent ? styles.phoneContainerReadOnly : undefined}
          rightIcon={
            otpSent ? (
              <TouchableOpacity
                onPress={handleChangeNumber}
                disabled={isVerifyingOtp || isSendingOtp}
                style={styles.changeNumberBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={LOGIN.CHANGE_NUMBER}
              >
                <Text style={styles.changeNumberText}>{LOGIN.CHANGE_NUMBER}</Text>
              </TouchableOpacity>
            ) : undefined
          }
        />

        {/* STATE 1: Get OTP Button + Helper Text */}
        {!otpSent && (
          <>
            {bannerError && (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <AlertCircle color={theme.colors.error} size={18} />
                <Text style={styles.errorBannerText}>{bannerError}</Text>
              </View>
            )}

            <View style={styles.primaryButtonWrapper}>
              <Button
                title={LOGIN.GET_OTP}
                onPress={handleGetOtp}
                loading={isSendingOtp}
                disabled={!isPhoneValid || isSendingOtp}
                size="lg"
              />
            </View>

            <Text style={styles.staffHelperText}>{LOGIN.STAFF_HELPER}</Text>
          </>
        )}

        {/* STATE 2: Animated OTP Reveal Section */}
        {otpSent && (
          <Animated.View
            style={[
              styles.otpSection,
              {
                opacity: revealOpacity,
                transform: [{ translateY: revealTranslateY }],
              },
            ]}
          >
            <View style={styles.otpHeaderRow}>
              <Text style={styles.otpSectionLabel}>{LOGIN.OTP_SECTION_LABEL}</Text>
              {__DEV__ && (
                <Text style={styles.devOtpHint}>{LOGIN.DEV_OTP_HINT}</Text>
              )}
            </View>

            {/* 6 Visual OTP Boxes backed by ONE Hidden TextInput */}
            <Pressable
              onPress={() => otpInputRef.current?.focus()}
              style={styles.otpWrapper}
              accessibilityRole="button"
              accessibilityLabel={LOGIN.OTP_SECTION_LABEL}
            >
              <TextInput
                ref={otpInputRef}
                value={otp}
                onChangeText={handleOtpChange}
                onFocus={() => setIsOtpFocused(true)}
                onBlur={() => setIsOtpFocused(false)}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={OTP_LENGTH}
                autoFocus
                caretHidden
                contextMenuHidden={false}
                style={styles.hiddenOtpInput}
                onSubmitEditing={() => {
                  if (otp.length === OTP_LENGTH) {
                    handleVerifyOtp();
                  }
                }}
              />

              <Animated.View
                style={[
                  styles.otpBoxesRow,
                  { transform: [{ translateX: shakeX }] },
                ]}
                pointerEvents="none"
              >
                {Array.from({ length: OTP_LENGTH }).map((_, idx) => {
                  const digit = otp[idx] ?? '';
                  const isFilled = digit.length > 0;
                  const isActive = isOtpFocused && idx === activeBoxIndex;

                  return (
                    <View
                      key={idx}
                      style={[
                        styles.otpBox,
                        isFilled && styles.otpBoxFilled,
                        isActive && styles.otpBoxActive,
                      ]}
                    >
                      <Text style={styles.otpDigitText}>{digit}</Text>
                      {isActive && !isFilled && <View style={styles.otpCursor} />}
                    </View>
                  );
                })}
              </Animated.View>
            </Pressable>

            {/* Resend OTP Row with Countdown */}
            <View style={styles.resendRow}>
              <TouchableOpacity
                onPress={handleResendOtp}
                disabled={resendSeconds > 0 || isSendingOtp || isVerifyingOtp}
                style={styles.resendTouchTarget}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: resendSeconds > 0 || isSendingOtp || isVerifyingOtp,
                }}
              >
                <Text
                  style={[
                    styles.resendText,
                    resendSeconds > 0
                      ? styles.resendTextDisabled
                      : styles.resendTextActive,
                  ]}
                >
                  {resendSeconds > 0
                    ? LOGIN.RESEND_IN(formatCountdown(resendSeconds))
                    : LOGIN.RESEND_OTP}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Coral Error Banner above Verify & Proceed */}
            {bannerError && (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <AlertCircle color={theme.colors.error} size={18} />
                <Text style={styles.errorBannerText}>{bannerError}</Text>
              </View>
            )}

            {/* Primary Button: Verify & Proceed */}
            <View style={styles.verifyButtonWrapper}>
              <Button
                title={LOGIN.VERIFY_AND_PROCEED}
                onPress={handleVerifyOtp}
                loading={isVerifyingOtp}
                disabled={otp.length !== OTP_LENGTH || isVerifyingOtp}
                size="lg"
              />
            </View>

            <Text style={styles.staffHelperText}>{LOGIN.STAFF_HELPER}</Text>
          </Animated.View>
        )}
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    justifyContent: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  logo: {
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.h1,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  glassCard: {
    marginBottom: theme.spacing.lg,
  },
  cardInner: {
    padding: theme.spacing.xl,
  },
  phoneContainerReadOnly: {
    marginBottom: theme.spacing.sm,
  },
  changeNumberBtn: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeNumberText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  primaryButtonWrapper: {
    marginTop: theme.spacing.xs,
  },
  staffHelperText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    lineHeight: 18,
  },
  otpSection: {
    marginTop: theme.spacing.sm,
  },
  otpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  otpSectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.headingMedium,
    fontWeight: '600',
  },
  devOtpHint: {
    ...theme.typography.small,
    fontFamily: theme.fonts.headingBold,
    fontWeight: '700',
    color: theme.colors.primary,
    backgroundColor: 'rgba(142, 182, 155, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
  },
  otpWrapper: {
    position: 'relative',
    minHeight: 56,
    justifyContent: 'center',
  },
  hiddenOtpInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.01,
    fontSize: 1,
    zIndex: 2,
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpBox: {
    flex: 1,
    minWidth: 44,
    minHeight: 54,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpBoxFilled: {
    borderColor: 'rgba(142, 182, 155, 0.55)',
    backgroundColor: theme.colors.raised,
  },
  otpBoxActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(142, 182, 155, 0.14)',
    ...Platform.select({
      ios: {
        ...theme.shadows.glow,
      },
      android: {
        elevation: 5,
        shadowColor: theme.colors.primary,
      },
    }),
  },
  otpDigitText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  otpCursor: {
    width: 2,
    height: 22,
    borderRadius: 1,
    backgroundColor: theme.colors.primary,
  },
  resendRow: {
    alignItems: 'flex-end',
    marginTop: 6,
    marginBottom: theme.spacing.xs,
  },
  resendTouchTarget: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  resendText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 13,
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: theme.colors.textMuted,
  },
  resendTextActive: {
    color: theme.colors.primary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.40)',
    padding: 12,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  errorBannerText: {
    color: theme.colors.error,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  verifyButtonWrapper: {
    marginTop: theme.spacing.xs,
  },
});
