import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRightLeft,
  ChevronRight,
  Plus,
  Check,
  Tag,
  X,
  Phone,
} from 'lucide-react-native';
import { theme } from '../../../../src/theme/theme';
import { useAuthStore } from '../../../../src/store/useAuthStore';
import {
  useTrainers,
  useTrainerTypes,
  useCreateTrainerType,
  useApproveTrainer,
  useRejectTrainer,
  useReassignTrainer,
  Trainer,
  TrainerType,
} from '../../../../src/api/trainers';
import { Screen } from '../../../../src/components/Screen';
import { GlassCard } from '../../../../src/components/GlassCard';
import { Avatar } from '../../../../src/components/Avatar';
import { Badge } from '../../../../src/components/Badge';
import { Button } from '../../../../src/components/Button';
import { FilterChips } from '../../../../src/components/FilterChips';
import { EmptyState } from '../../../../src/components/EmptyState';
import { ErrorState } from '../../../../src/components/ErrorState';
import { TRAINERS, COMMON, ERRORS } from '../../../../src/constants/strings';

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING_APPROVAL', label: 'Pending' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export default function TrainersScreen() {
  const router = useRouter();
  const { role } = useAuthStore();
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const {
    data: trainers,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useTrainers(selectedStatus === 'ALL' ? undefined : selectedStatus);

  const { data: allTypes, refetch: refetchTypes } = useTrainerTypes();
  const createType = useCreateTrainerType();
  const approveTrainer = useApproveTrainer();
  const rejectTrainer = useRejectTrainer();
  const reassignTrainer = useReassignTrainer();

  // ─── Approve Bottom Sheet State ──────────────────────────────
  const [approvingTrainer, setApprovingTrainer] = useState<Trainer | null>(null);
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [newTypeModalVisible, setNewTypeModalVisible] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  // ─── Reassign Modal State ────────────────────────────────────
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [fromTrainerId, setFromTrainerId] = useState<string>('');
  const [toTrainerId, setToTrainerId] = useState<string>('');
  const [reassignNotes, setReassignNotes] = useState<string>('');

  if (role !== 'OWNER') {
    return (
      <Screen safeTop={false}>
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  // Check for deactivated trainers
  const deactivatedTrainers = useMemo(() => {
    if (!trainers) return [];
    return trainers.filter((t) => t.status === 'INACTIVE');
  }, [trainers]);

  const activeTrainers = useMemo(() => {
    if (!trainers) return [];
    return trainers.filter((t) => t.status === 'ACTIVE');
  }, [trainers]);

  const handleOpenApproveSheet = (trainer: Trainer) => {
    setApprovingTrainer(trainer);
    setSelectedTypeIds([]);
  };

  const toggleTypeId = (id: string) => {
    setSelectedTypeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirmApprove = async () => {
    if (!approvingTrainer) return;
    if (selectedTypeIds.length === 0) {
      Alert.alert('Required', 'Please select at least one trainer type');
      return;
    }

    try {
      await approveTrainer.mutateAsync({
        id: approvingTrainer.id,
        trainerTypeIds: selectedTypeIds,
      });
      setApprovingTrainer(null);
    } catch {
      // Toast displayed in mutation hook
    }
  };

  const handleReject = (trainer: Trainer) => {
    Alert.alert(
      TRAINERS.REJECT_CONFIRM_TITLE,
      TRAINERS.REJECT_CONFIRM_MSG(trainer.name),
      [
        { text: COMMON.CANCEL, style: 'cancel' },
        {
          text: TRAINERS.REJECT_BTN,
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectTrainer.mutateAsync(trainer.id);
            } catch {
              // Toast displayed in mutation hook
            }
          },
        },
      ]
    );
  };

  const handleAddNewTypeInline = async () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;
    try {
      const created = await createType.mutateAsync(trimmed);
      setNewTypeName('');
      setNewTypeModalVisible(false);
      refetchTypes();
      if (created?.id) {
        setSelectedTypeIds((prev) => [...prev, created.id]);
      }
    } catch {
      // Toast handled
    }
  };

  const handleExecuteReassign = async () => {
    if (!fromTrainerId || !toTrainerId) {
      Alert.alert('Error', 'Please select both source and destination trainers.');
      return;
    }
    if (fromTrainerId === toTrainerId) {
      Alert.alert('Error', 'Source and target trainer cannot be the same.');
      return;
    }

    try {
      await reassignTrainer.mutateAsync({
        fromTrainerId,
        toTrainerId,
        notes: reassignNotes.trim() || undefined,
      });
      setReassignModalVisible(false);
      setFromTrainerId('');
      setToTrainerId('');
      setReassignNotes('');
    } catch {
      // Toast handled
    }
  };

  const renderTrainerItem = ({ item }: { item: Trainer }) => {
    const isPending = item.status === 'PENDING_APPROVAL';
    const isInactive = item.status === 'INACTIVE';
    const statusLabel =
      item.status === 'PENDING_APPROVAL'
        ? TRAINERS.STATUS_PENDING
        : item.status === 'ACTIVE'
        ? TRAINERS.STATUS_ACTIVE
        : TRAINERS.STATUS_INACTIVE;
    const badgeVariant =
      item.status === 'ACTIVE'
        ? 'success'
        : item.status === 'PENDING_APPROVAL'
        ? 'warning'
        : 'neutral';

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push(`/(tabs)/more/trainers/${item.id}`)}
      >
        <GlassCard style={styles.card} contentStyle={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Avatar name={item.name} size="md" />
            <View style={styles.headerInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.trainerName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Badge label={statusLabel} variant={badgeVariant} size="sm" />
              </View>
              {item.phone ? (
                <View style={styles.phoneRow}>
                  <Phone size={12} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
                  <Text style={styles.phoneText}>{item.phone}</Text>
                </View>
              ) : null}
            </View>
            <ChevronRight size={20} color={theme.colors.textMuted} />
          </View>

          {/* Type Chips */}
          {item.trainerTypes && item.trainerTypes.length > 0 ? (
            <View style={styles.chipsRow}>
              {item.trainerTypes.map((type) => (
                <View key={type.id} style={styles.typeChip}>
                  <Text style={styles.typeChipText}>{type.name}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Bottom stats and pending actions */}
          <View style={styles.cardFooter}>
            <View style={styles.membersCountRow}>
              <Users size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.membersCountText}>
                {item.activeAssignmentsCount} assigned member
                {item.activeAssignmentsCount === 1 ? '' : 's'}
              </Text>
            </View>

            {isPending && (
              <View style={styles.pendingActionButtons}>
                <TouchableOpacity
                  style={[styles.smallBtn, styles.rejectBtn]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleReject(item);
                  }}
                  disabled={rejectTrainer.isPending}
                >
                  <Text style={styles.rejectBtnText}>{TRAINERS.REJECT_BTN}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.smallBtn, styles.approveBtn]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleOpenApproveSheet(item);
                  }}
                  disabled={approveTrainer.isPending}
                >
                  <Text style={styles.approveBtnText}>{TRAINERS.APPROVE_BTN}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  return (
    <Screen safeTop={false} contentContainerStyle={styles.container}>
      {/* ── Top Bar ────────────────────────────────────────────── */}
      <View style={styles.topActionsBar}>
        <View style={{ flex: 1 }}>
          <FilterChips
            options={STATUS_FILTERS}
            selectedValue={selectedStatus}
            onSelect={(val) => setSelectedStatus(val)}
          />
        </View>
        <TouchableOpacity
          style={styles.manageTypesBtn}
          onPress={() => router.push('/(tabs)/more/trainers/types')}
          accessibilityRole="button"
        >
          <Tag size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.manageTypesText}>{TRAINERS.MANAGE_TYPES_BTN}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Deactivated Trainer Banner (Requirement 7) ────────── */}
      {deactivatedTrainers.length > 0 && (
        <View style={styles.bannerContainer}>
          <GlassCard style={styles.bannerCard} contentStyle={styles.bannerContent}>
            <View style={styles.bannerHeader}>
              <AlertTriangle size={20} color={theme.colors.warning} style={{ marginRight: 8 }} />
              <Text style={styles.bannerTitle}>{TRAINERS.DEACTIVATED_BANNER_TITLE}</Text>
            </View>
            <Text style={styles.bannerDesc}>
              {deactivatedTrainers.map((t) => t.name).join(', ')} is inactive. Members may need
              reassignment.
            </Text>
            <TouchableOpacity
              style={styles.reassignActionBtn}
              onPress={() => {
                setFromTrainerId(deactivatedTrainers[0]?.id || '');
                setReassignModalVisible(true);
              }}
              accessibilityRole="button"
            >
              <ArrowRightLeft size={16} color={theme.colors.textOnPrimary} style={{ marginRight: 6 }} />
              <Text style={styles.reassignActionText}>{TRAINERS.REASSIGN_BTN}</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      )}

      {/* ── Trainers List ──────────────────────────────────────── */}
      {isLoading && !isRefetching ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : isError ? (
        <ErrorState message={TRAINERS.LOAD_ERROR} onRetry={() => refetch()} />
      ) : !trainers || trainers.length === 0 ? (
        <EmptyState
          icon={<Users size={48} color={theme.colors.primary} />}
          title={TRAINERS.EMPTY}
        />
      ) : (
        <FlatList
          data={trainers}
          keyExtractor={(item) => item.id}
          renderItem={renderTrainerItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}

      {/* ── Approve Modal (Bottom Sheet Style) ─────────────────── */}
      <Modal
        visible={!!approvingTrainer}
        transparent
        animationType="slide"
        onRequestClose={() => !approveTrainer.isPending && setApprovingTrainer(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheetContainer}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{TRAINERS.APPROVE_MODAL_TITLE}</Text>
              <TouchableOpacity
                onPress={() => setApprovingTrainer(null)}
                disabled={approveTrainer.isPending}
              >
                <X size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetDesc}>
              Approving {approvingTrainer?.name}. {TRAINERS.APPROVE_MODAL_DESC}
            </Text>

            <ScrollView style={styles.sheetTypesList} contentContainerStyle={{ paddingVertical: 8 }}>
              {allTypes && allTypes.length > 0 ? (
                allTypes
                  .filter((t) => t.active)
                  .map((t) => {
                    const isSelected = selectedTypeIds.includes(t.id);
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.typeSelectItem,
                          isSelected && styles.typeSelectItemActive,
                        ]}
                        onPress={() => toggleTypeId(t.id)}
                        disabled={approveTrainer.isPending}
                      >
                        <Text
                          style={[
                            styles.typeSelectText,
                            isSelected && styles.typeSelectTextActive,
                          ]}
                        >
                          {t.name}
                        </Text>
                        <View
                          style={[
                            styles.checkboxBox,
                            isSelected && styles.checkboxBoxActive,
                          ]}
                        >
                          {isSelected && <Check size={14} color={theme.colors.textOnPrimary} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })
              ) : (
                <Text style={styles.noTypesText}>No trainer types created yet.</Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.addNewTypeLink}
              onPress={() => setNewTypeModalVisible(true)}
              disabled={approveTrainer.isPending}
            >
              <Plus size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.addNewTypeLinkText}>{TRAINERS.ADD_TYPE_SHORTCUT}</Text>
            </TouchableOpacity>

            <View style={styles.sheetFooter}>
              <Button
                title={TRAINERS.APPROVE_CONFIRM_BTN}
                onPress={handleConfirmApprove}
                loading={approveTrainer.isPending}
                disabled={approveTrainer.isPending || selectedTypeIds.length === 0}
                size="lg"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add Type Inline Modal ───────────────────────────────── */}
      <Modal
        visible={newTypeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !createType.isPending && setNewTypeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.innerDialog}>
            <Text style={styles.dialogTitle}>Add New Trainer Type</Text>
            <TextInput
              style={styles.dialogInput}
              value={newTypeName}
              onChangeText={setNewTypeName}
              placeholder="e.g. CrossFit, Zumba, HIIT"
              placeholderTextColor={theme.colors.textMuted}
              autoFocus
              editable={!createType.isPending}
            />
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={styles.dialogCancelBtn}
                onPress={() => setNewTypeModalVisible(false)}
                disabled={createType.isPending}
              >
                <Text style={styles.dialogCancelText}>{COMMON.CANCEL}</Text>
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Button
                  title={COMMON.SAVE}
                  onPress={handleAddNewTypeInline}
                  loading={createType.isPending}
                  disabled={createType.isPending || !newTypeName.trim()}
                  size="sm"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Reassign Members Modal ──────────────────────────────── */}
      <Modal
        visible={reassignModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !reassignTrainer.isPending && setReassignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheetContainer}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{TRAINERS.REASSIGN_MODAL_TITLE}</Text>
              <TouchableOpacity
                onPress={() => setReassignModalVisible(false)}
                disabled={reassignTrainer.isPending}
              >
                <X size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetDesc}>{TRAINERS.REASSIGN_DESC}</Text>

            <ScrollView style={{ maxHeight: 350, marginVertical: 10 }}>
              <Text style={styles.selectLabel}>{TRAINERS.SELECT_SOURCE_TRAINER}</Text>
              <View style={styles.trainerChipsWrapper}>
                {trainers?.map((t) => {
                  const isSelected = fromTrainerId === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.trainerSelectChip,
                        isSelected && styles.trainerSelectChipActive,
                      ]}
                      onPress={() => setFromTrainerId(t.id)}
                    >
                      <Text
                        style={[
                          styles.trainerSelectChipText,
                          isSelected && styles.trainerSelectChipTextActive,
                        ]}
                      >
                        {t.name} ({t.status})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.selectLabel, { marginTop: 16 }]}>
                {TRAINERS.SELECT_TARGET_TRAINER} (Active Trainers)
              </Text>
              <View style={styles.trainerChipsWrapper}>
                {activeTrainers
                  .filter((t) => t.id !== fromTrainerId)
                  .map((t) => {
                    const isSelected = toTrainerId === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.trainerSelectChip,
                          isSelected && styles.trainerSelectChipActive,
                        ]}
                        onPress={() => setToTrainerId(t.id)}
                      >
                        <Text
                          style={[
                            styles.trainerSelectChipText,
                            isSelected && styles.trainerSelectChipTextActive,
                          ]}
                        >
                          {t.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>

              <Text style={[styles.selectLabel, { marginTop: 16 }]}>Notes (Optional)</Text>
              <TextInput
                style={styles.dialogInput}
                value={reassignNotes}
                onChangeText={setReassignNotes}
                placeholder="Reason for reassignment…"
                placeholderTextColor={theme.colors.textMuted}
              />
            </ScrollView>

            <View style={styles.sheetFooter}>
              <Button
                title={TRAINERS.REASSIGN_CONFIRM_BTN}
                onPress={handleExecuteReassign}
                loading={reassignTrainer.isPending}
                disabled={reassignTrainer.isPending || !fromTrainerId || !toTrainerId}
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
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topActionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  manageTypesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.raised,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  manageTypesText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingMedium,
  },
  bannerContainer: {
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  bannerCard: {
    backgroundColor: 'rgba(245, 181, 68, 0.10)',
    borderColor: 'rgba(245, 181, 68, 0.35)',
  },
  bannerContent: {
    padding: theme.spacing.md,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bannerTitle: {
    ...theme.typography.h3,
    fontSize: 15,
    color: theme.colors.warning,
  },
  bannerDesc: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  reassignActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignSelf: 'flex-start',
  },
  reassignActionText: {
    ...theme.typography.button,
    fontSize: 13,
    color: theme.colors.textOnPrimary,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  card: {
    marginBottom: theme.spacing.md,
  },
  cardContent: {
    padding: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: theme.spacing.sm,
  },
  trainerName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    fontSize: 16,
    flex: 1,
    marginRight: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  phoneText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.spacing.sm,
    gap: 6,
  },
  typeChip: {
    backgroundColor: theme.colors.raised,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  typeChipText: {
    ...theme.typography.small,
    color: theme.colors.primary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  membersCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  membersCountText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
  },
  pendingActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  rejectBtn: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
  },
  rejectBtnText: {
    ...theme.typography.small,
    color: theme.colors.error,
    fontFamily: theme.fonts.headingSemiBold,
  },
  approveBtn: {
    backgroundColor: theme.colors.primary,
  },
  approveBtnText: {
    ...theme.typography.small,
    color: theme.colors.textOnPrimary,
    fontFamily: theme.fonts.headingSemiBold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.85)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sheetTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  sheetDesc: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  sheetTypesList: {
    maxHeight: 240,
  },
  typeSelectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.raised,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  typeSelectItemActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(142, 182, 155, 0.15)',
  },
  typeSelectText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  typeSelectTextActive: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingBold,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxBoxActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  noTypesText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  addNewTypeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  addNewTypeLinkText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingMedium,
  },
  sheetFooter: {
    marginTop: theme.spacing.md,
  },
  innerDialog: {
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignSelf: 'center',
    width: '90%',
  },
  dialogTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  dialogInput: {
    backgroundColor: theme.colors.raised,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 15,
    marginBottom: theme.spacing.lg,
  },
  dialogButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dialogCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.raised,
  },
  dialogCancelText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textMuted,
  },
  selectLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
  trainerChipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trainerSelectChip: {
    backgroundColor: theme.colors.raised,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  trainerSelectChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  trainerSelectChipText: {
    ...theme.typography.small,
    color: theme.colors.text,
  },
  trainerSelectChipTextActive: {
    color: theme.colors.textOnPrimary,
    fontFamily: theme.fonts.headingBold,
  },
});
