import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, X, Edit2, Calendar, ShieldCheck } from 'lucide-react-native';
import { theme } from '../../../src/theme/theme';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { usePlans, useAddPlan, useUpdatePlan, Plan } from '../../../src/api/plans';
import { ErrorState } from '../../../src/components/ErrorState';
import { EmptyState } from '../../../src/components/EmptyState';
import { Screen } from '../../../src/components/Screen';
import { GlassCard } from '../../../src/components/GlassCard';
import { Button } from '../../../src/components/Button';
import { PLANS, ERRORS } from '../../../src/constants/strings';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  durationDays: z.string().regex(/^[0-9]+$/, 'Must be a valid number of days'),
  price: z.string().regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Must be a valid amount'),
});
type FormData = z.infer<typeof schema>;

export default function PlansScreen() {
  const { role } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const { data: plans, isLoading, isError, refetch } = usePlans(false);
  const addPlan = useAddPlan();
  const updatePlan = useUpdatePlan();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  if (role !== 'OWNER') {
    return (
      <Screen safeTop={false}>
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen safeTop={false} style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen safeTop={false}>
        <ErrorState message={PLANS.LOAD_ERROR} onRetry={() => refetch()} />
      </Screen>
    );
  }

  const openAddModal = () => {
    setEditingPlan(null);
    reset({ name: '', durationDays: '', price: '' });
    setShowModal(true);
  };

  const openEditModal = (plan: Plan) => {
    setEditingPlan(plan);
    reset({
      name: plan.name,
      durationDays: String(plan.durationDays),
      price: String(plan.pricePaise / 100),
    });
    setShowModal(true);
  };

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      durationDays: parseInt(data.durationDays, 10),
      pricePaise: Math.round(parseFloat(data.price) * 100),
    };

    try {
      if (editingPlan) {
        await updatePlan.mutateAsync({ id: editingPlan.id, payload });
      } else {
        await addPlan.mutateAsync(payload);
      }
      setShowModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || PLANS.SAVE_ERROR);
    }
  };

  const renderItem = ({ item }: { item: Plan }) => (
    <GlassCard style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.badgeRow}>
          <View style={styles.durationBadge}>
            <Calendar size={13} color={theme.colors.primary} style={{ marginRight: 4 }} />
            <Text style={styles.durationText}>{item.durationDays} Days</Text>
          </View>
          <Text style={styles.priceText}>₹{item.pricePaise / 100}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.editBtn}
        onPress={() => openEditModal(item)}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${item.name}`}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Edit2 color={theme.colors.primary} size={18} />
      </TouchableOpacity>
    </GlassCard>
  );

  return (
    <Screen safeTop={false} style={styles.container}>
      <View style={styles.actionHeader}>
        <View>
          <Text style={styles.counterText}>
            {plans?.length || 0} {plans?.length === 1 ? 'Plan' : 'Plans'} Available
          </Text>
        </View>
        <Button
          title={PLANS.ADD_BTN}
          onPress={openAddModal}
          variant="primary"
          size="sm"
          fullWidth={false}
          icon={<Plus color={theme.colors.textOnPrimary} size={16} />}
        />
      </View>

      <FlatList
        data={plans}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState message={PLANS.EMPTY} />}
      />

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingPlan ? PLANS.MODAL_EDIT_TITLE : PLANS.MODAL_ADD_TITLE}
              </Text>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X color={theme.colors.textMuted} size={22} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{PLANS.NAME_LABEL}</Text>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[styles.input, errors.name && styles.inputError]}
                  placeholder={PLANS.NAME_PLACEHOLDER}
                  placeholderTextColor={theme.colors.textMuted}
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name.message}</Text>}

            <Text style={styles.label}>{PLANS.DURATION_LABEL}</Text>
            <Controller
              control={control}
              name="durationDays"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[styles.input, errors.durationDays && styles.inputError]}
                  placeholder={PLANS.DURATION_PLACEHOLDER}
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.durationDays && (
              <Text style={styles.errorText}>{errors.durationDays.message}</Text>
            )}

            <Text style={styles.label}>{PLANS.PRICE_LABEL}</Text>
            <Controller
              control={control}
              name="price"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[styles.input, errors.price && styles.inputError]}
                  placeholder={PLANS.PRICE_PLACEHOLDER}
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="decimal-pad"
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.price && <Text style={styles.errorText}>{errors.price.message}</Text>}

            <View style={styles.modalActionRow}>
              <Button
                title={editingPlan ? PLANS.UPDATE_BTN : PLANS.CREATE_BTN}
                onPress={handleSubmit(onSubmit)}
                loading={addPlan.isPending || updatePlan.isPending}
                disabled={addPlan.isPending || updatePlan.isPending}
                variant="primary"
                size="lg"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  counterText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.bodyRegular,
  },
  list: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  cardInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  name: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 17,
    color: theme.colors.text,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.raised,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  durationText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
  },
  priceText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 16,
    color: theme.colors.text,
  },
  editBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  modalTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
    color: theme.colors.text,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
    minHeight: 50,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    ...theme.typography.small,
    color: theme.colors.error,
    marginTop: -8,
    marginBottom: theme.spacing.sm,
    marginLeft: 4,
  },
  modalActionRow: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
});
