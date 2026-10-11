import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  BackHandler,
  Modal,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import {
  ArrowLeft,
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Sparkles,
} from 'lucide-react-native';

import { completeRegistration, classifyError } from '../../src/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useRegistrationFormStore } from '../../src/store/useRegistrationFormStore';
import { getHomeRouteForRole } from '../../src/navigation/tabsByRole';
import { theme } from '../../src/theme/theme';
import { Screen } from '../../src/components/Screen';
import { GlassCard } from '../../src/components/GlassCard';
import { GymholikLogo } from '../../src/components/GymholikLogo';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { StepProgress } from '../../src/components/StepProgress';
import { SearchableSelect } from '../../src/components/SearchableSelect';

import { GYM_TYPE_OPTIONS, GymTypeCode } from '../../src/data/gymTypes';
import {
  LEGAL_DOC_CONFIGS,
  LEGAL_DOC_OPTIONS,
  LegalDocType,
  validateLegalDoc,
} from '../../src/data/legalDocs';
import { INDIA_STATE_OPTIONS } from '../../src/data/indiaStates';
import { getDistrictsForState } from '../../src/data/indiaDistricts';
import { usePincodeLookup } from '../../src/hooks/usePincodeLookup';
import {
  step1Schema,
  step2Schema,
  step3Schema,
  getStepForField,
  formatGymCode,
} from '../../src/utils/registrationValidation';
import { REGISTER } from '../../src/constants/strings';

function formatVerifiedPhone(phone?: string | null): string {
  if (!phone) return '+91 verified';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) {
    const prefix = clean.slice(0, 2);
    return `+91 ${prefix}xxx xxxxx verified`;
  }
  return `+91 ${phone} verified`;
}

export default function OwnerRegistrationScreen() {
  const registrationToken = useAuthStore((s) => s.registrationToken);
  const registrationPhone = useAuthStore((s) => s.registrationPhone);
  const clearRegistrationSession = useAuthStore((s) => s.clearRegistrationSession);
  const setAuthData = useAuthStore((s) => s.setAuthData);

  // ── Form Store (In-Memory Zustand) ─────────────────────────────────────────
  const {
    currentStep,
    setStep,
    gymName,
    gymType,
    ownerName,
    email,
    legalIdType,
    legalIdNumber,
    addressLine1,
    addressLine2,
    state: selectedState,
    district: selectedDistrict,
    pincode,
    acceptedTerms,
    setField,
    clearLegalDoc,
    resetForm,
  } = useRegistrationFormStore();

  // ── Local Validation / Error States ────────────────────────────────────────
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Welcome Sheet Modal State ─────────────────────────────────────────────
  const [welcomeSheetVisible, setWelcomeSheetVisible] = useState(false);
  const [registeredGymCode, setRegisteredGymCode] = useState<string>('');
  const [registeredUserRole, setRegisteredUserRole] = useState<string>('OWNER');

  // ── Districts State for Chosen State ──────────────────────────────────────
  const [districtOptions, setDistrictOptions] = useState<{ label: string; value: string }[]>([]);
  const [districtDatasetMissing, setDistrictDatasetMissing] = useState(false);

  // ── Accessibility & Animation ──────────────────────────────────────────────
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  // ── Refs & Locks ──────────────────────────────────────────────────────────
  const ownerNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const legalNumberRef = useRef<TextInput>(null);
  const addressLine2Ref = useRef<TextInput>(null);
  const pincodeRef = useRef<TextInput>(null);
  const submittingLockRef = useRef(false);
  const completedSuccessRef = useRef(false);

  // ── Pincode Lookup Hook ───────────────────────────────────────────────────
  const { suggestion: pincodeSuggestion } = usePincodeLookup(pincode);

  // Pre-fill state & district only if they are currently empty
  useEffect(() => {
    if (pincodeSuggestion) {
      if (!selectedState && pincodeSuggestion.state) {
        setField('state', pincodeSuggestion.state);
      }
      if (!selectedDistrict && pincodeSuggestion.district) {
        setField('district', pincodeSuggestion.district);
      }
    }
  }, [pincodeSuggestion, selectedState, selectedDistrict, setField]);

  // ── Load Districts when State Changes ─────────────────────────────────────
  useEffect(() => {
    let active = true;
    if (!selectedState) {
      setDistrictOptions([]);
      setDistrictDatasetMissing(false);
      return;
    }

    getDistrictsForState(selectedState).then((result) => {
      if (!active) return;
      if (result.isDatasetMissing) {
        setDistrictDatasetMissing(true);
        setDistrictOptions([]);
      } else {
        setDistrictDatasetMissing(false);
        setDistrictOptions(result.districts.map((d) => ({ label: d, value: d })));
      }
    });

    return () => {
      active = false;
    };
  }, [selectedState]);

  // ── Auth Guard: Return to Login if Token Missing ──────────────────────────
  useEffect(() => {
    if (!registrationToken && !completedSuccessRef.current) {
      router.replace('/(auth)/login');
    }
  }, [registrationToken]);

  // ── Back Button Handling ──────────────────────────────────────────────────
  const handleBackPress = useCallback(() => {
    if (submittingLockRef.current || welcomeSheetVisible) return;

    if (currentStep > 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setFieldErrors({});
      setBannerError(null);
      setStep(currentStep - 1);
      return;
    }

    // Step 1: Confirmation before returning to Login
    Alert.alert(REGISTER.BACK_CONFIRM_TITLE, REGISTER.BACK_CONFIRM_MESSAGE, [
      {
        text: REGISTER.BACK_CONFIRM_STAY,
        style: 'cancel',
      },
      {
        text: REGISTER.BACK_CONFIRM_LEAVE,
        style: 'destructive',
        onPress: () => {
          clearRegistrationSession();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }, [currentStep, setStep, clearRegistrationSession, welcomeSheetVisible]);

  // Android hardware back handler
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });
    return () => sub.remove();
  }, [handleBackPress]);

  // ── Step 1: Next Handler ──────────────────────────────────────────────────
  const handleStep1Next = () => {
    setBannerError(null);
    setFieldErrors({});

    const result = step1Schema.safeParse({
      gymName,
      gymType,
      ownerName,
      email: email.trim() || undefined,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (!errors[path]) errors[path] = issue.message;
      });
      setFieldErrors(errors);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setStep(2);
  };

  // ── Step 2: Next Handler ──────────────────────────────────────────────────
  const handleStep2Next = () => {
    setBannerError(null);
    setFieldErrors({});

    const result = step2Schema.safeParse({
      legalIdType: legalIdType || undefined,
      legalIdNumber: legalIdNumber.trim() || undefined,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (!errors[path]) errors[path] = issue.message;
      });
      setFieldErrors(errors);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setStep(3);
  };

  const handleSkipStep2 = () => {
    clearLegalDoc();
    setFieldErrors({});
    setBannerError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setStep(3);
  };

  // ── Step 3: Complete Registration ─────────────────────────────────────────
  const handleCompleteRegistration = async () => {
    if (submittingLockRef.current) return;

    setBannerError(null);
    setFieldErrors({});

    const result = step3Schema.safeParse({
      addressLine1,
      addressLine2: addressLine2.trim() || undefined,
      state: selectedState,
      district: selectedDistrict,
      pincode,
      acceptedTerms,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (!errors[path]) errors[path] = issue.message;
      });
      setFieldErrors(errors);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    if (!registrationToken) {
      Toast.show({
        type: 'error',
        text1: REGISTER.SESSION_EXPIRED_MSG,
      });
      router.replace({
        pathname: '/(auth)/login',
        params: { error: REGISTER.SESSION_EXPIRED_MSG },
      });
      return;
    }

    submittingLockRef.current = true;
    setIsSubmitting(true);

    try {
      // Body payload per spec: phone is strictly omitted
      const payload = {
        gymName: gymName.trim(),
        gymType: gymType as string,
        ownerName: ownerName.trim(),
        email: email.trim().length > 0 ? email.trim() : undefined,
        legalIdType: legalIdType.trim().length > 0 ? legalIdType : undefined,
        legalIdNumber:
          legalIdNumber.trim().length > 0 ? legalIdNumber.trim().toUpperCase() : undefined,
        address: {
          line1: addressLine1.trim(),
          line2: addressLine2.trim().length > 0 ? addressLine2.trim() : undefined,
          state: selectedState.trim(),
          district: selectedDistrict.trim(),
          pincode: pincode.trim(),
        },
        acceptedTerms: true,
        termsVersion: '2026-v1',
      };

      const response = await completeRegistration(payload, registrationToken);
      const data = response.data;

      if (!data?.accessToken || !data?.refreshToken || !data?.user) {
        throw new Error('Incomplete registration response');
      }

      completedSuccessRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      const { accessToken, refreshToken, user, gym } = data;
      const code = gym?.gymCode || '';

      await setAuthData(
        accessToken,
        refreshToken,
        user.role,
        user.id,
        user.gymId ?? '',
        user.name,
        registrationPhone ?? undefined,
        gym?.name ?? user.gymName ?? gymName.trim()
      );

      setRegisteredGymCode(code);
      setRegisteredUserRole(user.role);
      setWelcomeSheetVisible(true);
    } catch (err: unknown) {
      const apiErr = classifyError(err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});

      // Expired or invalid registration token: return to Login, retaining form values in store
      if (
        apiErr.status === 401 ||
        apiErr.status === 403 ||
        apiErr.errorCode === 'TOKEN_EXPIRED' ||
        apiErr.errorCode === 'INVALID_TOKEN' ||
        apiErr.errorCode === 'UNAUTHORIZED'
      ) {
        clearRegistrationSession();
        Toast.show({
          type: 'error',
          text1: REGISTER.SESSION_EXPIRED_MSG,
        });
        router.replace({
          pathname: '/(auth)/login',
          params: { error: REGISTER.SESSION_EXPIRED_MSG },
        });
        return;
      }

      // 409 Already registered
      if (
        apiErr.status === 409 ||
        apiErr.errorCode === 'PHONE_ALREADY_EXISTS' ||
        apiErr.errorCode === 'PHONE_ALREADY_REGISTERED'
      ) {
        setBannerError(REGISTER.ERRORS.ALREADY_REGISTERED);
        return;
      }

      // Network error
      if (!apiErr.status || apiErr.errorCode === 'NETWORK_ERROR') {
        setBannerError(REGISTER.ERRORS.NETWORK);
        return;
      }

      // Server field validation errors: map to fields and jump to step of first error
      if (apiErr.fieldErrors && Object.keys(apiErr.fieldErrors).length > 0) {
        const mappedErrors: Record<string, string> = {};
        let firstStepToJump: number | null = null;

        for (const [key, msg] of Object.entries(apiErr.fieldErrors)) {
          // Normalize dot-notation e.g. address.line1 -> addressLine1
          const normKey = key.includes('.') ? key.split('.').pop()! : key;
          mappedErrors[normKey] = msg;
          mappedErrors[key] = msg;

          const targetStep = getStepForField(key);
          if (firstStepToJump === null || targetStep < firstStepToJump) {
            firstStepToJump = targetStep;
          }
        }

        setFieldErrors(mappedErrors);

        if (firstStepToJump !== null && firstStepToJump !== currentStep) {
          setStep(firstStepToJump);
        }
      }

      setBannerError(apiErr.message || REGISTER.ERRORS.GENERIC);
    } finally {
      setIsSubmitting(false);
      submittingLockRef.current = false;
    }
  };

  // ── Copy Gym Code from Welcome Sheet ──────────────────────────────────────
  const handleCopyGymCode = async () => {
    if (!registeredGymCode) return;
    await Clipboard.setStringAsync(registeredGymCode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Toast.show({
      type: 'success',
      text1: REGISTER.WELCOME_SHEET.COPIED_TOAST,
    });
  };

  // ── Navigate to Dashboard & Clean Up ──────────────────────────────────────
  const handleGoToDashboard = () => {
    setWelcomeSheetVisible(false);
    resetForm();
    const destination = getHomeRouteForRole(registeredUserRole);
    router.replace(destination as any);
  };

  // Active legal doc config for Step 2
  const activeLegalDocConfig = legalIdType ? LEGAL_DOC_CONFIGS[legalIdType as LegalDocType] : null;

  return (
    <Screen
      scrollable
      withHeroImage
      heroOpacity={0.85}
      keyboardAvoiding
      safeBottom={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Top Bar with Back Button */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={handleBackPress}
          disabled={isSubmitting}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={theme.colors.text} />
        </TouchableOpacity>

        {/* Read-only Verified Phone Badge at the top */}
        <View style={styles.verifiedPhoneBadge}>
          <CheckCircle2 size={15} color={theme.colors.primary} />
          <Text style={styles.verifiedPhoneText}>
            {formatVerifiedPhone(registrationPhone)}
          </Text>
        </View>
      </View>

      {/* StepProgress on top */}
      <View style={styles.progressContainer}>
        <StepProgress currentStep={currentStep} totalSteps={3} />
      </View>

      {/* Header Section */}
      <View style={styles.headerSection}>
        <GymholikLogo size={52} style={styles.logo} />
        <Text style={styles.title}>
          {currentStep === 1
            ? REGISTER.STEP_1_TITLE
            : currentStep === 2
            ? REGISTER.STEP_2_TITLE
            : REGISTER.STEP_3_TITLE}
        </Text>
        <Text style={styles.subtitle}>
          {currentStep === 1
            ? REGISTER.STEP_1_SUBTITLE
            : currentStep === 2
            ? REGISTER.STEP_2_SUBTITLE
            : REGISTER.STEP_3_SUBTITLE}
        </Text>
      </View>

      {/* Main Glass Card Form Container */}
      <GlassCard style={styles.glassCard} contentStyle={styles.cardInner}>
        {/* Coral Error Banner */}
        {bannerError && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <AlertCircle color={theme.colors.error} size={18} />
            <Text style={styles.errorBannerText}>{bannerError}</Text>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 1: Gym details
           ══════════════════════════════════════════════════════════════════════ */}
        {currentStep === 1 && (
          <View style={styles.stepBlock}>
            {/* Gym Name (Required) */}
            <Input
              label={REGISTER.GYM_NAME_LABEL}
              placeholder={REGISTER.GYM_NAME_PLACEHOLDER_NEW}
              value={gymName}
              onChangeText={(text) => {
                setField('gymName', text);
                setBannerError(null);
                if (fieldErrors.gymName) {
                  setFieldErrors((prev) => ({ ...prev, gymName: '' }));
                }
              }}
              autoFocus
              autoCapitalize="words"
              returnKeyType="next"
              maxLength={80}
              editable={!isSubmitting}
              error={fieldErrors.gymName}
            />

            {/* Gym Type (SearchableSelect with 7 options) */}
            <SearchableSelect
              label={REGISTER.GYM_TYPE_LABEL}
              placeholder={REGISTER.GYM_TYPE_PLACEHOLDER}
              value={gymType}
              options={GYM_TYPE_OPTIONS}
              onChange={(code) => {
                setField('gymType', code as GymTypeCode);
                setBannerError(null);
                if (fieldErrors.gymType) {
                  setFieldErrors((prev) => ({ ...prev, gymType: '' }));
                }
              }}
              error={fieldErrors.gymType}
            />

            {/* Your Name (Required) */}
            <Input
              ref={ownerNameRef}
              label={REGISTER.OWNER_NAME_LABEL}
              placeholder={REGISTER.OWNER_NAME_PLACEHOLDER}
              value={ownerName}
              onChangeText={(text) => {
                setField('ownerName', text);
                setBannerError(null);
                if (fieldErrors.ownerName) {
                  setFieldErrors((prev) => ({ ...prev, ownerName: '' }));
                }
              }}
              autoCapitalize="words"
              returnKeyType="next"
              maxLength={80}
              editable={!isSubmitting}
              onSubmitEditing={() => emailRef.current?.focus()}
              error={fieldErrors.ownerName}
            />

            {/* Email (Optional, Validated) */}
            <Input
              ref={emailRef}
              label={REGISTER.EMAIL_LABEL}
              placeholder={REGISTER.EMAIL_PLACEHOLDER}
              value={email}
              onChangeText={(text) => {
                setField('email', text);
                setBannerError(null);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: '' }));
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              maxLength={150}
              editable={!isSubmitting}
              error={fieldErrors.email}
            />

            <View style={styles.actionRow}>
              <Button
                title={REGISTER.NEXT_BTN}
                onPress={handleStep1Next}
                size="lg"
                style={styles.flexBtn}
              />
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 2: Business registration (optional)
           ══════════════════════════════════════════════════════════════════════ */}
        {currentStep === 2 && (
          <View style={styles.stepBlock}>
            {/* Document Type Selector */}
            <SearchableSelect
              label={REGISTER.LEGAL_DOC_TYPE_LABEL}
              placeholder={REGISTER.LEGAL_DOC_PLACEHOLDER}
              value={legalIdType}
              options={LEGAL_DOC_OPTIONS}
              onChange={(val) => {
                setField('legalIdType', val as LegalDocType);
                setField('legalIdNumber', ''); // Changing type clears number
                setBannerError(null);
                setFieldErrors({});
                setTimeout(() => legalNumberRef.current?.focus(), 150);
              }}
              error={fieldErrors.legalIdType}
            />

            {/* Document Number Input (Shown when a type is chosen) */}
            {activeLegalDocConfig && (
              <Input
                ref={legalNumberRef}
                label={activeLegalDocConfig.label}
                placeholder={activeLegalDocConfig.placeholder}
                value={legalIdNumber}
                onChangeText={(text) => {
                  const formatted = activeLegalDocConfig.autoUppercase
                    ? text.toUpperCase()
                    : text;
                  setField('legalIdNumber', formatted);
                  setBannerError(null);
                  if (fieldErrors.legalIdNumber) {
                    setFieldErrors((prev) => ({ ...prev, legalIdNumber: '' }));
                  }
                }}
                keyboardType={activeLegalDocConfig.keyboardType}
                maxLength={activeLegalDocConfig.maxLength}
                autoCapitalize={activeLegalDocConfig.autoCapitalize}
                autoCorrect={false}
                helperText={activeLegalDocConfig.hintText}
                error={fieldErrors.legalIdNumber}
              />
            )}

            {/* Helper Note */}
            <Text style={styles.helperTextNote}>
              {REGISTER.LEGAL_DOC_HELPER_TEXT}
            </Text>

            {/* Step 2 Buttons: Next and Clearly Visible Skip Button */}
            <View style={styles.actionRowColumn}>
              <Button
                title={REGISTER.NEXT_BTN}
                onPress={handleStep2Next}
                size="lg"
                style={styles.fullWidthBtn}
              />
              <TouchableOpacity
                onPress={handleSkipStep2}
                style={styles.skipBtn}
                accessibilityRole="button"
                accessibilityLabel={REGISTER.SKIP_FOR_NOW}
              >
                <Text style={styles.skipBtnText}>{REGISTER.SKIP_FOR_NOW}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 3: Gym address
           ══════════════════════════════════════════════════════════════════════ */}
        {currentStep === 3 && (
          <View style={styles.stepBlock}>
            {/* Address Line 1 (Required) */}
            <Input
              label={REGISTER.ADDRESS.LINE1_LABEL}
              placeholder={REGISTER.ADDRESS_LINE1_PLACEHOLDER}
              value={addressLine1}
              onChangeText={(text) => {
                setField('addressLine1', text);
                setBannerError(null);
                if (fieldErrors.addressLine1 || fieldErrors['address.line1']) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    addressLine1: '',
                    'address.line1': '',
                  }));
                }
              }}
              autoCapitalize="words"
              maxLength={120}
              editable={!isSubmitting}
              error={fieldErrors.addressLine1 || fieldErrors['address.line1']}
            />

            {/* Address Line 2 (Optional) */}
            <Input
              ref={addressLine2Ref}
              label={REGISTER.ADDRESS.LINE2_LABEL}
              placeholder={REGISTER.ADDRESS_LINE2_PLACEHOLDER}
              value={addressLine2}
              onChangeText={(text) => setField('addressLine2', text)}
              autoCapitalize="words"
              maxLength={120}
              editable={!isSubmitting}
              error={fieldErrors.addressLine2 || fieldErrors['address.line2']}
            />

            {/* Pincode (6-digit, pre-fills state/district when valid) */}
            <Input
              ref={pincodeRef}
              label={REGISTER.ADDRESS.PINCODE_LABEL}
              placeholder={REGISTER.ADDRESS.PINCODE_PLACEHOLDER}
              value={pincode}
              onChangeText={(text) => {
                const numeric = text.replace(/\D/g, '').slice(0, 6);
                setField('pincode', numeric);
                setBannerError(null);
                if (fieldErrors.pincode || fieldErrors['address.pincode']) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    pincode: '',
                    'address.pincode': '',
                  }));
                }
              }}
              keyboardType="number-pad"
              maxLength={6}
              editable={!isSubmitting}
              error={fieldErrors.pincode || fieldErrors['address.pincode']}
            />

            {/* State (SearchableSelect, 36 items) */}
            <SearchableSelect
              label={REGISTER.ADDRESS.STATE_LABEL}
              placeholder={REGISTER.ADDRESS.STATE_PLACEHOLDER}
              value={selectedState}
              options={INDIA_STATE_OPTIONS}
              onChange={(st) => {
                setField('state', st);
                setField('district', ''); // Changing state clears district
                setBannerError(null);
                if (fieldErrors.state || fieldErrors['address.state']) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    state: '',
                    'address.state': '',
                  }));
                }
              }}
              error={fieldErrors.state || fieldErrors['address.state']}
            />

            {/* District (SearchableSelect loaded from chosen state) */}
            <SearchableSelect
              label={REGISTER.ADDRESS.DISTRICT_LABEL}
              placeholder={
                !selectedState
                  ? 'Select state first'
                  : REGISTER.ADDRESS.DISTRICT_PLACEHOLDER
              }
              value={selectedDistrict}
              options={districtOptions}
              disabled={!selectedState}
              allowOther={true}
              helperText={
                districtDatasetMissing ? REGISTER.DISTRICT_DATASET_MISSING : undefined
              }
              onChange={(dist) => {
                setField('district', dist);
                setBannerError(null);
                if (fieldErrors.district || fieldErrors['address.district']) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    district: '',
                    'address.district': '',
                  }));
                }
              }}
              error={fieldErrors.district || fieldErrors['address.district']}
            />

            {/* Terms and Privacy Checkbox (Required) */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => {
                const next = !acceptedTerms;
                setField('acceptedTerms', next);
                if (next) {
                  setFieldErrors((prev) => ({ ...prev, acceptedTerms: '' }));
                }
              }}
              disabled={isSubmitting}
              activeOpacity={0.75}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedTerms }}
              accessibilityLabel={`${REGISTER.TERMS_PREFIX}${REGISTER.TERMS_LINK}`}
            >
              <View
                style={[
                  styles.checkbox,
                  acceptedTerms && styles.checkboxChecked,
                  fieldErrors.acceptedTerms ? styles.checkboxError : null,
                ]}
              >
                {acceptedTerms && (
                  <Check size={14} color={theme.colors.textOnPrimary} strokeWidth={3} />
                )}
              </View>
              <Text style={styles.termsText}>
                {REGISTER.TERMS_PREFIX}
                <Text style={styles.termsLinkText}>{REGISTER.TERMS_LINK}</Text>
              </Text>
            </TouchableOpacity>
            {fieldErrors.acceptedTerms ? (
              <Text style={styles.termsErrorText}>{fieldErrors.acceptedTerms}</Text>
            ) : null}

            {/* Submit Button: Complete Registration */}
            <View style={styles.submitButtonWrapper}>
              <Button
                title={REGISTER.COMPLETE_REGISTRATION_BTN}
                onPress={handleCompleteRegistration}
                loading={isSubmitting}
                disabled={isSubmitting}
                size="lg"
              />
            </View>
          </View>
        )}

        {/* Text under the form: Trainer or Staff Helper Note */}
        <View style={styles.footerNoteBlock}>
          <Text style={styles.trainerStaffNote}>
            {REGISTER.TRAINER_STAFF_BOTTOM_NOTE}
          </Text>
        </View>
      </GlassCard>

      {/* ══════════════════════════════════════════════════════════════════════
          Welcome Bottom Sheet Modal: "Your gym is ready"
         ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={welcomeSheetVisible}
        transparent
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={handleGoToDashboard}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.welcomeSheetContainer}>
            {/* Drag Handle (top radius 28) */}
            <View style={styles.welcomeHandleContainer}>
              <View style={styles.welcomeHandle} />
            </View>

            {/* Icon & Heading */}
            <View style={styles.welcomeHeader}>
              <View style={styles.sparkleIconCircle}>
                <Sparkles size={28} color={theme.colors.primary} />
              </View>
              <Text style={styles.welcomeTitle}>
                {REGISTER.WELCOME_SHEET.TITLE}
              </Text>
              <Text style={styles.welcomeSubtitle}>
                {REGISTER.WELCOME_SHEET.SUBTITLE}
              </Text>
            </View>

            {/* Big Gym Code Container */}
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>
                {REGISTER.WELCOME_SHEET.CODE_LABEL}
              </Text>
              <Text style={styles.codeValue}>
                {formatGymCode(registeredGymCode)}
              </Text>

              <TouchableOpacity
                onPress={handleCopyGymCode}
                style={styles.copyBtn}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Copy gym code"
              >
                <Copy size={16} color={theme.colors.primary} />
                <Text style={styles.copyBtnText}>
                  {REGISTER.WELCOME_SHEET.COPY_BTN}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Action Button: Go to Dashboard */}
            <View style={styles.welcomeActionWrapper}>
              <Button
                title={REGISTER.WELCOME_SHEET.DASHBOARD_BTN}
                onPress={handleGoToDashboard}
                size="lg"
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedPhoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(142, 182, 155, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(142, 182, 155, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  verifiedPhoneText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 12,
    color: theme.colors.text,
  },
  progressContainer: {
    marginVertical: theme.spacing.xs,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  logo: {
    marginBottom: theme.spacing.xs,
  },
  title: {
    ...theme.typography.h1,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  glassCard: {
    marginBottom: theme.spacing.lg,
  },
  cardInner: {
    padding: theme.spacing.xl,
  },
  stepBlock: {
    width: '100%',
  },
  helperTextNote: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textMuted,
    marginVertical: theme.spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
  },
  actionRowColumn: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  flexBtn: {
    flex: 1,
  },
  fullWidthBtn: {
    width: '100%',
  },
  skipBtn: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipBtnText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 14,
    color: theme.colors.textMuted,
    textDecorationLine: 'underline',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    marginTop: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkboxError: {
    borderColor: theme.colors.error,
  },
  termsText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    flex: 1,
  },
  termsLinkText: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingMedium,
    fontWeight: '600',
  },
  termsErrorText: {
    ...theme.typography.small,
    color: theme.colors.error,
    marginTop: 2,
    marginLeft: 4,
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
    marginBottom: theme.spacing.md,
  },
  errorBannerText: {
    color: theme.colors.error,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  submitButtonWrapper: {
    marginTop: theme.spacing.lg,
  },
  footerNoteBlock: {
    marginTop: theme.spacing.lg,
    alignItems: 'center',
  },
  trainerStaffNote: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.85)',
    justifyContent: 'flex-end',
  },
  welcomeSheetContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  welcomeHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  welcomeHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(218, 241, 222, 0.28)',
  },
  welcomeHeader: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  sparkleIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(142, 182, 155, 0.16)',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  welcomeTitle: {
    ...theme.typography.h1,
    textAlign: 'center',
    marginBottom: 6,
  },
  welcomeSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: theme.spacing.md,
  },
  codeCard: {
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  codeLabel: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  codeValue: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 34,
    lineHeight: 40,
    color: theme.colors.text,
    letterSpacing: 2.5,
    marginBottom: theme.spacing.md,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(142, 182, 155, 0.12)',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    minHeight: 44,
  },
  copyBtnText: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 13,
    color: theme.colors.primary,
  },
  welcomeActionWrapper: {
    width: '100%',
  },
});
