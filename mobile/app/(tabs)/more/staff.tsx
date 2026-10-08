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
import { Plus, X, Phone, Lock, User } from 'lucide-react-native';
import { theme } from '../../../src/theme/theme';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { useStaffList, useAddStaff } from '../../../src/api/more';
import { Screen } from '../../../src/components/Screen';
import { GlassCard } from '../../../src/components/GlassCard';
import { Button } from '../../../src/components/Button';
import { Badge } from '../../../src/components/Badge';
import { Avatar } from '../../../src/components/Avatar';
import { ErrorState } from '../../../src/components/ErrorState';
import { EmptyState } from '../../../src/components/EmptyState';
import { STAFF, ERRORS, FIELDS, VALIDATION } from '../../../src/constants/strings';

const schema = z.object({
  name: z.string().min(2, VALIDATION.MIN_LENGTH(FIELDS.NAME, 2)),
  phone: z.string().regex(/^[0-9]{10}$/, VALIDATION.PHONE_INVALID),
  password: z.string().min(6, VALIDATION.MIN_LENGTH(FIELDS.PASSWORD, 6)),
});
type FormData = z.infer<typeof schema>;

export default function StaffScreen() {
  const { role } = useAuthStore();
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: staff, isLoading, isError, refetch } = useStaffList();
  const addStaff = useAddStaff();

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
        <ErrorState message={STAFF.LOAD_ERROR} onRetry={() => refetch()} />
      </Screen>
    );
  }

  const onSubmit = async (data: FormData) => {
    try {
      await addStaff.mutateAsync(data);
      reset();
      setShowAddModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || STAFF.ADD_ERROR);
    }
  };

  const renderItem = ({ item }: any) => (
    <GlassCard style={styles.card}>
      <View style={styles.cardLeft}>
        <Avatar
          name={item.name}
          status={item.active ? 'active' : 'none'}
          size="md"
        />
        <View style={styles.cardInfo}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.phoneRow}>
            <Phone size={12} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={styles.phone}>{item.phone}</Text>
          </View>
        </View>
      </View>
      <Badge
        label={item.active ? 'Active' : 'Inactive'}
        variant={item.active ? 'success' : 'error'}
        size="sm"
      />
    </GlassCard>
  );

  return (
    <Screen safeTop={false} style={styles.container}>
      <View style={styles.actionHeader}>
        <Text style={styles.counterText}>
          {staff?.length || 0} {staff?.length === 1 ? 'Staff Member' : 'Staff Members'}
        </Text>
        <Button
          title={STAFF.ADD_BTN}
          onPress={() => setShowAddModal(true)}
          variant="primary"
          size="sm"
          fullWidth={false}
          icon={<Plus color={theme.colors.textOnPrimary} size={16} />}
        />
      </View>

      <FlatList
        data={staff}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState message={STAFF.EMPTY} />}
      />

      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{STAFF.MODAL_TITLE}</Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X color={theme.colors.textMuted} size={22} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{FIELDS.NAME}</Text>
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
                />
              )}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name.message}</Text>}

            <Text style={styles.label}>{FIELDS.PHONE}</Text>
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[styles.input, errors.phone && styles.inputError]}
                  placeholder={FIELDS.PHONE_PLACEHOLDER}
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="phone-pad"
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.phone && <Text style={styles.errorText}>{errors.phone.message}</Text>}

            <Text style={styles.label}>{FIELDS.PASSWORD}</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[styles.input, errors.password && styles.inputError]}
                  placeholder={FIELDS.PASSWORD}
                  placeholderTextColor={theme.colors.textMuted}
                  secureTextEntry
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}

            <View style={styles.modalActionRow}>
              <Button
                title={STAFF.SUBMIT}
                onPress={handleSubmit(onSubmit)}
                loading={addStaff.isPending}
                disabled={addStaff.isPending}
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
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: theme.spacing.md,
  },
  cardInfo: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  name: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 4,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phone: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
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
