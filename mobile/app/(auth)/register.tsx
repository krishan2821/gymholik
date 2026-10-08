import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  AccessibilityInfo,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { z } from 'zod';
import {
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Check,
  Copy,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../../src/store/useAuthStore';
import { registerAndLogin, classifyError } from '../../src/api';
import { resolveBaseUrl } from '../../src/api/axiosConfig';
import { theme } from '../../src/theme/theme';
import { Screen } from '../../src/components/Screen';
import { GlassCard } from '../../src/components/GlassCard';
import { Button } from '../../src/components/Button';
import { GymholikLogo } from '../../src/components/GymholikLogo';

// ─── Constants ─────────────────────────────────────────────────────────────────
const CURSOR_COLOR = '#8EB69B';
const PHONE_RE = /^[6-9]\d{9}$/;
const HAS_NUMBER_RE = /\d/;

// ─── Role type ─────────────────────────────────────────────────────────────────
type Role = 'OWNER' | 'TRAINER';

// ─── Validation schemas ────────────────────────────────────────────────────────
const ownerSchema = z
  .object({
    gymName: z
      .string()
      .min(2, 'Gym name must be at least 2 characters')
      .max(100, 'Gym name is too long'),
    ownerName: z
      .string()
      .min(2, 'Your name must be at least 2 characters')
      .max(100, 'Name is too long'),
    ownerPhone: z
      .string()
      .regex(PHONE_RE, 'Enter a valid 10-digit mobile number starting with 6-9'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(HAS_NUMBER_RE, 'Password must contain at least one number'),
    confirmPassword: z.string(),
    agreedToTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must agree to continue' }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

const trainerSchema = z
  .object({
    gymCode: z
      .string()
      .min(4, 'Gym code must be at least 4 characters')
      .max(10, 'Gym code too long')
      .regex(/^[A-Z0-9]*$/, 'Gym code must be uppercase letters and numbers only'),
    ownerName: z
      .string()
      .min(2, 'Your name must be at least 2 characters')
      .max(100, 'Name is too long'),
    ownerPhone: z
      .string()
      .regex(PHONE_RE, 'Enter a valid 10-digit mobile number starting with 6-9'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(HAS_NUMBER_RE, 'Password must contain at least one number'),
    confirmPassword: z.string(),
    agreedToTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must agree to continue' }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type OwnerFormData = z.infer<typeof ownerSchema>;
type TrainerFormData = z.infer<typeof trainerSchema>;

// ─── Password rule row ────────────────────────────────────────────────────────
function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={styles.ruleRow}>
      {met ? (
        <CheckCircle2 size={14} color={theme.colors.primary} />
      ) : (
        <Circle size={14} color={theme.colors.textMuted} />
      )}
      <Text
        style={[
          styles.ruleText,
          { color: met ? theme.colors.primary : theme.colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Segmented Role Selector ──────────────────────────────────────────────────
function RoleSelector({
  value,
  onChange,
}: {
  value: Role;
  onChange: (v: Role) => void;
}) {
  return (
    <View style={styles.roleSelector}>
      <TouchableOpacity
        style={[styles.roleOption, value === 'OWNER' && styles.roleOptionActive]}
        onPress={() => onChange('OWNER')}
        activeOpacity={0.8}
        accessibilityRole="radio"
        accessibilityState={{ selected: value === 'OWNER' }}
        accessibilityLabel="I am a Gym Owner"
      >
        <Text
          style={[
            styles.roleOptionText,
            value === 'OWNER' && styles.roleOptionTextActive,
          ]}
        >
          Gym Owner
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.roleOption, value === 'TRAINER' && styles.roleOptionActive]}
        onPress={() => onChange('TRAINER')}
        activeOpacity={0.8}
        accessibilityRole="radio"
        accessibilityState={{ selected: value === 'TRAINER' }}
        accessibilityLabel="I am a Trainer"
      >
        <Text
          style={[
            styles.roleOptionText,
            value === 'TRAINER' && styles.roleOptionTextActive,
          ]}
        >
          Trainer
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const [selectedRole, setSelectedRole] = useState<Role>('OWNER');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [phoneFieldError, setPhoneFieldError] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Gym code debounced lookup (trainer only)
  const [gymCodeRaw, setGymCodeRaw] = useState('');
  const [gymLookupName, setGymLookupName] = useState<string | null>(null);
  const [gymLookupLoading, setGymLookupLoading] = useState(false);
  const gymLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ownerNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const gymNameRef = useRef<TextInput>(null);
  const gymCodeRef = useRef<TextInput>(null);

  const setAuthData = useAuthStore((state) => state.setAuthData);

  // ── Animations ─────────────────────────────────────────────────────────────
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
  }, [reduceMotion, cardFadeAnim, cardSlideAnim]);

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

  // ── Owner form ──────────────────────────────────────────────────────────────
  const ownerForm = useForm<OwnerFormData>({
    resolver: zodResolver(ownerSchema),
    defaultValues: {
      gymName: '',
      ownerName: '',
      ownerPhone: '',
      password: '',
      confirmPassword: '',
      agreedToTerms: undefined as any,
    },
  });

  // ── Trainer form ─────────────────────────────────────────────────────────────
  const trainerForm = useForm<TrainerFormData>({
    resolver: zodResolver(trainerSchema),
    defaultValues: {
      gymCode: '',
      ownerName: '',
      ownerPhone: '',
      password: '',
      confirmPassword: '',
      agreedToTerms: undefined as any,
    },
  });

  const activeForm = selectedRole === 'OWNER' ? ownerForm : trainerForm;
  const ownerPassword = ownerForm.watch('password') || '';
  const trainerPassword = trainerForm.watch('password') || '';
  const passwordValue = selectedRole === 'OWNER' ? ownerPassword : trainerPassword;
  const meetsLength = passwordValue.length >= 8;
  const meetsNumber = HAS_NUMBER_RE.test(passwordValue);

  // ── Gym code debounced lookup ───────────────────────────────────────────────
  const handleGymCodeChange = useCallback((raw: string) => {
    const upper = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setGymCodeRaw(upper);
    trainerForm.setValue('gymCode', upper, { shouldValidate: false });
    setGymLookupName(null);

    if (gymLookupTimer.current) clearTimeout(gymLookupTimer.current);

    if (upper.length >= 4) {
      setGymLookupLoading(true);
      gymLookupTimer.current = setTimeout(async () => {
        try {
          const baseUrl = resolveBaseUrl();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const res = await fetch(`${baseUrl}/api/gym/public?code=${encodeURIComponent(upper)}`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const json = await res.json();
            setGymLookupName(json?.data?.name || json?.data?.gymName || null);
          } else {
            setGymLookupName(null);
          }
        } catch {
          setGymLookupName(null);
        } finally {
          setGymLookupLoading(false);
        }
      }, 600);
    } else {
      setGymLookupLoading(false);
    }
  }, [trainerForm]);

  useEffect(() => {
    return () => {
      if (gymLookupTimer.current) clearTimeout(gymLookupTimer.current);
    };
  }, []);

  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [newGymCode, setNewGymCode] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);

  const copyGymCode = async () => {
    if (!newGymCode) return;
    await Clipboard.setStringAsync(newGymCode);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleContinue = () => {
    setSuccessModalVisible(false);
    router.replace('/(tabs)');
  };

  // ── Owner Submit ──────────────────────────────────────────────────────────
  const onOwnerSubmit = async (values: OwnerFormData) => {
    setServerError(null);
    setPhoneFieldError(null);

    try {
      const { gym, tokens } = await registerAndLogin({
        gymName: values.gymName.trim(),
        ownerName: values.ownerName.trim(),
        ownerPhone: values.ownerPhone,
        password: values.password,
      });

      await setAuthData(
        tokens.accessToken,
        tokens.refreshToken,
        tokens.role,
        tokens.userId,
        tokens.gymId ?? '',
        gym.gymCode
      );

      setNewGymCode(gym.gymCode);
      setSuccessModalVisible(true);
    } catch (error: unknown) {
      const apiErr = classifyError(error);

      if (
        apiErr.errorCode === 'PHONE_ALREADY_EXISTS' ||
        (apiErr.status === 409 && apiErr.message.toLowerCase().includes('mobile'))
      ) {
        setPhoneFieldError('This mobile number is already registered. Try signing in.');
      } else {
        setServerError(apiErr.message);
      }
      triggerShake();
    }
  };

  // ── Trainer Submit ────────────────────────────────────────────────────────
  const onTrainerSubmit = async (values: TrainerFormData) => {
    setServerError(null);
    setPhoneFieldError(null);

    try {
      const { gym, tokens } = await registerAndLogin({
        gymName: gymLookupName || values.gymCode,
        ownerName: values.ownerName.trim(),
        ownerPhone: values.ownerPhone,
        password: values.password,
      });

      await setAuthData(
        tokens.accessToken,
        tokens.refreshToken,
        tokens.role,
        tokens.userId,
        tokens.gymId ?? '',
        gym.gymCode
      );

      router.replace('/(tabs)');
    } catch (error: unknown) {
      const apiErr = classifyError(error);

      if (
        apiErr.errorCode === 'PHONE_ALREADY_EXISTS' ||
        (apiErr.status === 409 && apiErr.message.toLowerCase().includes('mobile'))
      ) {
        setPhoneFieldError('This mobile number is already registered. Try signing in.');
      } else {
        setServerError(apiErr.message);
      }
      triggerShake();
    }
  };

  const onSubmit = selectedRole === 'OWNER'
    ? ownerForm.handleSubmit(onOwnerSubmit, () => triggerShake())
    : trainerForm.handleSubmit(onTrainerSubmit, () => triggerShake());

  const isSubmitting = selectedRole === 'OWNER'
    ? ownerForm.formState.isSubmitting
    : trainerForm.formState.isSubmitting;
  const errors = selectedRole === 'OWNER'
    ? ownerForm.formState.errors
    : trainerForm.formState.errors;

  const bottomPadding = insets.bottom + 24;

  return (
    <Screen
      scrollable
      withHeroImage
      heroOpacity={0.85}
      keyboardAvoiding
      contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding }]}
    >
      {/* Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace('/(auth)/login')}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back to sign in"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Brand Header */}
      <View style={styles.brandBlock}>
        <GymholikLogo size={58} />
        <Text style={styles.appName}>Gymholik</Text>
        <Text style={styles.appTagline}>Manage your gym, all in one place</Text>
      </View>

      {/* Animated Card */}
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
          <Text style={styles.cardTitle}>Create your account</Text>
          <Text style={styles.cardSubtitle}>
            {selectedRole === 'OWNER'
              ? 'Start your 14-day free trial. No card required.'
              : 'Join your gym as a trainer.'}
          </Text>

          {/* Role Selector - very top of form */}
          <Text style={styles.roleLabel}>I am a...</Text>
          <RoleSelector
            value={selectedRole}
            onChange={(role) => {
              setSelectedRole(role);
              setServerError(null);
              setPhoneFieldError(null);
              setGymLookupName(null);
              setGymCodeRaw('');
            }}
          />

          {/* Error Banner */}
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

          {/* OWNER: Gym name */}
          {selectedRole === 'OWNER' && (
            <>
              <Text style={styles.label}>Gym name</Text>
              <Controller
                control={ownerForm.control}
                name="gymName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View
                    style={[
                      styles.inputRow,
                      ownerForm.formState.errors.gymName && styles.inputRowError,
                    ]}
                  >
                    <TextInput
                      ref={gymNameRef}
                      style={styles.inputField}
                      placeholder="e.g. FitZone Gym"
                      placeholderTextColor={theme.colors.textMuted}
                      returnKeyType="next"
                      autoFocus
                      autoCapitalize="words"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      onSubmitEditing={() => ownerNameRef.current?.focus()}
                      accessibilityLabel="Gym name"
                      cursorColor={CURSOR_COLOR}
                      selectionColor={CURSOR_COLOR}
                    />
                  </View>
                )}
              />
              {ownerForm.formState.errors.gymName && (
                <Text style={styles.fieldError}>
                  {ownerForm.formState.errors.gymName.message}
                </Text>
              )}
            </>
          )}

          {/* TRAINER: Gym code */}
          {selectedRole === 'TRAINER' && (
            <>
              <Text style={styles.label}>Gym code</Text>
              <View
                style={[
                  styles.inputRow,
                  trainerForm.formState.errors.gymCode && styles.inputRowError,
                ]}
              >
                <TextInput
                  ref={gymCodeRef}
                  style={styles.inputField}
                  placeholder="e.g. GYM123"
                  placeholderTextColor={theme.colors.textMuted}
                  returnKeyType="next"
                  autoFocus
                  autoCapitalize="characters"
                  autoCorrect={false}
                  onChangeText={handleGymCodeChange}
                  value={gymCodeRaw}
                  onSubmitEditing={() => ownerNameRef.current?.focus()}
                  accessibilityLabel="Gym code"
                  cursorColor={CURSOR_COLOR}
                  selectionColor={CURSOR_COLOR}
                />
                {gymLookupLoading && (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.primary}
                    style={styles.lookupSpinner}
                  />
                )}
              </View>
              {gymLookupName && !gymLookupLoading && (
                <Text style={styles.gymLookupSuccess}>
                  Joining: {gymLookupName}
                </Text>
              )}
              {trainerForm.formState.errors.gymCode && (
                <Text style={styles.fieldError}>
                  {trainerForm.formState.errors.gymCode.message}
                </Text>
              )}
            </>
          )}

          {/* Your name */}
          <Text style={[styles.label, { marginTop: 16 }]}>Your name</Text>
          <Controller
            control={activeForm.control as any}
            name="ownerName"
            render={({ field: { onChange, onBlur, value } }) => (
              <View
                style={[
                  styles.inputRow,
                  (errors as any).ownerName && styles.inputRowError,
                ]}
              >
                <TextInput
                  ref={ownerNameRef}
                  style={styles.inputField}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor={theme.colors.textMuted}
                  returnKeyType="next"
                  autoCapitalize="words"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  onSubmitEditing={() => phoneRef.current?.focus()}
                  accessibilityLabel="Your name"
                  cursorColor={CURSOR_COLOR}
                  selectionColor={CURSOR_COLOR}
                />
              </View>
            )}
          />
          {(errors as any).ownerName && (
            <Text style={styles.fieldError}>{(errors as any).ownerName.message}</Text>
          )}

          {/* Mobile number */}
          <Text style={[styles.label, { marginTop: 16 }]}>Mobile number</Text>
          <Controller
            control={activeForm.control as any}
            name="ownerPhone"
            render={({ field: { onChange, onBlur, value } }) => (
              <View
                style={[
                  styles.inputRow,
                  ((errors as any).ownerPhone || phoneFieldError) && styles.inputRowError,
                ]}
              >
                <View style={styles.prefixBox}>
                  <Text style={styles.prefix}>+91</Text>
                  <View style={styles.prefixDivider} />
                </View>
                <TextInput
                  ref={phoneRef}
                  style={styles.inputField}
                  placeholder="98765 43210"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={10}
                  returnKeyType="next"
                  onBlur={onBlur}
                  onChangeText={(v) => {
                    setPhoneFieldError(null);
                    onChange(v.replace(/\D/g, ''));
                  }}
                  value={value}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  accessibilityLabel="Mobile number"
                  cursorColor={CURSOR_COLOR}
                  selectionColor={CURSOR_COLOR}
                />
              </View>
            )}
          />
          <Text style={styles.helperText}>This number will be your login ID.</Text>
          {((errors as any).ownerPhone?.message || phoneFieldError) && (
            <Text style={styles.fieldError}>
              {(errors as any).ownerPhone?.message ?? phoneFieldError}
            </Text>
          )}

          {/* Password */}
          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <Controller
            control={activeForm.control as any}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <View
                style={[
                  styles.inputRow,
                  (errors as any).password && styles.inputRowError,
                ]}
              >
                <TextInput
                  ref={passwordRef}
                  style={[styles.inputField, styles.passwordField]}
                  placeholder="Min 8 characters"
                  placeholderTextColor={theme.colors.textMuted}
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  accessibilityLabel="Password"
                  cursorColor={CURSOR_COLOR}
                  selectionColor={CURSOR_COLOR}
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
          <View style={styles.rulesBlock}>
            <PasswordRule met={meetsLength} label="At least 8 characters" />
            <PasswordRule met={meetsNumber} label="At least one number" />
          </View>
          {(errors as any).password && (
            <Text style={styles.fieldError}>{(errors as any).password.message}</Text>
          )}

          {/* Confirm password */}
          <Text style={[styles.label, { marginTop: 16 }]}>Confirm password</Text>
          <Controller
            control={activeForm.control as any}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <View
                style={[
                  styles.inputRow,
                  (errors as any).confirmPassword && styles.inputRowError,
                ]}
              >
                <TextInput
                  ref={confirmRef}
                  style={[styles.inputField, styles.passwordField]}
                  placeholder="Re-enter your password"
                  placeholderTextColor={theme.colors.textMuted}
                  secureTextEntry={!showConfirm}
                  returnKeyType="done"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  onSubmitEditing={onSubmit}
                  accessibilityLabel="Confirm password"
                  cursorColor={CURSOR_COLOR}
                  selectionColor={CURSOR_COLOR}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirm((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.eyeBtn}
                  accessibilityLabel={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? (
                    <EyeOff color={theme.colors.primary} size={20} />
                  ) : (
                    <Eye color={theme.colors.textMuted} size={20} />
                  )}
                </TouchableOpacity>
              </View>
            )}
          />
          {(errors as any).confirmPassword && (
            <Text style={styles.fieldError}>{(errors as any).confirmPassword.message}</Text>
          )}

          {/* Terms */}
          <Controller
            control={activeForm.control as any}
            name="agreedToTerms"
            render={({ field: { onChange, value } }) => (
              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => onChange(value ? (undefined as any) : true)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!value }}
                accessibilityLabel="Agree to Terms and Privacy Policy"
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: value ? theme.colors.primary : 'transparent',
                      borderColor: (errors as any).agreedToTerms
                        ? theme.colors.error
                        : value
                        ? theme.colors.primary
                        : theme.colors.border,
                    },
                  ]}
                >
                  {value && (
                    <Check size={12} color={theme.colors.textOnPrimary} strokeWidth={3} />
                  )}
                </View>
                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text style={styles.termsLink}>Terms and Privacy Policy</Text>
                </Text>
              </TouchableOpacity>
            )}
          />
          {(errors as any).agreedToTerms && (
            <Text style={[styles.fieldError, { marginTop: 2 }]}>
              {(errors as any).agreedToTerms.message}
            </Text>
          )}

          {/* Submit */}
          <View style={styles.submitWrapper}>
            <Button
              title={selectedRole === 'OWNER' ? 'Start free trial' : 'Start'}
              onPress={onSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
              variant="primary"
              size="lg"
            />
          </View>
        </GlassCard>

        {/* Sign in link */}
        <View style={styles.signinRow}>
          <Text style={styles.signinText}>Already have an account? </Text>
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            accessibilityRole="link"
            accessibilityLabel="Sign in"
            style={styles.signinTouch}
          >
            <Text style={styles.signinLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Success Modal */}
      <Modal visible={successModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.successModalCard} intensity={40}>
            <View style={styles.successCelebrationCircle}>
              <Text style={{ fontSize: 36 }}>🎉</Text>
            </View>

            <Text style={styles.successTitle}>Gym Registered Successfully!</Text>
            <Text style={styles.successSubtitle}>
              Welcome to Gymholik. Aapka gym account create ho gaya hai.
            </Text>

            <View style={styles.codeContainer}>
              <Text style={styles.codeLabel}>Aapka Gym Code</Text>
              <TouchableOpacity
                style={styles.codeBox}
                onPress={copyGymCode}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Copy gym code"
              >
                <Text style={styles.codeText}>{newGymCode}</Text>
                <View style={[styles.copyBadge, copiedCode && styles.copyBadgeSuccess]}>
                  {copiedCode ? (
                    <>
                      <Check size={14} color={theme.colors.textOnPrimary} />
                      <Text style={styles.copyBadgeText}>Copied!</Text>
                    </>
                  ) : (
                    <>
                      <Copy size={14} color={theme.colors.textOnPrimary} />
                      <Text style={styles.copyBadgeText}>Tap to Copy</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            <Text style={styles.successNotice}>
              Is code ko save kar lein. Logout hone ke baad login karne aur apne staff ke
              sath share karne ke liye yeh zaroori hai.
            </Text>

            <Button
              title="Continue to Dashboard"
              onPress={handleContinue}
              variant="primary"
              size="lg"
            />
          </GlassCard>
        </View>
      </Modal>
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  header: {
    marginBottom: theme.spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.glow,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  appName: {
    ...theme.typography.h1,
    color: theme.colors.text,
    letterSpacing: 0.5,
    marginTop: theme.spacing.xs,
  },
  appTagline: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  cardWrapper: {
    width: '100%',
  },
  card: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  cardTitle: {
    ...theme.typography.h1,
    color: theme.colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  roleLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '600',
    marginBottom: 8,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: theme.spacing.lg,
    backgroundColor: 'rgba(11, 43, 38, 0.65)',
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 4,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleOptionActive: {
    backgroundColor: theme.colors.primary,
  },
  roleOptionText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
  },
  roleOptionTextActive: {
    color: theme.colors.textOnPrimary,
  },
  lookupSpinner: {
    marginRight: 12,
  },
  gymLookupSuccess: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 12,
    color: theme.colors.primary,
    marginTop: 5,
    marginLeft: 2,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.40)',
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
    padding: 4,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(11, 43, 38, 0.65)',
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
    fontWeight: '700',
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
    paddingVertical: 16,
  },
  eyeBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  helperText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
    marginTop: 4,
    marginLeft: 2,
  },
  fieldError: {
    ...theme.typography.small,
    color: theme.colors.error,
    marginTop: 4,
    marginLeft: 2,
  },
  rulesBlock: {
    marginTop: 8,
    gap: 4,
    paddingLeft: 2,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ruleText: {
    ...theme.typography.small,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    minHeight: 44,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  termsText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    flex: 1,
  },
  termsLink: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingMedium,
    fontWeight: '600',
  },
  submitWrapper: {
    marginTop: theme.spacing.xl,
  },
  signinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  signinTouch: {
    minHeight: 44,
    justifyContent: 'center',
  },
  signinText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  signinLink: {
    ...theme.typography.body,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingBold,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  successModalCard: {
    width: '100%',
    padding: theme.spacing.xl,
    borderRadius: theme.radius.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  successCelebrationCircle: {
    width: 68,
    height: 68,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    marginBottom: theme.spacing.md,
  },
  successTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 22,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  successSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  codeContainer: {
    width: '100%',
    backgroundColor: theme.colors.raised,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  codeLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 6,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  codeText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 22,
    color: theme.colors.text,
    letterSpacing: 2,
  },
  copyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  copyBadgeSuccess: {
    backgroundColor: theme.colors.primary,
  },
  copyBadgeText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 12,
    color: theme.colors.textOnPrimary,
    fontWeight: '700',
  },
  successNotice: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: theme.spacing.xl,
  },
});
