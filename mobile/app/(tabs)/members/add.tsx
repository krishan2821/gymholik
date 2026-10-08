import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as Haptics from 'expo-haptics';
import { addDays, format } from 'date-fns';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  User,
  CreditCard,
  CalendarDays,
  ShieldCheck,
} from 'lucide-react-native';

import { theme } from '../../../src/theme/theme';
import { Screen } from '../../../src/components/Screen';
import { GlassCard } from '../../../src/components/GlassCard';
import { Button } from '../../../src/components/Button';
import { PhotoPicker } from '../../../src/components/PhotoPicker';
import { PlanPicker } from '../../../src/components/PlanPicker';
import { useAddMember, uploadMemberPhoto } from '../../../src/api/members';
import { usePlans } from '../../../src/api/plans';
import { MEMBERS, FIELDS } from '../../../src/constants/strings';

const memberSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian number'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  dob: z.string().optional(),
  address: z.string().optional(),
  planId: z.string().min(1, 'Please select a membership plan'),
  startDate: z.string(),
  paidAmount: z.string().optional(),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD']).optional(),
});

type MemberFormData = z.infer<typeof memberSchema>;

const STEPS = [
  { id: 1, title: 'Details', icon: User },
  { id: 2, title: 'Plan', icon: CalendarDays },
  { id: 3, title: 'Payment', icon: CreditCard },
];

export default function AddMemberScreen() {
  const router = useRouter();
  const { data: plans } = usePlans();
  const addMemberMutation = useAddMember();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Animated progress line
  const progressAnim = useRef(new Animated.Value(0.33)).current;

  const {
    control,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
    setError,
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: '',
      phone: '',
      gender: 'MALE',
      planId: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      paidAmount: '',
      paymentMode: 'CASH',
    },
  });

  const memberName = watch('name');
  const memberPhone = watch('phone');
  const selectedPlanId = watch('planId');
  const startDateStr = watch('startDate');
  const paidAmountStr = watch('paidAmount');
  const selectedPaymentMode = watch('paymentMode');

  const selectedPlan = plans?.find((p) => p.id === selectedPlanId);

  // Auto-calculated fields
  const totalAmount = selectedPlan?.pricePaise || 0;
  const paidAmount = paidAmountStr ? parseInt(paidAmountStr, 10) * 100 : 0;
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  let expiryDate = '';
  if (selectedPlan && startDateStr) {
    try {
      const start = new Date(startDateStr);
      expiryDate = format(addDays(start, selectedPlan.durationDays), 'dd MMM yyyy');
    } catch {}
  }

  const changeStep = (nextStep: 1 | 2 | 3) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(nextStep);
    Animated.spring(progressAnim, {
      toValue: nextStep === 1 ? 0.33 : nextStep === 2 ? 0.66 : 1,
      useNativeDriver: false,
      tension: 60,
      friction: 8,
    }).start();
  };

  const handleNextFromStep1 = async () => {
    const isValid = await trigger(['name', 'phone', 'gender']);
    if (isValid) {
      changeStep(2);
    }
  };

  const handleNextFromStep2 = async () => {
    const isValid = await trigger(['planId', 'startDate']);
    if (isValid) {
      changeStep(3);
    }
  };

  const onSubmit = async (data: MemberFormData) => {
    if (paidAmount > totalAmount) {
      setError('paidAmount', { message: 'Cannot pay more than total plan fee' });
      return;
    }

    try {
      const payload = {
        name: data.name.trim(),
        phone: data.phone.trim(),
        gender: data.gender,
        dob: data.dob || null,
        address: data.address?.trim() || null,
        planId: data.planId,
        startDate: data.startDate,
        paidAmount: paidAmount, // paise
        paymentMode: data.paymentMode || 'CASH',
      };

      const res = await addMemberMutation.mutateAsync(payload);

      if (res.success && res.data?.id && photoUri) {
        try {
          await uploadMemberPhoto(res.data.id, photoUri);
        } catch (e) {
          console.log('Failed to upload photo', e);
        }
      }

      router.back();
    } catch (error: any) {
      if (
        error.response?.data?.message?.includes('duplicate key') ||
        error.response?.data?.message?.includes('phone')
      ) {
        setError('phone', { message: 'This mobile number is already registered' });
        changeStep(1);
      } else {
        Alert.alert('Error', error.response?.data?.message || 'Failed to add member');
      }
    }
  };

  return (
    <Screen scrollable keyboardAvoiding contentContainerStyle={styles.scroll}>
      {/* ── Progress Bar & Step Indicator ─────────────────────────────── */}
      <View style={styles.progressContainer}>
        {/* Track & Filled Progress Bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        {/* Step Nodes */}
        <View style={styles.stepNodesRow}>
          {STEPS.map((s) => {
            const isDone = step > s.id;
            const isCurrent = step === s.id;
            const Icon = s.icon;

            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => {
                  if (s.id < step) changeStep(s.id as 1 | 2 | 3);
                }}
                disabled={s.id > step}
                style={styles.stepNode}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.stepCircle,
                    isDone && styles.stepCircleDone,
                    isCurrent && styles.stepCircleCurrent,
                  ]}
                >
                  {isDone ? (
                    <Check size={14} color={theme.colors.textOnPrimary} strokeWidth={2.6} />
                  ) : (
                    <Icon
                      size={14}
                      color={isCurrent ? theme.colors.textOnPrimary : theme.colors.textMuted}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    isCurrent && styles.stepLabelCurrent,
                    isDone && styles.stepLabelDone,
                  ]}
                >
                  {s.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── STEP 1: Personal Details ──────────────────────────────────── */}
      {step === 1 && (
        <View>
          <PhotoPicker photoUri={photoUri} onChange={setPhotoUri} />

          <GlassCard style={styles.card} contentStyle={styles.cardContent}>
            <Text style={styles.sectionTitle}>{MEMBERS.SECTION_BASIC}</Text>

            <Text style={styles.label}>{`${FIELDS.NAME} *`}</Text>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[styles.input, errors.name && styles.inputError]}
                  placeholder={FIELDS.NAME}
                  placeholderTextColor={theme.colors.textMuted}
                  value={value}
                  onChangeText={onChange}
                  autoCapitalize="words"
                />
              )}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name.message}</Text>}

            <Text style={[styles.label, { marginTop: 14 }]}>{`${FIELDS.PHONE} *`}</Text>
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, value } }) => (
                <View style={[styles.phoneInputRow, errors.phone && styles.inputError]}>
                  <Text style={styles.phonePrefix}>+91</Text>
                  <View style={styles.phoneDivider} />
                  <TextInput
                    style={styles.phoneField}
                    placeholder={FIELDS.PHONE_PLACEHOLDER}
                    placeholderTextColor={theme.colors.textMuted}
                    value={value}
                    onChangeText={(val) => onChange(val.replace(/\D/g, ''))}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              )}
            />
            {errors.phone && <Text style={styles.errorText}>{errors.phone.message}</Text>}

            <Text style={[styles.label, { marginTop: 14 }]}>{FIELDS.GENDER}</Text>
            <Controller
              control={control}
              name="gender"
              render={({ field: { onChange, value } }) => (
                <View style={styles.chipRow}>
                  {(['MALE', 'FEMALE', 'OTHER'] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.chip, value === g && styles.chipSelected]}
                      onPress={() => onChange(g)}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.chipText, value === g && styles.chipTextSelected]}>
                        {g.charAt(0) + g.slice(1).toLowerCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />

            <Text style={[styles.label, { marginTop: 14 }]}>{FIELDS.ADDRESS}</Text>
            <Controller
              control={control}
              name="address"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder={FIELDS.ADDRESS_PLACEHOLDER}
                  placeholderTextColor={theme.colors.textMuted}
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
          </GlassCard>

          <Button
            title="Continue to Plan"
            onPress={handleNextFromStep1}
            variant="primary"
            size="lg"
            icon={<ArrowRight size={18} color={theme.colors.textOnPrimary} />}
            style={styles.stepBtn}
          />
        </View>
      )}

      {/* ── STEP 2: Membership Plan ───────────────────────────────────── */}
      {step === 2 && (
        <View>
          <GlassCard style={styles.card} contentStyle={styles.cardContent}>
            <Text style={styles.sectionTitle}>{MEMBERS.SECTION_PLAN}</Text>

            <Text style={styles.label}>{`${MEMBERS.LABEL_SELECT_PLAN} *`}</Text>
            <Controller
              control={control}
              name="planId"
              render={({ field: { onChange, value } }) => (
                <PlanPicker
                  value={value}
                  onChange={onChange}
                  error={errors.planId?.message}
                />
              )}
            />

            {selectedPlan && (
              <View style={styles.planSummary}>
                <View style={styles.planSummaryRow}>
                  <Text style={styles.planSummaryLabel}>Duration</Text>
                  <Text style={styles.planSummaryValue}>{selectedPlan.durationDays} Days</Text>
                </View>
                <View style={styles.planSummaryRow}>
                  <Text style={styles.planSummaryLabel}>Expires On</Text>
                  <Text style={styles.planSummaryValue}>{expiryDate}</Text>
                </View>
                <View style={styles.planSummaryRow}>
                  <Text style={styles.planSummaryLabel}>Total Plan Fee</Text>
                  <Text style={[styles.planSummaryValue, styles.planPriceText]}>
                    ₹{totalAmount / 100}
                  </Text>
                </View>
              </View>
            )}
          </GlassCard>

          <View style={styles.dualBtnRow}>
            <Button
              title="Back"
              onPress={() => changeStep(1)}
              variant="secondary"
              size="lg"
              style={{ flex: 1 }}
            />
            <Button
              title="Continue to Payment"
              onPress={handleNextFromStep2}
              variant="primary"
              size="lg"
              icon={<ArrowRight size={18} color={theme.colors.textOnPrimary} />}
              style={{ flex: 1.5 }}
            />
          </View>
        </View>
      )}

      {/* ── STEP 3: Payment & Confirmation ────────────────────────────── */}
      {step === 3 && (
        <View>
          {/* Member & Plan Recap */}
          <GlassCard style={styles.card} contentStyle={styles.cardContent}>
            <View style={styles.recapHeader}>
              <ShieldCheck size={20} color={theme.colors.primary} />
              <Text style={styles.recapTitle}>Summary & Confirmation</Text>
            </View>

            <View style={styles.recapDetails}>
              <View style={styles.recapRow}>
                <Text style={styles.recapLabel}>Member Name</Text>
                <Text style={styles.recapValue}>{memberName || '—'}</Text>
              </View>
              <View style={styles.recapRow}>
                <Text style={styles.recapLabel}>Mobile</Text>
                <Text style={styles.recapValue}>+91 {memberPhone || '—'}</Text>
              </View>
              <View style={styles.recapRow}>
                <Text style={styles.recapLabel}>Selected Plan</Text>
                <Text style={styles.recapValue}>{selectedPlan?.name || '—'}</Text>
              </View>
              <View style={styles.recapRow}>
                <Text style={styles.recapLabel}>Total Fee</Text>
                <Text style={[styles.recapValue, { color: theme.colors.primary, fontFamily: theme.fonts.headingBold }]}>
                  ₹{totalAmount / 100}
                </Text>
              </View>
            </View>
          </GlassCard>

          <GlassCard style={styles.card} contentStyle={styles.cardContent}>
            <Text style={styles.sectionTitle}>Payment Details</Text>

            <Text style={styles.label}>{MEMBERS.LABEL_AMOUNT_PAID}</Text>
            <Controller
              control={control}
              name="paidAmount"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[styles.input, errors.paidAmount && styles.inputError]}
                  placeholder={`Full amount: ${totalAmount / 100}`}
                  placeholderTextColor={theme.colors.textMuted}
                  value={value}
                  onChangeText={onChange}
                  keyboardType="number-pad"
                />
              )}
            />
            {errors.paidAmount && (
              <Text style={styles.errorText}>{errors.paidAmount.message}</Text>
            )}

            {dueAmount > 0 && selectedPlan && (
              <View style={styles.dueAlertBox}>
                <Text style={styles.dueAlertText}>
                  Pending Due: ₹{dueAmount / 100}
                </Text>
              </View>
            )}

            <Text style={[styles.label, { marginTop: 14 }]}>{FIELDS.PAYMENT_MODE}</Text>
            <Controller
              control={control}
              name="paymentMode"
              render={({ field: { onChange, value } }) => (
                <View style={styles.chipRow}>
                  {(['CASH', 'UPI', 'CARD'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.chip, value === m && styles.chipSelected]}
                      onPress={() => onChange(m)}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.chipText, value === m && styles.chipTextSelected]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          </GlassCard>

          <View style={styles.dualBtnRow}>
            <Button
              title="Back"
              onPress={() => changeStep(2)}
              variant="secondary"
              size="lg"
              style={{ flex: 1 }}
            />
            <Button
              title={MEMBERS.SAVE_MEMBER}
              onPress={handleSubmit(onSubmit)}
              loading={addMemberMutation.isPending}
              variant="primary"
              size="lg"
              style={{ flex: 1.5 }}
            />
          </View>
        </View>
      )}

      <View style={{ height: 48 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: theme.spacing.md,
    paddingBottom: 60,
  },

  // Progress Bar
  progressContainer: {
    marginBottom: theme.spacing.lg,
    paddingHorizontal: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(218, 241, 222, 0.12)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  stepNodesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  stepCircleCurrent: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  stepLabel: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  stepLabelCurrent: {
    color: theme.colors.text,
    fontFamily: theme.fonts.headingBold,
  },
  stepLabelDone: {
    color: theme.colors.primary,
  },

  card: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.radius.xl,
  },
  cardContent: {
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 6,
    marginLeft: 2,
    fontWeight: '600',
  },
  input: {
    backgroundColor: theme.colors.raised,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    minHeight: 52,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 15,
    color: theme.colors.text,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.raised,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    minHeight: 52,
    overflow: 'hidden',
  },
  phonePrefix: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 15,
    color: theme.colors.primary,
    paddingLeft: 14,
    paddingRight: 8,
  },
  phoneDivider: {
    width: 1,
    height: 22,
    backgroundColor: theme.colors.border,
    marginRight: 8,
  },
  phoneField: {
    flex: 1,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 15,
    color: theme.colors.text,
    paddingVertical: 14,
    paddingRight: 14,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    ...theme.typography.small,
    color: theme.colors.error,
    marginTop: 4,
    marginLeft: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  chip: {
    flex: 1,
    minHeight: 44,
    backgroundColor: theme.colors.raised,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 14,
    color: theme.colors.text,
  },
  chipTextSelected: {
    color: theme.colors.textOnPrimary,
    fontWeight: '700',
  },

  planSummary: {
    backgroundColor: theme.colors.raised,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
  },
  planSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planSummaryLabel: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  planSummaryValue: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 13,
    color: theme.colors.text,
  },
  planPriceText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 17,
    color: theme.colors.primary,
  },

  recapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  recapTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  recapDetails: {
    gap: 8,
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  recapLabel: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  recapValue: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 14,
    color: theme.colors.text,
  },

  dueAlertBox: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.35)',
    borderRadius: theme.radius.md,
    padding: 10,
    marginTop: 8,
  },
  dueAlertText: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 13,
    color: theme.colors.error,
    textAlign: 'center',
  },

  stepBtn: {
    marginTop: theme.spacing.md,
  },
  dualBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: theme.spacing.md,
  },
});
