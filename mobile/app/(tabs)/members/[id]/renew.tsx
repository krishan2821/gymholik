import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { safeBack } from '../../../../src/utils/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CheckCircle, Send } from 'lucide-react-native';
import { useTheme, useStyles, ThemeValue } from '../../../../src/theme/ThemeContext';
import { Screen } from '../../../../src/components/Screen';
import { PageHeader } from '../../../../src/components/PageHeader';
import { GlassCard } from '../../../../src/components/GlassCard';
import { Button } from '../../../../src/components/Button';
import { Badge } from '../../../../src/components/Badge';
import { PlanPicker } from '../../../../src/components/PlanPicker';
import { useRenewMember, useMember } from '../../../../src/api/members';
import { usePlans } from '../../../../src/api/plans';
import { useGymProfile } from '../../../../src/api/more';
import { useAuthStore } from '../../../../src/store/useAuthStore';
import { addDays, format, isBefore, parseISO } from 'date-fns';
import { RENEW, FIELDS, MEMBERS } from '../../../../src/constants/strings';
import { formatMoney, isPhoneMasked } from '../../../../src/utils/formatters';
import { safeOpenURL } from '../../../../src/utils/safeLinking';

const renewSchema = z.object({
  planId: z.string().min(1, 'Please select a plan'),
  paidAmount: z.string().optional(),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD']).optional(),
});

type RenewFormData = z.infer<typeof renewSchema>;

export default function RenewMemberScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const role = user?.role || useAuthStore((state) => state.role);
  const isOwner = role === 'OWNER';
  const isStaff = role === 'STAFF';
  const { data: gymProfile } = useGymProfile({ enabled: isOwner || isStaff });

  const { data: member, isLoading: isLoadingMember } = useMember(id as string);
  const { data: plans } = usePlans();
  const renewMutation = useRenewMember();

  const [successResult, setSuccessResult] = useState<{
    memberId: string;
    memberName: string;
    memberPhone?: string;
    paidAmountPaise: number;
    remainingDuePaise: number;
    planName?: string;
  } | null>(null);

  const successCheckScale = useRef(new Animated.Value(0.5)).current;
  const successCheckOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (successResult) {
      Animated.parallel([
        Animated.spring(successCheckScale, {
          toValue: 1,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(successCheckOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [successResult]);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
    setError,
  } = useForm<RenewFormData>({
    resolver: zodResolver(renewSchema),
    defaultValues: {
      planId: '',
      paidAmount: '',
      paymentMode: 'CASH',
    },
  });

  const selectedPlanId = watch('planId');
  const paidAmountStr = watch('paidAmount');
  const selectedPaymentMode = watch('paymentMode');
  const selectedPlan = plans?.find((p) => p.id === selectedPlanId);

  const canSendWhatsApp = useMemo(() => {
    if (!successResult?.memberPhone) return false;
    if (isPhoneMasked(successResult.memberPhone)) return false;
    if (isOwner) return true;
    if (isStaff && gymProfile?.staffCanSeeFullPhone) return true;
    return false;
  }, [successResult, isOwner, isStaff, gymProfile]);

  const handleSendWhatsApp = () => {
    if (!successResult?.memberPhone) return;
    const phone = successResult.memberPhone;
    const amtStr = formatMoney(successResult.paidAmountPaise);
    const gymName = gymProfile?.name || 'our gym';
    const planName = successResult.planName || 'membership';
    const balStr =
      successResult.remainingDuePaise === 0
        ? 'All fees paid in full'
        : `Balance due: ${formatMoney(successResult.remainingDuePaise)}`;
    const msg = `Hello ${successResult.memberName}, your ${planName} membership at ${gymName} has been renewed! Fee paid: ${amtStr}. ${balStr}.`;
    safeOpenURL(`https://wa.me/91${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`);
  };

  if (isLoadingMember || !member) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  // Calculate Start Date
  let startDate = new Date();
  if (member.currentMembership && member.currentMembership.status !== 'EXPIRED') {
    try {
      const currentExpiry = parseISO(member.currentMembership.expiryDate);
      if (!isBefore(currentExpiry, new Date())) {
        startDate = currentExpiry;
      }
    } catch {}
  }

  // Calculate Expiry Date
  let expiryDate = '';
  if (selectedPlan) {
    try {
      expiryDate = format(addDays(startDate, selectedPlan.durationDays), 'dd MMM yyyy');
    } catch {}
  }

  const totalAmount = selectedPlan?.pricePaise || 0;
  const paidAmount = paidAmountStr ? parseInt(paidAmountStr, 10) * 100 : 0;
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  const onSubmit = async (data: RenewFormData) => {
    if (paidAmount > totalAmount) {
      setError('paidAmount', { message: 'Cannot pay more than total' });
      return;
    }

    try {
      const payload = {
        planId: data.planId,
        paidAmount: paidAmount,
        paymentMode: data.paymentMode,
      };

      const res = await renewMutation.mutateAsync({ id: id as string, payload });
      const membership = res?.data;
      const memDue = membership?.duePaise ?? dueAmount;

      setSuccessResult({
        memberId: id as string,
        memberName: member.name,
        memberPhone: member.phone,
        paidAmountPaise: paidAmount,
        remainingDuePaise: memDue,
        planName: selectedPlan?.name,
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: RENEW.ERROR_TITLE,
        text2: error.response?.data?.message || 'Failed to renew membership',
      });
    }
  };

  if (successResult) {
    return (
      <Screen style={styles.centerContainer}>
        <View style={styles.successCard}>
          <Animated.View
            style={[
              styles.successIconCircle,
              {
                transform: [{ scale: successCheckScale }],
                opacity: successCheckOpacity,
              },
            ]}
          >
            <CheckCircle color={colors.primary} size={64} strokeWidth={2.4} />
          </Animated.View>

          <Text style={styles.successTitle}>Membership Renewed Successfully</Text>
          <Text style={styles.successAmount}>{formatMoney(successResult.paidAmountPaise)}</Text>
          <Text style={styles.successSub}>
            {successResult.paidAmountPaise > 0
              ? `Renewal payment received via ${selectedPaymentMode || 'CASH'}`
              : 'No renewal payment recorded'}
          </Text>

          <View style={styles.successBalanceBadge}>
            <View style={{ marginTop: 8 }}>
              {successResult.remainingDuePaise === 0 ? (
                <Badge label="All fees paid in full" variant="paid" size="md" />
              ) : (
                <Badge
                  label={`Balance due: ${formatMoney(successResult.remainingDuePaise)}`}
                  variant="due"
                  size="md"
                />
              )}
            </View>
          </View>

          <View style={styles.successActionsColumn}>
            {canSendWhatsApp && (
              <Button
                title="Send on WhatsApp"
                icon={<Send size={18} color={colors.text} />}
                onPress={handleSendWhatsApp}
                variant="secondary"
                size="md"
                style={styles.actionBtn}
              />
            )}

            <View style={styles.successBottomRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Button
                  title="View Member"
                  variant="primary"
                  size="md"
                  onPress={() => router.replace(`/(tabs)/members/${successResult.memberId}`)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Done"
                  variant="secondary"
                  size="md"
                  onPress={() => safeBack('/(tabs)/members')}
                />
              </View>
            </View>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable keyboardAvoiding contentContainerStyle={styles.scroll}>
      <PageHeader
        title={RENEW.HEADING(member.name)}
        showBack
        onBack={() => safeBack('/(tabs)/members')}
      />

      <GlassCard style={styles.card} contentStyle={styles.cardContent}>
        <Text style={styles.sectionTitle}>{RENEW.SECTION_PLAN}</Text>

        <Text style={styles.label}>{FIELDS.PLAN}</Text>
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
            <Text style={styles.summaryText}>
              {RENEW.PLAN_STARTS(format(startDate, 'dd MMM yyyy'))}
            </Text>
            <Text style={styles.summaryText}>{RENEW.PLAN_EXPIRES(expiryDate)}</Text>
            <Text style={styles.summaryText}>
              {RENEW.PLAN_FEE(String(totalAmount / 100))}
            </Text>
          </View>
        )}

        <Text style={[styles.label, { marginTop: 14 }]}>{MEMBERS.LABEL_AMOUNT_PAID}</Text>
        <Controller
          control={control}
          name="paidAmount"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={[styles.input, errors.paidAmount && styles.inputError]}
              placeholder="e.g. 1000"
              placeholderTextColor={colors.textSecondary}
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
          <View style={{ marginVertical: 8 }}>
            <Badge
              label={RENEW.DUE_REMAINING(String(dueAmount / 100))}
              variant="due"
              size="sm"
            />
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

      <View style={styles.submitContainer}>
        <Button
          title={RENEW.SUBMIT}
          onPress={handleSubmit(onSubmit)}
          loading={renewMutation.isPending}
          size="md"
        />
      </View>
    </Screen>
  );
}

const makeStyles = (theme: ThemeValue) => StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  header: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  card: {
    marginBottom: theme.spacing.lg,
  },
  cardContent: {
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.h3,
    marginBottom: theme.spacing.md,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    minHeight: 52, // 44px+ tap target
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 15,
    color: theme.colors.text,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  errorText: {
    ...theme.typography.small,
    color: theme.colors.danger,
    marginTop: 4,
    marginLeft: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  chip: {
    flex: 1,
    minHeight: 44, // 44px tap target
    backgroundColor: theme.colors.surfaceRaised,
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
    backgroundColor: theme.colors.surfaceRaised,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  summaryText: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginBottom: 4,
  },
  dueText: {
    ...theme.typography.small,
    color: theme.colors.danger,
    marginTop: 6,
    fontWeight: '700',
  },
  submitContainer: {
    marginTop: theme.spacing.md,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  successCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
    maxWidth: 480,
    width: '100%',
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 20,
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  successAmount: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 32,
    color: theme.colors.primary,
    marginBottom: 6,
  },
  successSub: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  successBalanceBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radius.full,
    marginBottom: 24,
  },
  successBalanceText: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 13,
    color: theme.colors.accent,
  },
  successActionsColumn: {
    width: '100%',
    gap: 12,
  },
  actionBtn: {
    width: '100%',
  },
  successBottomRow: {
    flexDirection: 'row',
    width: '100%',
  },
});
