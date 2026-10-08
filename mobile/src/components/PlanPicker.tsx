import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ChevronDown, X, Check, Plus } from 'lucide-react-native';
import { theme } from '../theme/theme';
import { usePlans, useAddPlan } from '../api/plans';
import { Button } from './Button';

export interface PlanPickerProps {
  value: string;
  onChange: (planId: string) => void;
  error?: string;
  label?: string;
}

export const PlanPicker: React.FC<PlanPickerProps> = ({
  value,
  onChange,
  error,
  label,
}) => {
  const { data: plans, isLoading, refetch, isRefetching } = usePlans();
  const addPlanMutation = useAddPlan();

  const [modalVisible, setModalVisible] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Quick Create Form state
  const [newName, setNewName] = useState('');
  const [newDays, setNewDays] = useState('30');
  const [newPrice, setNewPrice] = useState('');
  const [createError, setCreateError] = useState('');

  const selectedPlan = plans?.find((p) => p.id === value);

  const handleOpen = () => {
    refetch();
    setModalVisible(true);
  };

  const handleCreatePlan = async () => {
    if (!newName.trim()) {
      setCreateError('Plan name is required');
      return;
    }
    const days = parseInt(newDays, 10);
    if (!days || days < 1) {
      setCreateError('Duration must be at least 1 day');
      return;
    }
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) {
      setCreateError('Please enter a valid price');
      return;
    }

    try {
      setCreateError('');
      const res = await addPlanMutation.mutateAsync({
        name: newName.trim(),
        durationDays: days,
        pricePaise: Math.round(price * 100),
      });

      const createdId = res?.data?.id || res?.id;
      if (createdId) {
        onChange(createdId);
      }
      setNewName('');
      setNewDays('30');
      setNewPrice('');
      setShowCreateModal(false);
      setModalVisible(false);
    } catch (e: any) {
      setCreateError(e.response?.data?.message || 'Failed to create plan');
    }
  };

  return (
    <View style={styles.root}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.inputContainer, error && styles.inputError]}
        onPress={handleOpen}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={label || 'Select plan'}
      >
        <Text style={[styles.text, !selectedPlan && styles.placeholder]}>
          {selectedPlan
            ? `${selectedPlan.name} (₹${selectedPlan.pricePaise / 100})`
            : 'Select a plan'}
        </Text>
        <ChevronDown color={theme.colors.primary} size={20} />
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Main Plan Picker Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Membership Plan</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => setShowCreateModal(true)}
                style={styles.addPlanHeaderBtn}
                accessibilityRole="button"
                accessibilityLabel="Create new plan"
              >
                <Plus size={16} color={theme.colors.primary} />
                <Text style={styles.addPlanHeaderText}>New Plan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close plan picker"
              >
                <X color={theme.colors.text} size={22} />
              </TouchableOpacity>
            </View>
          </View>

          {isLoading && !isRefetching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading plans…</Text>
            </View>
          ) : (
            <FlatList
              data={plans}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              refreshing={isRefetching}
              onRefresh={refetch}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>No plans found</Text>
                  <Text style={styles.emptySubtitle}>
                    Create a membership plan to assign to this member.
                  </Text>
                  <Button
                    title="+ Create First Plan"
                    onPress={() => setShowCreateModal(true)}
                    size="md"
                    style={{ marginTop: 18 }}
                  />
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = item.id === value;
                return (
                  <TouchableOpacity
                    style={[styles.planCard, isSelected && styles.planCardSelected]}
                    onPress={() => {
                      onChange(item.id);
                      setModalVisible(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.planCardContent}>
                      <View style={styles.planInfo}>
                        <Text style={styles.planName}>{item.name}</Text>
                        <Text style={styles.planDetails}>
                          Duration: {item.durationDays} days • ₹{item.pricePaise / 100}
                        </Text>
                      </View>
                      {isSelected && (
                        <View style={styles.checkCircle}>
                          <Check size={16} color={theme.colors.textOnPrimary} />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Inline Quick Add Plan Modal */}
      <Modal
        visible={showCreateModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.createModalBackdrop}
        >
          <View style={styles.createModalCard}>
            <View style={styles.createModalHeader}>
              <Text style={styles.createModalTitle}>Create New Plan</Text>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                style={styles.closeBtn}
              >
                <X color={theme.colors.textMuted} size={20} />
              </TouchableOpacity>
            </View>

            {createError ? (
              <Text style={styles.createModalError}>{createError}</Text>
            ) : null}

            <Text style={styles.inputLabel}>Plan Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 1 Month Regular"
              placeholderTextColor={theme.colors.textMuted}
              value={newName}
              onChangeText={setNewName}
            />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Duration (Days)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="30"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="number-pad"
                  value={newDays}
                  onChangeText={setNewDays}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Price (₹)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="1500"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                  value={newPrice}
                  onChangeText={setNewPrice}
                />
              </View>
            </View>

            <View style={styles.createModalActions}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setShowCreateModal(false)}
                size="md"
                style={{ flex: 1 }}
              />
              <Button
                title="Save & Select"
                onPress={handleCreatePlan}
                loading={addPlanMutation.isPending}
                size="md"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    marginBottom: theme.spacing.md,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 6,
    marginLeft: 4,
  },
  inputContainer: {
    minHeight: 56, // 44px+ tap target
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  text: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  placeholder: {
    color: theme.colors.textMuted,
  },
  errorText: {
    ...theme.typography.small,
    color: theme.colors.error,
    marginTop: 4,
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  headerTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: theme.spacing.md,
  },
  loadingText: {
    padding: theme.spacing.xl,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  planCard: {
    minHeight: 64, // 44px+ tap target
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    justifyContent: 'center',
  },
  planCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.raised,
  },
  planCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    marginBottom: 4,
  },
  planDetails: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addPlanHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(142, 182, 155, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(142, 182, 155, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  addPlanHeaderText: {
    ...theme.typography.caption,
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyContainer: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  createModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  createModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  createModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  createModalTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  createModalError: {
    ...theme.typography.caption,
    color: theme.colors.error,
    marginBottom: theme.spacing.sm,
  },
  inputLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 6,
    marginLeft: 2,
  },
  textInput: {
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 15,
    fontFamily: theme.fonts.bodyRegular,
  },
  createModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: theme.spacing.xl,
  },
});

export default PlanPicker;
