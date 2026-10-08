import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { theme } from '../../../../src/theme/theme';
import { Screen } from '../../../../src/components/Screen';
import { GlassCard } from '../../../../src/components/GlassCard';
import { Button } from '../../../../src/components/Button';
import { PlanPicker } from '../../../../src/components/PlanPicker';
import { useRenewMember, useMember } from '../../../../src/api/members';
import { usePlans } from '../../../../src/api/plans';
import { addDays, format, isBefore, parseISO } from 'date-fns';
import { RENEW, FIELDS, MEMBERS } from '../../../../src/constants/strings';

const renewSchema = z.object({
  planId: z.string().min(1, 'Please select a plan'),
  paidAmount: z.string().optional(),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD']).optional(),
});

type RenewFormData = z.infer<typeof renewSchema>;

export default function RenewMemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: member, isLoading: isLoadingMember } = useMember(id as string);
  const { data: plans } = usePlans();
  const renewMutation = useRenewMember();

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

  if (isLoadingMember || !member) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  const selectedPlanId = watch('planId');
  const paidAmountStr = watch('paidAmount');
  const selectedPlan = plans?.find((p) => p.id === selectedPlanId);

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
  const paidAmount = paidAmountStr ? parseInt(paidAmountStr) * 100 : 0;
  const dueAmount = totalAmount - paidAmount;

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

      await renewMutation.mutateAsync({ id: id as string, payload });
      router.back();
    } catch (error: any) {
      Alert.alert(RENEW.ERROR_TITLE, error.response?.data?.message || 'Failed to renew membership');
    }
  };

  return (
    <Screen scrollable keyboardAvoiding contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.title}>{RENEW.HEADING(member.name)}</Text>
      </View>

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
          <Text style={styles.dueText}>
            {RENEW.DUE_REMAINING(String(dueAmount / 100))}
          </Text>
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

const styles = StyleSheet.create({
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
    color: theme.colors.textMuted,
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    backgroundColor: theme.colors.raised,
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
    minHeight: 44, // 44px tap target
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
    color: theme.colors.textOnPrimary, // #051F20 contrast
    fontWeight: '700',
  },
  planSummary: {
    backgroundColor: theme.colors.raised,
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
    color: theme.colors.error,
    marginTop: 6,
    fontWeight: '700',
  },
  submitContainer: {
    marginTop: theme.spacing.md,
  },
});
