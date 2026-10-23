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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, X, Edit2, Calendar, PowerOff, RotateCcw } from 'lucide-react-native';
import { useTheme, useStyles, ThemeValue } from '../../../src/theme/ThemeContext';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { usePlans, useAddPlan, useUpdatePlan, useDeletePlan, Plan } from '../../../src/api/plans';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorState } from '../../../src/components/ErrorState';
import { EmptyState } from '../../../src/components/EmptyState';
import { Screen, getScreenBottomPadding } from '../../../src/components/Screen';
import { GlassCard } from '../../../src/components/GlassCard';
import { Badge } from '../../../src/components/Badge';
import { Button } from '../../../src/components/Button';
import { PLANS, ERRORS, COMMON } from '../../../src/constants/strings';
import { useBreakpoint } from '../../../src/hooks/useBreakpoint';
import { PageHeader } from '../../../src/components/PageHeader';
import { formatMoney } from '../../../src/utils/formatters';
import { safeBack } from '../../../src/utils/navigation';
import { showConfirmDialog } from '../../../src/components/ConfirmDialog';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  durationDays: z.string().regex(/^[0-9]+$/, 'Must be a valid number of days'),
  price: z.string().regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Must be a valid amount'),
});
type FormData = z.infer<typeof schema>;

export default function PlansScreen() {
  const insets = useSafeAreaInsets();
  const { role } = useAuthStore();
  const { isPhone } = useBreakpoint();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const { data: plans, isLoading, isError, refetch } = usePlans(false);
  const addPlan = useAddPlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();

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
      <Screen safeTop={true}>
        <PageHeader title={PLANS.SCREEN_TITLE} showBack onBack={() => safeBack('/(tabs)/more')} />
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen safeTop={true} style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen safeTop={true}>
        <PageHeader title={PLANS.SCREEN_TITLE} showBack onBack={() => safeBack('/(tabs)/more')} />
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

  const handleDeactivatePlan = (plan: Plan) => {
    showConfirmDialog({
      title: PLANS.DEACTIVATE_CONFIRM_TITLE,
      message: PLANS.DEACTIVATE_CONFIRM_MSG(plan.name),
      confirmText: PLANS.DEACTIVATE_BTN,
      cancelText: COMMON.CANCEL,
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deletePlan.mutateAsync(plan.id);
        } catch {
          // handled in mutation
        }
      },
    });
  };

  const handleReactivatePlan = (plan: Plan) => {
    showConfirmDialog({
      title: 'Reactivate plan?',
      message: `Reactivate "${plan.name}" so members can subscribe to it again?`,
      confirmText: 'Reactivate',
      cancelText: COMMON.CANCEL,
      onConfirm: async () => {
        try {
          await updatePlan.mutateAsync({
            id: plan.id,
            payload: {
              name: plan.name,
              durationDays: plan.durationDays,
              pricePaise: plan.pricePaise,
            },
          });
        } catch {
          // handled in mutation
        }
      },
    });
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
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || PLANS.SAVE_ERROR });
    }
  };

  const renderItem = ({ item }: { item: Plan }) => {
    const isInactive = item.active === false;
    return (
      <GlassCard
        style={[styles.card, isInactive && styles.cardInactive]}
        contentStyle={styles.cardContent}
      >
        <View style={styles.cardLeft}>
          <Text style={[styles.name, isInactive && styles.nameInactive]} numberOfLines={1} ellipsizeMode="tail">
            {item.name}
          </Text>
          <View style={styles.chipsRow}>
            <View style={styles.durationBadge}>
              <Calendar size={13} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.durationText}>{item.durationDays} Days</Text>
            </View>
            {isInactive && (
              <Badge label="Inactive" variant="neutral" size="sm" />
            )}
          </View>
        </View>

        <View style={styles.cardRight}>
          <Text style={[styles.priceText, isInactive && styles.priceInactive]}>
            {formatMoney(item.pricePaise)}
          </Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => openEditModal(item)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Edit2 color={colors.text} size={18} />
          </TouchableOpacity>
          {item.active !== false ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={() => handleDeactivatePlan(item)}
              accessibilityRole="button"
              accessibilityLabel={`Deactivate ${item.name}`}
              disabled={deletePlan.isPending}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <PowerOff size={18} color={colors.danger} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.reactivateBtn]}
              onPress={() => handleReactivatePlan(item)}
              accessibilityRole="button"
              accessibilityLabel={`Reactivate ${item.name}`}
              disabled={updatePlan.isPending}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <RotateCcw size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </GlassCard>
    );
  };

  const planCount = plans?.length || 0;
  const subtitle = `${planCount} ${planCount === 1 ? 'plan' : 'plans'}`;

  return (
    <Screen safeTop={true} safeBottom={false} style={styles.container}>
      <PageHeader
        title="Membership plans"
        subtitle={subtitle}
        showBack
        onBack={() => safeBack('/(tabs)/more')}
        rightAction={
          <Button
            title="+ Add plan"
            onPress={openAddModal}
            variant="primary"
            size="sm"
            fullWidth={false}
            style={{ paddingHorizontal: 14 }}
          />
        }
      />

      <FlatList
        data={plans}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: getScreenBottomPadding(insets.bottom) }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            message={PLANS.EMPTY}
            actionLabel="+ Add plan"
            onAction={openAddModal}
          />
        }
      />

      <Modal
        visible={showModal}
        transparent
        animationType={isPhone ? 'slide' : 'fade'}
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalOverlay, !isPhone && styles.modalOverlayDesktop]}
        >
          <View style={[styles.modalContent, !isPhone && styles.modalContentDesktop]}>
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
                <X color={colors.textSecondary} size={22} />
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
                  placeholderTextColor={colors.textSecondary}
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
                  placeholderTextColor={colors.textSecondary}
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
                  placeholderTextColor={colors.textSecondary}
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

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    list: {
      paddingVertical: theme.spacing.sm,
      paddingBottom: 40,
    },
    card: {
      marginBottom: theme.spacing.sm,
    },
    cardInactive: {
      opacity: 0.55,
    },
    cardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    cardLeft: {
      flex: 1,
      minWidth: 0,
      marginRight: theme.spacing.md,
    },
    name: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: 6,
    },
    nameInactive: {
      color: theme.colors.textSecondary,
    },
    chipsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    durationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceRaised,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    durationText: {
      ...theme.typography.small,
      color: theme.colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    cardRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      flexShrink: 0,
    },
    priceText: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 17,
      color: theme.colors.text,
      fontVariant: ['tabular-nums'],
      marginRight: theme.spacing.xs,
    },
    priceInactive: {
      color: theme.colors.textSecondary,
    },
    actionBtn: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteBtn: {
      backgroundColor: theme.colors.chipDangerBg,
    },
    reactivateBtn: {
      backgroundColor: theme.colors.surfaceRaised,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.scrim,
      justifyContent: 'flex-end',
    },
    modalOverlayDesktop: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.xl,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalContentDesktop: {
      borderRadius: theme.radius.xl,
      width: '100%',
      maxWidth: 440,
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
      minHeight: 50,
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 15,
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    inputError: {
      borderColor: theme.colors.danger,
    },
    errorText: {
      ...theme.typography.small,
      color: theme.colors.danger,
      marginTop: -8,
      marginBottom: theme.spacing.sm,
      marginLeft: 4,
    },
    modalActionRow: {
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
    },
  });