import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  Animated,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDays, format } from 'date-fns';
import {
  X,
  User,
  CalendarDays,
  CreditCard,
  Check,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react-native';
import { useTheme, useStyles, ThemeValue } from '../theme/ThemeContext';
import { Button } from './Button';
import { Badge } from './Badge';
import { PhotoPicker } from './PhotoPicker';
import { PlanPicker } from './PlanPicker';
import { useAddMember, uploadMemberPhoto } from '../api/members';
import { usePlans } from '../api/plans';
import { formatMoney } from '../utils/formatters';

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

export interface AddMemberModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const STEPS = [
  { id: 1, title: 'Details', icon: User },
  { id: 2, title: 'Plan', icon: CalendarDays },
  { id: 3, title: 'Payment', icon: CreditCard },
];

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { data: plans } = usePlans();
  const addMemberMutation = useAddMember();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    trigger,
    reset,
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

  // Handle Esc key to close modal and Enter to submit
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  useEffect(() => {
    if (visible) {
      setStep(1);
      setPhotoUri(null);
      reset({
        name: '',
        phone: '',
        gender: 'MALE',
        planId: plans?.[0]?.id || '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        paidAmount: '',
        paymentMode: 'CASH',
      });
    }
  }, [visible, plans, reset]);

  const handleNextFromStep1 = async () => {
    const isValid = await trigger(['name', 'phone', 'gender']);
    if (isValid) setStep(2);
  };

  const handleNextFromStep2 = async () => {
    const isValid = await trigger(['planId', 'startDate']);
    if (isValid) setStep(3);
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
        paidAmount: paidAmount,
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

      Toast.show({
        type: 'success',
        text1: 'Member Enrolled',
        text2: `${data.name} successfully registered.`,
      });

      onSuccess?.();
      onClose();
    } catch (error: any) {
      if (
        error.response?.data?.message?.includes('duplicate key') ||
        error.response?.data?.message?.includes('phone')
      ) {
        setError('phone', { message: 'This mobile number is already registered' });
        setStep(1);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error.response?.data?.message || 'Failed to add member',
        });
      }
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Add New Member</Text>
              <Text style={styles.modalSubtitle}>
                Step {step} of 3: {STEPS[step - 1].title}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close modal"
              {...({ tabIndex: 0 } as any)}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Step Progress Pills */}
          <View style={styles.stepTabsRow}>
            {STEPS.map((s) => {
              const isCurrent = step === s.id;
              const isCompleted = step > s.id;
              const Icon = s.icon;
              return (
                <View
                  key={s.id}
                  style={[
                    styles.stepTab,
                    isCurrent && styles.stepTabActive,
                    isCompleted && styles.stepTabCompleted,
                  ]}
                >
                  <Icon
                    size={15}
                    color={
                      isCurrent || isCompleted
                        ? colors.text
                        : colors.border
                    }
                  />
                  <Text
                    style={[
                      styles.stepTabText,
                      (isCurrent || isCompleted) && styles.stepTabTextActive,
                    ]}
                  >
                    {s.title}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Form Content */}
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── STEP 1: Details ────────────────────────────────────── */}
            {step === 1 && (
              <View style={styles.stepBlock}>
                <View style={styles.photoRow}>
                  <PhotoPicker
                    photoUri={photoUri}
                    onChange={setPhotoUri}
                  />
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <Text style={styles.label}>Member Name *</Text>
                    <Controller
                      control={control}
                      name="name"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                          style={[styles.input, errors.name && styles.inputError]}
                          placeholder="e.g. Vikram Sharma"
                          placeholderTextColor={colors.textSecondary}
                          value={value ?? ''}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          autoFocus
                          onSubmitEditing={handleNextFromStep1}
                        />
                      )}
                    />
                    {errors.name && (
                      <Text style={styles.errorText}>{errors.name.message}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Mobile Number *</Text>
                  <Controller
                    control={control}
                    name="phone"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        style={[styles.input, errors.phone && styles.inputError]}
                        placeholder="10-digit mobile number"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="phone-pad"
                        maxLength={10}
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        onSubmitEditing={handleNextFromStep1}
                      />
                    )}
                  />
                  {errors.phone && (
                    <Text style={styles.errorText}>{errors.phone.message}</Text>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Gender</Text>
                  <Controller
                    control={control}
                    name="gender"
                    render={({ field: { onChange, value } }) => (
                      <View style={styles.genderRow}>
                        {(['MALE', 'FEMALE', 'OTHER'] as const).map((g) => (
                          <TouchableOpacity
                            key={g}
                            style={[
                              styles.genderBtn,
                              value === g && styles.genderBtnActive,
                            ]}
                            onPress={() => onChange(g)}
                          >
                            <Text
                              style={[
                                styles.genderBtnText,
                                value === g && styles.genderBtnTextActive,
                              ]}
                            >
                              {g === 'MALE' ? 'Male' : g === 'FEMALE' ? 'Female' : 'Other'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  />
                </View>
              </View>
            )}

            {/* ── STEP 2: Plan ───────────────────────────────────────── */}
            {step === 2 && (
              <View style={styles.stepBlock}>
                <Text style={styles.label}>Select Plan *</Text>
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
                {errors.planId && (
                  <Text style={styles.errorText}>{errors.planId.message}</Text>
                )}

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Start Date</Text>
                  <Controller
                    control={control}
                    name="startDate"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.textSecondary}
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        onSubmitEditing={handleNextFromStep2}
                      />
                    )}
                  />
                  {expiryDate ? (
                    <Text style={styles.helperText}>Expires on: {expiryDate}</Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* ── STEP 3: Payment ────────────────────────────────────── */}
            {step === 3 && (
              <View style={styles.stepBlock}>
                <View style={styles.paymentSummaryCard}>
                  <Text style={styles.summaryLabel}>Plan Fee</Text>
                  <Text style={styles.summaryValue}>{formatMoney(totalAmount)}</Text>
                  <View style={styles.divider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Balance:</Text>
                    {dueAmount > 0 ? (
                      <Badge
                        label={`Due ${formatMoney(dueAmount)}`}
                        variant="due"
                        size="sm"
                      />
                    ) : (
                      <Badge
                        label="Paid in Full"
                        variant="paid"
                        size="sm"
                      />
                    )}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Amount Paid (₹)</Text>
                  <Controller
                    control={control}
                    name="paidAmount"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        style={[styles.input, errors.paidAmount && styles.inputError]}
                        placeholder={`Up to ${totalAmount / 100}`}
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="numeric"
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        autoFocus
                        onSubmitEditing={handleSubmit(onSubmit)}
                      />
                    )}
                  />
                  {errors.paidAmount && (
                    <Text style={styles.errorText}>{errors.paidAmount.message}</Text>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Payment Mode</Text>
                  <Controller
                    control={control}
                    name="paymentMode"
                    render={({ field: { onChange, value } }) => (
                      <View style={styles.genderRow}>
                        {(['CASH', 'UPI', 'CARD'] as const).map((m) => (
                          <TouchableOpacity
                            key={m}
                            style={[
                              styles.genderBtn,
                              value === m && styles.genderBtnActive,
                            ]}
                            onPress={() => onChange(m)}
                          >
                            <Text
                              style={[
                                styles.genderBtnText,
                                value === m && styles.genderBtnTextActive,
                              ]}
                            >
                              {m}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.modalFooter}>
            {step > 1 ? (
              <Button
                title="Back"
                variant="secondary"
                size="md"
                onPress={() => setStep((s) => (s - 1) as any)}
                style={{ flex: 1 }}
              />
            ) : (
              <Button
                title="Cancel"
                variant="secondary"
                size="md"
                onPress={onClose}
                style={{ flex: 1 }}
              />
            )}

            {step === 1 ? (
              <Button
                title="Next"
                variant="primary"
                size="md"
                onPress={handleNextFromStep1}
                style={{ flex: 1 }}
              />
            ) : step === 2 ? (
              <Button
                title="Next"
                variant="primary"
                size="md"
                onPress={handleNextFromStep2}
                style={{ flex: 1 }}
              />
            ) : (
              <Button
                title="Save Member"
                variant="primary"
                size="md"
                loading={addMemberMutation.isPending}
                onPress={handleSubmit(onSubmit)}
                style={{ flex: 1 }}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: `0 16px 40px ${theme.colors.scrim}`,
        } as any)
      : {}),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
    color: theme.colors.text,
  },
  modalSubtitle: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.colors.scrim,
    gap: 8,
  },
  stepTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceRaised,
  },
  stepTabActive: {
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stepTabCompleted: {
    backgroundColor: theme.colors.primarySoft,
  },
  stepTabText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  stepTabTextActive: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  formScroll: {
    flexGrow: 0,
  },
  formContent: {
    padding: 24,
  },
  stepBlock: {
    gap: 16,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 13,
    color: theme.colors.text,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  errorText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 11,
    color: theme.colors.danger,
    marginTop: 2,
  },
  helperText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 11,
    color: theme.colors.primary,
    marginTop: 4,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderBtnActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  genderBtnText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  genderBtnTextActive: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  paymentSummaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryLabel: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  summaryValue: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 24,
    color: theme.colors.text,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.surfaceRaised,
    marginVertical: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryRowLabel: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  summaryRowValue: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 15,
    color: theme.colors.text,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
});
