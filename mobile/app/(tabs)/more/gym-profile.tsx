import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { safeSetClipboardString } from '../../../src/utils/safeClipboard';
import { safeNotificationAsync, NotificationFeedbackType } from '../../../src/utils/safeHaptics';
import Toast from 'react-native-toast-message';
import {
  Building2,
  MapPin,
  ShieldCheck,
  Eye,
  EyeOff,
  Edit3,
  Copy,
  Share2,
  Lock,
  X,
  FileText,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import { useTheme, useStyles, ThemeValue } from '../../../src/theme/ThemeContext';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { useCurrentUser } from '../../../src/api/auth';
import {
  useGymProfile,
  useUpdateGymProfile,
  GymType,
  LegalIdType,
} from '../../../src/api/more';
import { apiClient } from '../../../src/api/axiosConfig';
import { Screen } from '../../../src/components/Screen';
import { PageHeader } from '../../../src/components/PageHeader';
import { safeBack } from '../../../src/utils/navigation';
import { GlassCard } from '../../../src/components/GlassCard';
import { Badge } from '../../../src/components/Badge';
import { Button } from '../../../src/components/Button';
import { ErrorState } from '../../../src/components/ErrorState';
import { SearchableSelect } from '../../../src/components/SearchableSelect';
import { GYM_TYPE_OPTIONS, getGymTypeLabel, GymTypeCode } from '../../../src/data/gymTypes';
import {
  LEGAL_DOC_OPTIONS,
  LEGAL_DOC_CONFIGS,
  LegalDocType as LegalDocDataKey,
} from '../../../src/data/legalDocs';
import { INDIA_STATE_OPTIONS } from '../../../src/data/indiaStates';
import { getDistrictsForState } from '../../../src/data/indiaDistricts';
import { formatGymCode } from '../../../src/utils/registrationValidation';
import { updateGymProfileSchema } from '../../../src/utils/gymProfileValidation';
import {
  GYM_PROFILE,
  MORE,
  REGISTER,
  COMMON,
} from '../../../src/constants/strings';
import { useBreakpoint } from '../../../src/hooks/useBreakpoint';

const LEGAL_DOC_SELECT_OPTIONS = [
  { label: 'None (No document)', value: 'NONE' },
  ...LEGAL_DOC_OPTIONS,
];

export default function GymProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { user, role } = useAuthStore();
  const { data: currentUser } = useCurrentUser();
  const isOwner = (currentUser?.role || role) === 'OWNER';
  const { isPhone } = useBreakpoint();

  // Guard: OWNER only
  useEffect(() => {
    if (role && !isOwner) {
      router.replace('/(tabs)/more');
    }
  }, [role, isOwner, router]);

  const {
    data: profile,
    isLoading,
    isError,
    refetch,
  } = useGymProfile({ enabled: isOwner });

  const updateMutation = useUpdateGymProfile();

  // ── Reveal State for Legal ID ─────────────────────────────────────────────
  const [isRevealed, setIsRevealed] = useState(false);
  const [revealedNumber, setRevealedNumber] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(10);
  const [isRevealing, setIsRevealing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const cleanupRevealTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleHide = useCallback(() => {
    cleanupRevealTimers();
    setIsRevealed(false);
    setRevealedNumber(null);
    setCountdown(10);
  }, [cleanupRevealTimers]);

  useEffect(() => {
    return () => {
      cleanupRevealTimers();
    };
  }, [cleanupRevealTimers]);

  const handleToggleReveal = async () => {
    if (isRevealed) {
      handleHide();
      return;
    }

    try {
      setIsRevealing(true);
      const { data } = await apiClient.get('/api/gym/profile', {
        params: { reveal: true },
      });
      const unmasked = data.data?.legalIdNumber || '';
      setRevealedNumber(unmasked);
      setIsRevealed(true);
      setCountdown(10);

      cleanupRevealTimers();

      intervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      timerRef.current = setTimeout(() => {
        handleHide();
      }, 10000);
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not reveal document',
        text2: e.response?.data?.message || 'Server error',
      });
    } finally {
      setIsRevealing(false);
    }
  };

  // ── Copy & Share Gym Code ────────────────────────────────────────────────
  const formattedGymCode = formatGymCode(profile?.gymCode);

  const handleCopyCode = async () => {
    if (!formattedGymCode) return;
    await safeSetClipboardString(formattedGymCode);
    safeNotificationAsync(NotificationFeedbackType.Success).catch(() => {});
    Toast.show({
      type: 'success',
      text1: GYM_PROFILE.COPIED_TOAST,
    });
  };

  const handleShareCode = async () => {
    if (!formattedGymCode) return;
    try {
      await Share.share({
        message: GYM_PROFILE.SHARE_TEXT(profile?.name || 'Gym', formattedGymCode),
      });
    } catch {
      // dismissed
    }
  };

  // ── Edit Modal State ──────────────────────────────────────────────────────
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGymType, setEditGymType] = useState<GymTypeCode>('COMMERCIAL');
  const [editLegalIdType, setEditLegalIdType] = useState<string>('NONE');
  const [editLegalIdNumber, setEditLegalIdNumber] = useState('');
  const [editLine1, setEditLine1] = useState('');
  const [editLine2, setEditLine2] = useState('');
  const [editState, setEditState] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editPincode, setEditPincode] = useState('');

  const [districtOptions, setDistrictOptions] = useState<{ label: string; value: string }[]>([]);
  const [districtDatasetMissing, setDistrictDatasetMissing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleOpenEdit = () => {
    if (!profile) return;
    setEditName(profile.name || '');
    setEditGymType(profile.gymType || 'COMMERCIAL');
    setEditLegalIdType(profile.legalIdType || 'NONE');
    setEditLegalIdNumber(profile.legalIdNumber ? profile.legalIdNumber.replace(/^\*+/, '') : '');
    setEditLine1(profile.address?.line1 || '');
    setEditLine2(profile.address?.line2 || '');
    setEditState(profile.address?.state || '');
    setEditDistrict(profile.address?.district || '');
    setEditPincode(profile.address?.pincode || '');
    setFieldErrors({});
    setIsEditModalVisible(true);
  };

  // Load districts when editState changes
  useEffect(() => {
    let active = true;
    if (!editState) {
      setDistrictOptions([]);
      setDistrictDatasetMissing(false);
      return;
    }

    getDistrictsForState(editState).then((result) => {
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
  }, [editState]);

  const handleSaveProfile = async () => {
    setFieldErrors({});

    const normalizedLegalType =
      editLegalIdType === 'NONE' || !editLegalIdType ? null : (editLegalIdType as LegalIdType);
    const normalizedLegalNumber =
      normalizedLegalType && editLegalIdNumber.trim() ? editLegalIdNumber.trim().toUpperCase() : null;

    const parseResult = updateGymProfileSchema.safeParse({
      name: editName.trim(),
      gymType: editGymType,
      legalIdType: normalizedLegalType,
      legalIdNumber: normalizedLegalNumber,
      line1: editLine1.trim(),
      line2: editLine2.trim() || null,
      state: editState.trim(),
      district: editDistrict.trim(),
      pincode: editPincode.trim(),
    });

    if (!parseResult.success) {
      const errors: Record<string, string> = {};
      parseResult.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (!errors[path]) errors[path] = issue.message;
      });
      setFieldErrors(errors);
      safeNotificationAsync(NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    try {
      await updateMutation.mutateAsync({
        name: editName.trim(),
        gymType: editGymType,
        legalIdType: normalizedLegalType,
        legalIdNumber: normalizedLegalNumber,
        address: {
          line1: editLine1.trim(),
          line2: editLine2.trim() || undefined,
          state: editState.trim(),
          district: editDistrict.trim(),
          pincode: editPincode.trim(),
        },
      });

      safeNotificationAsync(NotificationFeedbackType.Success).catch(() => {});
      setIsEditModalVisible(false);
      handleHide();
      refetch();
    } catch {
      // Handled by mutation onError toast
    }
  };

  if (!isOwner) {
    return null;
  }

  if (isLoading) {
    return (
      <Screen style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (isError || !profile) {
    return (
      <Screen style={styles.centerContainer}>
        <ErrorState message={GYM_PROFILE.LOAD_ERROR} onRetry={() => refetch()} />
      </Screen>
    );
  }

  const currentLegalConfig = profile.legalIdType
    ? LEGAL_DOC_CONFIGS[profile.legalIdType as LegalDocDataKey]
    : null;

  const displayedLegalNumber = isRevealed
    ? revealedNumber || profile.legalIdNumber
    : profile.legalIdNumber;

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      <PageHeader
        title={GYM_PROFILE.SCREEN_TITLE}
        showBack
        onBack={() => safeBack('/(tabs)/more')}
        rightAction={
          <Button
            title="Edit"
            size="sm"
            variant="secondary"
            fullWidth={false}
            icon={<Edit3 size={15} color={colors.primary} />}
            onPress={handleOpenEdit}
          />
        }
      />

      {/* ── Top Header / Gym Code Card ──────────────────────────────── */}
      <GlassCard style={styles.topCard} contentStyle={styles.topCardContent}>
        <View style={styles.topCardHeader}>
          <View style={styles.iconCircle}>
            <Building2 size={28} color={colors.primary} />
          </View>
          <View style={styles.topHeaderMeta}>
            <Text style={styles.gymName} numberOfLines={2}>
              {profile.name}
            </Text>
            <View style={styles.ownerBadgeRow}>
              <Badge label="OWNER" variant="success" size="sm" />
              {profile.gymType ? (
                <Text style={styles.gymTypeSub}>• {getGymTypeLabel(profile.gymType)}</Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.codeRow}>
          <View style={styles.codeTextBlock}>
            <Text style={styles.codeLabel}>{GYM_PROFILE.GYM_CODE_LABEL.toUpperCase()}</Text>
            <Text style={styles.codeValue}>{formattedGymCode}</Text>
            <Text style={styles.codeHint}>{GYM_PROFILE.IMMUTABLE_CODE_HINT}</Text>
          </View>
          <View style={styles.codeBtnRow}>
            <TouchableOpacity
              style={styles.codePillBtn}
              onPress={handleCopyCode}
              accessibilityRole="button"
              accessibilityLabel="Copy gym code"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Copy size={16} color={colors.primary} />
              <Text style={styles.codePillText}>{GYM_PROFILE.COPY_BTN}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.codePillBtn}
              onPress={handleShareCode}
              accessibilityRole="button"
              accessibilityLabel="Share gym code"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Share2 size={16} color={colors.primary} />
              <Text style={styles.codePillText}>{GYM_PROFILE.SHARE_BTN}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </GlassCard>

      {/* ── Gym Details Section ─────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>{GYM_PROFILE.SECTION_DETAILS}</Text>
      <GlassCard style={styles.sectionCard} contentStyle={styles.cardPad}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{GYM_PROFILE.GYM_NAME_LABEL}</Text>
          <Text style={styles.detailValue}>{profile.name}</Text>
        </View>
        <View style={styles.itemDivider} />
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>{GYM_PROFILE.GYM_TYPE_LABEL}</Text>
          <Text style={styles.detailValue}>
            {profile.gymType ? getGymTypeLabel(profile.gymType) : 'Not specified'}
          </Text>
        </View>
      </GlassCard>

      {/* ── Gym Address Section ─────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>{GYM_PROFILE.SECTION_ADDRESS}</Text>
      <GlassCard style={styles.sectionCard} contentStyle={styles.cardPad}>
        {profile.address?.line1 ? (
          <>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>{REGISTER.ADDRESS.LINE1_LABEL}</Text>
              <Text style={styles.detailValue}>{profile.address.line1}</Text>
            </View>
            {profile.address.line2 ? (
              <>
                <View style={styles.itemDivider} />
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>{REGISTER.ADDRESS.LINE2_LABEL}</Text>
                  <Text style={styles.detailValue}>{profile.address.line2}</Text>
                </View>
              </>
            ) : null}
            <View style={styles.itemDivider} />
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>District & State</Text>
              <Text style={styles.detailValue}>
                {profile.address.district}, {profile.address.state}
              </Text>
            </View>
            <View style={styles.itemDivider} />
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>{REGISTER.ADDRESS.PINCODE_LABEL}</Text>
              <Text style={styles.detailValue}>{profile.address.pincode}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.emptyText}>No address details added yet.</Text>
        )}
      </GlassCard>

      {/* ── Business Registration Section ───────────────────────────── */}
      <Text style={styles.sectionTitle}>Business registration</Text>
      <GlassCard style={styles.sectionCard} contentStyle={styles.cardPad}>
        {profile.legalIdType && profile.legalIdNumber ? (
          <>
            <View style={styles.legalHeaderRow}>
              <View style={styles.legalTypeCol}>
                <Text style={styles.detailLabel}>{GYM_PROFILE.LEGAL_DOC_TYPE_LABEL}</Text>
                <Text style={styles.detailValue}>
                  {currentLegalConfig?.label || profile.legalIdType}
                </Text>
              </View>
              <Badge
                label={
                  profile.legalIdVerified
                    ? GYM_PROFILE.LEGAL_VERIFIED_BADGE
                    : GYM_PROFILE.LEGAL_UNVERIFIED_BADGE
                }
                variant={profile.legalIdVerified ? 'success' : 'neutral'}
                size="sm"
              />
            </View>

            <View style={styles.itemDivider} />

            <View style={styles.legalNumberRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>{GYM_PROFILE.LEGAL_DOC_NUMBER_LABEL}</Text>
                <Text style={[styles.detailValue, styles.monoValue]}>
                  {displayedLegalNumber}
                </Text>
                {isRevealed && (
                  <Text style={styles.countdownText}>
                    Auto-hiding in {countdown}s
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.revealBtn}
                onPress={handleToggleReveal}
                disabled={isRevealing}
                accessibilityRole="button"
                accessibilityLabel={isRevealed ? GYM_PROFILE.HIDE_DOC_NUMBER : GYM_PROFILE.SHOW_DOC_NUMBER}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {isRevealing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : isRevealed ? (
                  <>
                    <EyeOff size={16} color={colors.primary} />
                    <Text style={styles.revealBtnText}>{GYM_PROFILE.HIDE_DOC_NUMBER}</Text>
                  </>
                ) : (
                  <>
                    <Eye size={16} color={colors.primary} />
                    <Text style={styles.revealBtnText}>{GYM_PROFILE.SHOW_DOC_NUMBER}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.emptyLegalBox}>
            <FileText size={28} color={colors.textSecondary} />
            <Text style={styles.emptyLegalTitle}>{GYM_PROFILE.NO_LEGAL_DOC}</Text>
            <Text style={styles.emptyLegalSub}>
              You can add your Udyam, GSTIN, or NIC number to verify your business identity.
            </Text>
          </View>
        )}
      </GlassCard>

      {/* ── Edit Button ────────────────────────────────────────────── */}
      <View style={styles.btnWrapper}>
        <Button
          title={GYM_PROFILE.EDIT_BTN}
          variant="primary"
          icon={<Edit3 size={18} color={colors.textOnPrimary} />}
          onPress={handleOpenEdit}
        />
      </View>

      {/* ── Edit Gym Profile Modal ─────────────────────────────────── */}
      <Modal
        visible={isEditModalVisible}
        animationType={isPhone ? 'slide' : 'fade'}
        transparent={!isPhone}
        presentationStyle={isPhone ? 'pageSheet' : 'overFullScreen'}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={isPhone ? styles.modalBackdrop : styles.modalOverlay}
        >
          <View style={isPhone ? styles.modalBackdrop : styles.modalCard}>
            <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{GYM_PROFILE.EDIT_MODAL_TITLE}</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsEditModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Read-Only Gym Code Notice */}
            <View style={styles.immutableNoticeCard}>
              <View style={styles.immutableHeader}>
                <Lock size={16} color={colors.textSecondary} />
                <Text style={styles.immutableLabel}>Gym Code (Permanent)</Text>
              </View>
              <Text style={styles.immutableValue}>{formattedGymCode}</Text>
              <Text style={styles.immutableHint}>{GYM_PROFILE.IMMUTABLE_CODE_HINT}</Text>
            </View>

            {/* Gym Name */}
            <Text style={styles.inputLabel}>{REGISTER.GYM_NAME_LABEL} *</Text>
            <TextInput
              style={[styles.textInput, fieldErrors.name && styles.textInputError]}
              value={editName ?? ''}
              onChangeText={setEditName}
              placeholder={REGISTER.GYM_NAME_PLACEHOLDER_NEW}
              placeholderTextColor={colors.textSecondary}
              maxLength={80}
            />
            {fieldErrors.name && <Text style={styles.fieldErrorText}>{fieldErrors.name}</Text>}

            {/* Gym Type */}
            <SearchableSelect
              label={`${REGISTER.GYM_TYPE_LABEL} *`}
              value={editGymType}
              options={GYM_TYPE_OPTIONS}
              placeholder={REGISTER.GYM_TYPE_PLACEHOLDER}
              onChange={(val) => setEditGymType(val as GymTypeCode)}
              error={fieldErrors.gymType}
            />

            {/* Business Document Type */}
            <SearchableSelect
              label={REGISTER.LEGAL_DOC_TYPE_LABEL}
              value={editLegalIdType}
              options={LEGAL_DOC_SELECT_OPTIONS}
              placeholder={REGISTER.LEGAL_DOC_PLACEHOLDER}
              onChange={(val) => {
                setEditLegalIdType(val);
                setEditLegalIdNumber('');
              }}
              error={fieldErrors.legalIdType}
            />

            {/* Business Document Number */}
            {editLegalIdType && editLegalIdType !== 'NONE' && (
              <View style={styles.docNumberBlock}>
                <Text style={styles.inputLabel}>
                  {LEGAL_DOC_CONFIGS[editLegalIdType as LegalDocDataKey]?.label || 'Document Number'} *
                </Text>
                <TextInput
                  style={[styles.textInput, fieldErrors.legalIdNumber && styles.textInputError]}
                  value={editLegalIdNumber ?? ''}
                  onChangeText={(val) => {
                    const cfg = LEGAL_DOC_CONFIGS[editLegalIdType as LegalDocDataKey];
                    const nextVal = cfg?.autoUppercase ? val.toUpperCase() : val;
                    setEditLegalIdNumber(nextVal);
                  }}
                  placeholder={
                    LEGAL_DOC_CONFIGS[editLegalIdType as LegalDocDataKey]?.placeholder ||
                    REGISTER.LEGAL_DOC_NUMBER_LABEL
                  }
                  placeholderTextColor={colors.textSecondary}
                  maxLength={LEGAL_DOC_CONFIGS[editLegalIdType as LegalDocDataKey]?.maxLength || 30}
                  keyboardType={
                    LEGAL_DOC_CONFIGS[editLegalIdType as LegalDocDataKey]?.keyboardType || 'default'
                  }
                  autoCapitalize="characters"
                />
                {fieldErrors.legalIdNumber ? (
                  <Text style={styles.fieldErrorText}>{fieldErrors.legalIdNumber}</Text>
                ) : (
                  <Text style={styles.inputHint}>
                    {LEGAL_DOC_CONFIGS[editLegalIdType as LegalDocDataKey]?.hintText}
                  </Text>
                )}
              </View>
            )}

            {/* Address Line 1 */}
            <Text style={styles.inputLabel}>{REGISTER.ADDRESS.LINE1_LABEL} *</Text>
            <TextInput
              style={[styles.textInput, fieldErrors.line1 && styles.textInputError]}
              value={editLine1 ?? ''}
              onChangeText={setEditLine1}
              placeholder={REGISTER.ADDRESS_LINE1_PLACEHOLDER}
              placeholderTextColor={colors.textSecondary}
              maxLength={120}
            />
            {fieldErrors.line1 && <Text style={styles.fieldErrorText}>{fieldErrors.line1}</Text>}

            {/* Address Line 2 */}
            <Text style={styles.inputLabel}>{REGISTER.ADDRESS.LINE2_LABEL}</Text>
            <TextInput
              style={[styles.textInput, fieldErrors.line2 && styles.textInputError]}
              value={editLine2 ?? ''}
              onChangeText={setEditLine2}
              placeholder={REGISTER.ADDRESS_LINE2_PLACEHOLDER}
              placeholderTextColor={colors.textSecondary}
              maxLength={120}
            />
            {fieldErrors.line2 && <Text style={styles.fieldErrorText}>{fieldErrors.line2}</Text>}

            {/* State */}
            <SearchableSelect
              label={`${REGISTER.ADDRESS.STATE_LABEL} *`}
              value={editState}
              options={INDIA_STATE_OPTIONS}
              placeholder={REGISTER.ADDRESS.STATE_PLACEHOLDER}
              onChange={(val) => {
                setEditState(val);
                setEditDistrict('');
              }}
              error={fieldErrors.state}
            />

            {/* District */}
            <SearchableSelect
              label={`${REGISTER.ADDRESS.DISTRICT_LABEL} *`}
              value={editDistrict}
              options={districtOptions}
              placeholder={REGISTER.ADDRESS.DISTRICT_PLACEHOLDER}
              onChange={(val) => setEditDistrict(val)}
              allowOther={true}
              error={fieldErrors.district}
              helperText={
                districtDatasetMissing ? REGISTER.DISTRICT_DATASET_MISSING : undefined
              }
            />

            {/* PIN Code */}
            <Text style={styles.inputLabel}>{REGISTER.ADDRESS.PINCODE_LABEL} *</Text>
            <TextInput
              style={[styles.textInput, fieldErrors.pincode && styles.textInputError]}
              value={editPincode ?? ''}
              onChangeText={setEditPincode}
              placeholder={REGISTER.ADDRESS.PINCODE_PLACEHOLDER}
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              maxLength={6}
            />
            {fieldErrors.pincode && (
              <Text style={styles.fieldErrorText}>{fieldErrors.pincode}</Text>
            )}

            {/* Action buttons inside modal */}
            <View style={styles.modalActions}>
              <Button
                title={GYM_PROFILE.SAVE_CHANGES_BTN}
                variant="primary"
                onPress={handleSaveProfile}
                loading={updateMutation.isPending}
                disabled={updateMutation.isPending}
              />
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsEditModalVisible(false)}
                disabled={updateMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelBtnText}>{GYM_PROFILE.CANCEL_BTN}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  topCard: {
    marginBottom: theme.spacing.lg,
  },
  topCardContent: {
    padding: theme.spacing.md,
  },
  topCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  topHeaderMeta: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  gymName: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  ownerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
    flexWrap: 'wrap',
  },
  gymTypeSub: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: theme.spacing.md,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeTextBlock: {
    flex: 1,
  },
  codeLabel: {
    ...theme.typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  codeValue: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 18,
    color: theme.colors.primary,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  codeHint: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  codeBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  codePillText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    fontWeight: '600',
  },
  sectionTitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.headingMedium,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
    marginLeft: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    marginBottom: theme.spacing.lg,
  },
  cardPad: {
    padding: theme.spacing.md,
  },
  detailItem: {
    paddingVertical: 4,
  },
  detailLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    fontWeight: '500',
  },
  monoValue: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  itemDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: theme.spacing.sm,
  },
  legalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legalTypeCol: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  legalNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countdownText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  revealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  revealBtnText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  emptyLegalBox: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    gap: 6,
  },
  emptyLegalTitle: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    fontWeight: '600',
  },
  emptyLegalSub: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  emptyText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  btnWrapper: {
    marginTop: theme.spacing.sm,
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 20 : theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  modalTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: theme.spacing.md,
    paddingBottom: 80,
  },
  immutableNoticeCard: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  immutableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  immutableLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  immutableValue: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 18,
    color: theme.colors.primary,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  immutableHint: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 14,
    color: theme.colors.text,
    fontFamily: theme.fonts.headingMedium,
    marginBottom: 6,
  },
  textInput: {
    minHeight: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 15,
    marginBottom: theme.spacing.md,
  },
  textInputError: {
    borderColor: theme.colors.danger,
  },
  fieldErrorText: {
    ...theme.typography.caption,
    color: theme.colors.danger,
    marginTop: -10,
    marginBottom: theme.spacing.md,
  },
  inputHint: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: -10,
    marginBottom: theme.spacing.md,
  },
  docNumberBlock: {
    marginTop: theme.spacing.xs,
  },
  modalActions: {
    marginTop: theme.spacing.lg,
    gap: 12,
  },
  cancelBtn: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radius.md,
  },
  cancelBtnText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
  },
});
