import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Image,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import * as Haptics from '../../src/utils/safeHaptics';
import {
  AlertCircle,
  Receipt,
  QrCode,
  ShieldCheck,
  Pencil,
} from 'lucide-react-native';

import { sendOtp, verifyOtp, classifyError, ApiError } from '../../src/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { getHomeRouteForRole } from '../../src/navigation/tabsByRole';
import { BRAND, getBgAsset } from '../../src/theme';
import { useTheme, useStyles, ThemeValue } from '../../src/theme/ThemeContext';
import { useAppearanceStore } from '../../src/theme/useAppearance';
import { Screen } from '../../src/components/Screen';
import { GlassCard } from '../../src/components/GlassCard';
import { GlassSurface } from '../../src/components/GlassSurface';
import { GymholikLogo } from '../../src/components/GymholikLogo';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { useBreakpoint } from '../../src/hooks/useBreakpoint';
import { LOGIN, VALIDATION } from '../../src/constants/strings';
import { shouldRenderDevOtp } from '../../src/utils/devOtp';

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
  const { isPhone, isTablet, isDesktop } = useBreakpoint();
  const { width: windowWidth } = useWindowDimensions();
  const { colors, fonts, radius, layout } = useTheme();
  const styles = useStyles(makeStyles);
  const resolvedMode = useAppearanceStore((s) => s.resolvedMode);
  const bgAsset = getBgAsset(BRAND, resolvedMode);
  const isNarrowPhone = windowWidth < 340;
  const digitFontSize = isNarrowPhone ? 18 : 24;

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
      AccessibilityInfo.announceForAccessibility(String(params.error));
    }
  }, [params.error]);

  // ── Refs & Locks ──────────────────────────────────────────────────────────
  const phoneInputRef = useRef<TextInput>(null);
  const otpInputRef = useRef<TextInput>(null);
  const sendingLockRef = useRef(false);
  const verifyingLockRef = useRef(false);

  // ── Animations ────────────────────────────────────────────────────────────
  const revealOpacity = useRef(new Animated.Value(0)).current;
  const revealTranslateY = useRef(new Animated.Value(12)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const caretOpacity = useRef(new Animated.Value(1)).current;

  // Blinking caret inside active empty OTP box (static when reduce motion is enabled)
  useEffect(() => {
    if (reduceMotion) {
      caretOpacity.setValue(1);
      return;
    }
    const blinkAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(caretOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(caretOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    blinkAnim.start();
    return () => blinkAnim.stop();
  }, [reduceMotion, caretOpacity]);

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

  // Autofocus mobile input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      phoneInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
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
    revealTranslateY.setValue(12);
    Animated.parallel([
      Animated.timing(revealOpacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: false,
      }),
      Animated.timing(revealTranslateY, {
        toValue: 0,
        duration: 240,
        useNativeDriver: false,
      }),
    ]).start();
  }, [reduceMotion, revealOpacity, revealTranslateY]);

  const triggerOtpShake = useCallback(() => {
    if (reduceMotion) {
      shakeX.setValue(0);
      return;
    }
    shakeX.setValue(0);
    // 6 steps x 50ms = 300ms total shake duration
    Animated.sequence([
      Animated.timing(shakeX, { toValue: -10, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeX, { toValue: 10, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeX, { toValue: -8, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeX, { toValue: 8, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeX, { toValue: -4, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
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
    revealTranslateY.setValue(12);
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
      Toast.show({
        type: 'success',
        text1: 'OTP sent',
      });
      triggerSuccessHaptic();
      setOtp('');
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 80);
    } catch (err: unknown) {
      const apiErr = classifyError(err);
      if (apiErr.retryAfterSeconds && apiErr.retryAfterSeconds > 0) {
        setResendSeconds(apiErr.retryAfterSeconds);
      }
      const errorMsg = resolveBannerErrorMessage(apiErr);
      setBannerError(errorMsg);
      AccessibilityInfo.announceForAccessibility(errorMsg);
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
    if (digits.length === OTP_LENGTH) {
      setTimeout(() => {
        handleVerifyOtp(digits);
      }, 60);
    }
  };

  const handleVerifyOtp = async (codeOverride?: string) => {
    const code = typeof codeOverride === 'string' ? codeOverride : otp;
    if (code.length !== OTP_LENGTH || verifyingLockRef.current) return;

    verifyingLockRef.current = true;
    setIsVerifyingOtp(true);
    setBannerError(null);

    try {
      const response = await verifyOtp(phone, code);
      const data = response.data;
      triggerSuccessHaptic();

      if (data.isNewUser) {
        if (!data.registrationToken) {
          throw new Error('Missing registration token');
        }
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

      const destination = getHomeRouteForRole(user.role);
      router.replace(destination as any);
    } catch (err: unknown) {
      const apiErr = classifyError(err);
      const errorMsg = resolveBannerErrorMessage(apiErr);
      setBannerError(errorMsg);
      AccessibilityInfo.announceForAccessibility(errorMsg);
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

  const currentTitle = otpSent ? LOGIN.OTP_TITLE : LOGIN.TITLE;
  const formattedDisplayPhone =
    phone.length === 10 ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone;
  const currentSubtitle = otpSent
    ? LOGIN.OTP_SUBTITLE(formattedDisplayPhone)
    : LOGIN.SUBTITLE;

  // ── Shared Footer Links Component ──────────────────────────────────────────
  const renderFooterLinks = () => (
    <View style={styles.footerLinksRow}>
      <TouchableOpacity
        accessibilityRole="link"
        accessibilityLabel="Terms"
        onPress={() => {
          if (Platform.OS === 'web') {
            window.open('/terms', '_blank');
          }
        }}
        style={styles.footerLinkTouch}
      >
        <Text style={styles.footerLinkText}>Terms</Text>
      </TouchableOpacity>
      <Text style={styles.footerDivider}>•</Text>
      <TouchableOpacity
        accessibilityRole="link"
        accessibilityLabel="Privacy"
        onPress={() => {
          if (Platform.OS === 'web') {
            window.open('/privacy', '_blank');
          }
        }}
        style={styles.footerLinkTouch}
      >
        <Text style={styles.footerLinkText}>Privacy</Text>
      </TouchableOpacity>
      <Text style={styles.footerDivider}>•</Text>
      <TouchableOpacity
        accessibilityRole="link"
        accessibilityLabel="Contact support"
        onPress={() => {
          if (Platform.OS === 'web') {
            window.open('mailto:support@gymholik.com', '_blank');
          }
        }}
        style={styles.footerLinkTouch}
      >
        <Text style={styles.footerLinkText}>Contact support</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Shared Login Form Card ────────────────────────────────────────────────
  const renderLoginForm = (cardMaxWidth: number) => (
    <GlassSurface
      style={[
        styles.glassCard,
        {
          maxWidth: cardMaxWidth,
          width: '100%',
        },
      ]}
      contentStyle={styles.cardInner}
    >
      {/* Mobile Number Field */}
      <Input
        ref={phoneInputRef}
        label={LOGIN.PHONE_LABEL}
        prefix={LOGIN.PHONE_PREFIX}
        placeholder={LOGIN.PHONE_PLACEHOLDER}
        keyboardType="phone-pad"
        inputMode="tel"
        autoComplete="tel"
        maxLength={10}
        autoFocus={!otpSent}
        editable={!otpSent && !isSendingOtp}
        value={otpSent && phone.length === 10 ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone}
        onChangeText={handlePhoneChange}
        onBlur={() => setPhoneTouched(true)}
        returnKeyType="done"
        onSubmitEditing={() => {
          if (!otpSent && isPhoneValid) {
            handleGetOtp();
          }
        }}
        error={phoneInlineError}
        containerStyle={otpSent ? styles.phoneContainerReadOnly : styles.phoneContainer}
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
              <Pencil size={13} color={colors.primary} />
              <Text style={styles.changeNumberText}>
                {isNarrowPhone ? 'Change' : LOGIN.CHANGE_NUMBER}
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* STATE 1: Get OTP Button + Helper Text */}
      {!otpSent && (
        <View style={styles.stateTransitionContainer}>
          {bannerError && (
            <View style={styles.errorBanner} accessibilityRole="alert">
              <AlertCircle color={colors.chipDangerText} size={18} />
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
        </View>
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
            {Boolean(__DEV__) && (
              <TouchableOpacity
                onPress={() => {
                  handleOtpChange('123456');
                  triggerSuccessHaptic();
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Autofill Dev OTP"
                style={styles.devOtpBtn}
              >
                <Text style={styles.devOtpHint}>⚡ {LOGIN.DEV_OTP_HINT}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 6 Visual OTP Boxes backed by ONE Hidden TextInput */}
          <Pressable
            onPress={() => otpInputRef.current?.focus()}
            style={styles.otpWrapper}
            accessible={true}
            accessibilityRole="none"
            accessibilityLabel="One-time password, 6 digits"
          >
            <TextInput
              ref={otpInputRef}
              value={otp}
              onChangeText={handleOtpChange}
              onFocus={() => setIsOtpFocused(true)}
              onBlur={() => setIsOtpFocused(false)}
              keyboardType="number-pad"
              inputMode="numeric"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={OTP_LENGTH}
              autoFocus
              caretHidden
              contextMenuHidden={false}
              style={styles.hiddenOtpInput}
              returnKeyType="done"
              accessibilityLabel="One-time password, 6 digits"
              onSubmitEditing={() => {
                if (otp.length === OTP_LENGTH) {
                  handleVerifyOtp();
                }
              }}
            />

            <Animated.View
              style={[
                styles.otpBoxesRow,
                {
                  transform: [{ translateX: shakeX }],
                },
              ]}
              pointerEvents="none"
              accessible={false}
            >
              {Array.from({ length: OTP_LENGTH }).map((_, idx) => {
                const digit = otp[idx] ?? '';
                const isFilled = digit.length > 0;
                const isActive = isOtpFocused && idx === activeBoxIndex;
                const hasError = Boolean(bannerError);

                return (
                  <View
                    key={idx}
                    style={[
                      styles.otpBox,
                      isFilled && styles.otpBoxFilled,
                      isActive && styles.otpBoxActive,
                      hasError && styles.otpBoxError,
                    ]}
                  >
                    {isFilled ? (
                      <Text
                        style={[
                          styles.otpDigitText,
                          { fontSize: digitFontSize },
                        ]}
                      >
                        {digit}
                      </Text>
                    ) : (
                      isActive && isOtpFocused && (
                        <Animated.View
                          style={[
                            styles.otpCustomCaret,
                            { opacity: caretOpacity },
                          ]}
                        />
                      )
                    )}
                  </View>
                );
              })}
            </Animated.View>
          </Pressable>

          {/* Resend OTP Row with Countdown */}
          <View style={styles.resendRow}>
            <Text style={styles.resendPrompt}>Didn't get the code?</Text>
            {resendSeconds > 0 ? (
              <Text style={styles.resendCountdown}>
                Resend in {formatCountdown(resendSeconds)}
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResendOtp}
                disabled={isSendingOtp || isVerifyingOtp}
                style={styles.resendTouchTarget}
                accessibilityRole="button"
                accessibilityLabel="Resend OTP"
              >
                <Text style={styles.resendLinkActive}>Resend OTP</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Coral Error Banner above Verify & Proceed */}
          {bannerError && (
            <View style={styles.errorBanner} accessibilityRole="alert">
              <AlertCircle color={colors.chipDangerText} size={18} />
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
        </Animated.View>
      )}
    </GlassSurface>
  );

  // ═════════════════════════════════════════════════════════════════════════════
  // 1. DESKTOP LAYOUT (1024 and above): Two panels, no photo behind the form
  // ═════════════════════════════════════════════════════════════════════════════
  if (Platform.OS === 'web' && isDesktop) {
    return (
      <View style={styles.desktopRoot}>
        {/* Left Panel: 55%, gym photo with green gradient overlay & features */}
        <View style={styles.desktopLeftPanel}>
          <Image
            source={bgAsset}
            style={styles.desktopHeroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={[
              colors.scrim,
              colors.scrim,
              colors.scrim,
            ]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.desktopLeftContent}>
            {/* Logo + Brand Name */}
            <View style={styles.brandLockup}>
              <GymholikLogo size={40} />
              <Text style={styles.brandName}>Gymholik</Text>
            </View>

            {/* Headline, Subline and Feature Rows */}
            <View style={styles.heroSection}>
              <Text style={styles.heroHeadline}>
                Run your gym from your phone
              </Text>
              <Text style={styles.heroSubheadline}>
                Members, fees, attendance and trainers in one simple app
              </Text>

              <View style={styles.featuresList}>
                <View style={styles.featureRow}>
                  <View style={styles.featureIconBadge}>
                    <Receipt color={colors.primary} size={22} strokeWidth={2.2} />
                  </View>
                  <View style={styles.featureTextCol}>
                    <Text style={styles.featureTitle}>Fees and dues</Text>
                    <Text style={styles.featureDesc}>
                      Automated reminders, instant receipts and fee tracking
                    </Text>
                  </View>
                </View>

                <View style={styles.featureRow}>
                  <View style={styles.featureIconBadge}>
                    <QrCode color={colors.primary} size={22} strokeWidth={2.2} />
                  </View>
                  <View style={styles.featureTextCol}>
                    <Text style={styles.featureTitle}>Attendance and QR</Text>
                    <Text style={styles.featureDesc}>
                      Touchless QR check-in and live daily attendance logs
                    </Text>
                  </View>
                </View>

                <View style={styles.featureRow}>
                  <View style={styles.featureIconBadge}>
                    <ShieldCheck color={colors.primary} size={22} strokeWidth={2.2} />
                  </View>
                  <View style={styles.featureTextCol}>
                    <Text style={styles.featureTitle}>Trainers with privacy</Text>
                    <Text style={styles.featureDesc}>
                      Staff management with strict phone number and member privacy
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Photo credit at bottom */}
            <View style={styles.creditRow}>
              <Text style={styles.creditText}>Gymholik Fitness Center</Text>
            </View>
          </View>
        </View>

        {/* Right Panel: 45%, solid background, vertically centered form */}
        <View style={styles.desktopRightPanel}>
          <ScrollView
            contentContainerStyle={styles.desktopRightScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.desktopRightInner}>
              <GymholikLogo size={48} style={styles.desktopRightLogo} variant="primary" />
              <Text style={styles.title}>{currentTitle}</Text>
              <Text style={styles.subtitle}>{currentSubtitle}</Text>

              {renderLoginForm(420)}
              {renderFooterLinks()}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 2. TABLET LAYOUT (640 to 1023): Photo background, dark overlay, centred card
  // ═════════════════════════════════════════════════════════════════════════════
  if (Platform.OS === 'web' && isTablet) {
    return (
      <View style={styles.tabletRoot}>
        <Image
          source={bgAsset}
          style={styles.tabletHeroImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={[
            colors.scrim,
            colors.scrim,
            colors.scrim,
          ]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          contentContainerStyle={styles.tabletScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.tabletCardWrapper}>
            <View style={styles.headerSection}>
              <GymholikLogo size={56} style={styles.logo} variant="primary" />
              <Text style={styles.title}>{currentTitle}</Text>
              <Text style={styles.subtitle}>{currentSubtitle}</Text>
            </View>

            {renderLoginForm(440)}
            {renderFooterLinks()}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 3. PHONE LAYOUT (below 640, or iOS/Android): Unchanged current mobile layout
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <Screen
      scrollable
      withHeroImage
      heroOpacity={0.88}
      keyboardAvoiding
      safeBottom={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header: Mint Logo + Welcome Back + Subtitle */}
      <View
        style={[
          styles.headerSection,
          otpSent && { marginBottom: isNarrowPhone ? 12 : 16 },
        ]}
      >
        <GymholikLogo
          size={otpSent ? (isNarrowPhone ? 40 : 48) : isNarrowPhone ? 56 : 68}
          style={[styles.logo, otpSent && { marginBottom: 8 }]}
          variant="primary"
        />
        <Text style={styles.title}>{currentTitle}</Text>
        <Text style={[styles.subtitle, otpSent && { marginBottom: 12 }]}>
          {currentSubtitle}
        </Text>
      </View>

      {/* Main Glass Card */}
      {renderLoginForm(layout.maxWidth.form)}
    </Screen>
  );
}

const makeStyles = (theme: ThemeValue) => {
  const colors = theme.colors;
  return StyleSheet.create({
    // ── Desktop Layout Styles (>= 1024) ────────────────────────────────────────
    desktopRoot: {
      flex: 1,
      flexDirection: 'row',
      width: '100%',
      height: '100%',
      backgroundColor: colors.bg,
      overflow: 'hidden',
    },
    desktopLeftPanel: {
      width: '55%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: colors.bg,
    },
    desktopHeroImage: {
      ...StyleSheet.absoluteFill,
      width: '100%',
      height: '100%',
      ...(Platform.OS === 'web'
        ? ({
            objectPosition: 'top',
            objectFit: 'cover',
          } as any)
        : {}),
    },
    desktopLeftContent: {
      flex: 1,
      paddingHorizontal: 56,
      paddingVertical: 44,
      justifyContent: 'space-between',
      zIndex: 1,
    },
    brandLockup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    brandName: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 0.5,
    },
    heroSection: {
      maxWidth: 520,
      marginTop: 'auto',
      marginBottom: 'auto',
      paddingVertical: 20,
    },
    heroHeadline: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 40,
      lineHeight: 48,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 12,
    },
    heroSubheadline: {
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 18,
      lineHeight: 26,
      color: colors.textSecondary,
      marginBottom: 32,
    },
    featuresList: {
      gap: 18,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    featureIconBadge: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureTextCol: {
      flex: 1,
    },
    featureTitle: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    featureDesc: {
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    creditRow: {
      paddingTop: 12,
    },
    creditText: {
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 12,
      color: colors.textSecondary,
    },
    desktopRightPanel: {
      width: '45%',
      height: '100%',
      backgroundColor: colors.bg,
    },
    desktopRightScroll: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 36,
    },
    desktopRightInner: {
      width: '100%',
      maxWidth: 420,
      alignItems: 'center',
    },
    desktopRightLogo: {
      marginBottom: theme.spacing.md,
    },

    // ── Tablet Layout Styles (640 - 1023) ──────────────────────────────────────
    tabletRoot: {
      flex: 1,
      width: '100%',
      height: '100%',
      backgroundColor: colors.bg,
      position: 'relative',
    },
    tabletHeroImage: {
      ...StyleSheet.absoluteFill,
      width: '100%',
      height: '100%',
      ...(Platform.OS === 'web'
        ? ({
            objectPosition: 'top',
            objectFit: 'cover',
          } as any)
        : {}),
    },
    tabletScrollContent: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 48,
    },
    tabletCardWrapper: {
      width: '100%',
      maxWidth: 440,
      alignItems: 'center',
    },

    // ── Phone Layout Styles (< 640) ───────────────────────────────────────────
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
      justifyContent: 'center',
    },
    headerSection: {
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
      width: '100%',
    },
    logo: {
      marginBottom: theme.spacing.md,
    },
    title: {
      ...theme.typography.h1,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 6,
    },
    subtitle: {
      ...theme.typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing.lg,
    },
    glassCard: {
      marginBottom: theme.spacing.md,
      alignSelf: 'center',
    },
    cardInner: {
      padding: 24,
    },
    stateTransitionContainer: {
      width: '100%',
    },
    phoneContainer: {
      width: '100%',
      marginBottom: 24,
    },
    phoneContainerReadOnly: {
      width: '100%',
      marginBottom: 16,
    },
    changeNumberBtn: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      flexShrink: 0,
      borderRadius: theme.radius.full,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
    },
    changeNumberText: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    primaryButtonWrapper: {
      width: '100%',
      marginTop: 0,
    },
    staffHelperText: {
      ...theme.typography.small,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: theme.spacing.md,
      lineHeight: 18,
    },

    // ── OTP Section Styles ────────────────────────────────────────────────────
    otpSection: {
      width: '100%',
    },
    otpHeaderRow: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    otpSectionLabel: {
      ...theme.typography.caption,
      color: colors.textSecondary,
      fontFamily: theme.fonts.headingMedium,
      fontWeight: '600',
    },
    devOtpBtn: {
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: theme.radius.sm,
    },
    devOtpHint: {
      ...theme.typography.small,
      fontFamily: theme.fonts.headingBold,
      fontWeight: '700',
      color: colors.primary,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.radius.sm,
      overflow: 'hidden',
    },
    otpWrapper: {
      position: 'relative',
      width: '100%',
      alignItems: 'center',
    },
    hiddenOtpInput: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
      opacity: 0.01,
      fontSize: 1,
      zIndex: 2,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
    },
    otpBoxesRow: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    otpBox: {
      flex: 1,
      maxWidth: 56,
      aspectRatio: 1,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    otpBoxFilled: {
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surfaceRaised,
    },
    otpBoxActive: {
      borderColor: colors.primary,
      borderWidth: 1.5,
      backgroundColor: colors.surfaceRaised,
      ...Platform.select({
        ios: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
          shadowColor: colors.primary,
        },
        web: {
          boxShadow: `0 0 10px ${colors.primary}66`,
        } as any,
      }),
    },
    otpBoxError: {
      borderColor: colors.danger,
      borderWidth: 1.5,
    },
    otpDigitText: {
      fontFamily: theme.fonts.headingBold,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      includeFontPadding: false,
    },
    otpCustomCaret: {
      position: 'absolute',
      width: 2,
      height: 24,
      borderRadius: 1,
      backgroundColor: colors.primary,
    },
    resendRow: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 16,
    },
    resendPrompt: {
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 13,
      color: colors.textSecondary,
    },
    resendCountdown: {
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 13,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    resendTouchTarget: {
      minHeight: 44,
      minWidth: 44,
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingVertical: 10,
      paddingHorizontal: 4,
    },
    resendLinkActive: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.chipDangerBg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: colors.danger,
      padding: 12,
      marginTop: 16,
      marginBottom: 0,
      width: '100%',
    },
    errorBannerText: {
      color: colors.chipDangerText,
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 13,
      lineHeight: 18,
      flex: 1,
    },
    verifyButtonWrapper: {
      width: '100%',
      marginTop: 24,
    },

    // ── Footer Links ──────────────────────────────────────────────────────────
    footerLinksRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: theme.spacing.md,
    },
    footerLinkTouch: {
      paddingVertical: 6,
      paddingHorizontal: 6,
    },
    footerLinkText: {
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 13,
      color: colors.textSecondary,
    },
    footerDivider: {
      color: colors.textSecondary,
      fontSize: 12,
    },
  });
};
