import React, { useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  User,
  Users,
  UserPlus,
  Phone,
  Trash2,
  Edit2,
  Tag,
  X,
  Check,
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  IndianRupee,
} from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import { theme } from '../../../../src/theme/theme';
import { useAuthStore } from '../../../../src/store/useAuthStore';
import {
  useTrainer,
  useTrainerTypes,
  useTrainerAssignments,
  useUpdateTrainerTypes,
  useDeactivateTrainer,
  useEndAssignment,
  useReassignTrainer,
  useTrainers,
  TrainerAssignment,
} from '../../../../src/api/trainers';
import { Screen } from '../../../../src/components/Screen';
import { GlassCard } from '../../../../src/components/GlassCard';
import { Avatar } from '../../../../src/components/Avatar';
import { Badge } from '../../../../src/components/Badge';
import { Button } from '../../../../src/components/Button';
import { EmptyState } from '../../../../src/components/EmptyState';
import { ErrorState } from '../../../../src/components/ErrorState';
import { TRAINERS, COMMON, ERRORS } from '../../../../src/constants/strings';

export default function TrainerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { role } = useAuthStore();

  const {
    data: trainer,
    isLoading: isTrainerLoading,
    isError: isTrainerError,
    refetch: refetchTrainer,
    isRefetching: isRefetchingTrainer,
  } = useTrainer(id as string);

  const {
    data: assignmentsData,
    isLoading: isAssignmentsLoading,
    isError: isAssignmentsError,
    refetch: refetchAssignments,
    isRefetching: isRefetchingAssignments,
  } = useTrainerAssignments({
    trainerId: id as string,
    status: 'ACTIVE',
  });

  const { data: allTypes } = useTrainerTypes();
  const { data: allTrainers } = useTrainers();
  const updateTypes = useUpdateTrainerTypes();
  const deactivateTrainer = useDeactivateTrainer();
  const endAssignment = useEndAssignment();
  const reassignTrainer = useReassignTrainer();

  // ─── Edit Types Modal ────────────────────────────────────────
  const [typesModalVisible, setTypesModalVisible] = useState(false);
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);

  // ─── Reassign Modal ──────────────────────────────────────────
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [targetTrainerId, setTargetTrainerId] = useState<string>('');

  if (role !== 'OWNER') {
    return (
      <Screen safeTop={false}>
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  const isLoading = isTrainerLoading || isAssignmentsLoading;
  const isRefetching = isRefetchingTrainer || isRefetchingAssignments;

  const handleRefetchAll = () => {
    refetchTrainer();
    refetchAssignments();
  };

  if (isLoading && !isRefetching) {
    return (
      <Screen safeTop={false} style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  if (isTrainerError || !trainer) {
    return (
      <Screen safeTop={false}>
        <ErrorState message={TRAINERS.LOAD_ERROR} onRetry={handleRefetchAll} />
      </Screen>
    );
  }

  const handleOpenEditTypes = () => {
    setSelectedTypeIds(trainer.trainerTypes?.map((t) => t.id) || []);
    setTypesModalVisible(true);
  };

  const toggleTypeId = (typeId: string) => {
    setSelectedTypeIds((prev) =>
      prev.includes(typeId) ? prev.filter((i) => i !== typeId) : [...prev, typeId]
    );
  };

  const handleSaveTypes = async () => {
    if (selectedTypeIds.length === 0) {
      Alert.alert('Required', 'Please select at least one trainer type');
      return;
    }
    try {
      await updateTypes.mutateAsync({
        id: trainer.id,
        trainerTypeIds: selectedTypeIds,
      });
      setTypesModalVisible(false);
      refetchTrainer();
    } catch {
      // Handled by toast
    }
  };

  const handleDeactivate = () => {
    Alert.alert(
      TRAINERS.DEACTIVATE_CONFIRM_TITLE,
      TRAINERS.DEACTIVATE_CONFIRM_MSG(trainer.name),
      [
        { text: COMMON.CANCEL, style: 'cancel' },
        {
          text: TRAINERS.DEACTIVATE_BTN,
          style: 'destructive',
          onPress: async () => {
            try {
              await deactivateTrainer.mutateAsync(trainer.id);
              refetchTrainer();
              refetchAssignments();
            } catch {
              // Toast
            }
          },
        },
      ]
    );
  };

  const handleRemoveAssignment = (item: TrainerAssignment) => {
    Alert.alert(
      TRAINERS.REMOVE_CONFIRM_TITLE,
      TRAINERS.REMOVE_CONFIRM_MSG(item.memberName || 'this member'),
      [
        { text: COMMON.CANCEL, style: 'cancel' },
        {
          text: TRAINERS.REMOVE_ASSIGNMENT,
          style: 'destructive',
          onPress: async () => {
            try {
              await endAssignment.mutateAsync(item.id);
            } catch {
              // Toast
            }
          },
        },
      ]
    );
  };

  const handleExecuteReassign = async () => {
    if (!targetTrainerId) {
      Alert.alert('Error', 'Please select a destination trainer.');
      return;
    }
    try {
      await reassignTrainer.mutateAsync({
        fromTrainerId: trainer.id,
        toTrainerId: targetTrainerId,
      });
      setReassignModalVisible(false);
      setTargetTrainerId('');
      handleRefetchAll();
    } catch {
      // Toast
    }
  };

  const assignments = assignmentsData?.content || [];
  const statusLabel =
    trainer.status === 'PENDING_APPROVAL'
      ? TRAINERS.STATUS_PENDING
      : trainer.status === 'ACTIVE'
      ? TRAINERS.STATUS_ACTIVE
      : TRAINERS.STATUS_INACTIVE;
  const badgeVariant =
    trainer.status === 'ACTIVE'
      ? 'success'
      : trainer.status === 'PENDING_APPROVAL'
      ? 'warning'
      : 'neutral';

  const activeOtherTrainers = (allTrainers || []).filter(
    (t) => t.status === 'ACTIVE' && t.id !== trainer.id
  );

  const renderAssignmentItem = ({ item }: { item: TrainerAssignment }) => {
    let formattedStart = item.startDate || '';
    try {
      if (item.startDate) {
        formattedStart = format(parseISO(item.startDate), 'dd MMM yyyy');
      }
    } catch {
      // keep
    }

    return (
      <GlassCard style={styles.assignmentCard} contentStyle={styles.assignmentInner}>
        <View style={styles.assignmentTop}>
          <View style={styles.memberInfoCol}>
            <Text style={styles.memberName}>{item.memberName || 'Member'}</Text>
            {item.memberCode ? (
              <Text style={styles.memberCodeText}>ID: {item.memberCode}</Text>
            ) : null}
            {item.memberPhone ? (
              <Text style={styles.memberPhoneText}>{item.memberPhone}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => handleRemoveAssignment(item)}
            accessibilityRole="button"
            accessibilityLabel="Remove member assignment"
            disabled={endAssignment.isPending}
          >
            <Trash2 size={16} color={theme.colors.error} />
          </TouchableOpacity>
        </View>

        {(item.ptFeePaise || item.sessionsTotal || formattedStart) ? (
          <View style={styles.assignmentDetailsRow}>
            {formattedStart ? (
              <View style={styles.detailPill}>
                <Calendar size={12} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
                <Text style={styles.detailPillText}>Started {formattedStart}</Text>
              </View>
            ) : null}
            {item.ptFeePaise ? (
              <View style={styles.detailPill}>
                <IndianRupee size={12} color={theme.colors.primary} style={{ marginRight: 2 }} />
                <Text style={styles.detailPillText}>₹{item.ptFeePaise / 100}</Text>
              </View>
            ) : null}
            {item.sessionsTotal ? (
              <View style={styles.detailPill}>
                <Text style={styles.detailPillText}>{item.sessionsTotal} sessions</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </GlassCard>
    );
  };

  return (
    <Screen safeTop={false} contentContainerStyle={styles.container}>
      {/* ── Top Header Card ────────────────────────────────────── */}
      <GlassCard style={styles.profileCard} contentStyle={styles.profileInner}>
        <View style={styles.avatarRow}>
          <Avatar name={trainer.name} size="lg" />
          <View style={styles.profileDetails}>
            <View style={styles.nameStatusRow}>
              <Text style={styles.trainerName} numberOfLines={1}>
                {trainer.name}
              </Text>
              <Badge label={statusLabel} variant={badgeVariant} size="sm" />
            </View>
            {trainer.phone ? (
              <View style={styles.phoneRow}>
                <Phone size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.phoneText}>{trainer.phone}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Specialty Types ───────────────────────────────────── */}
        <View style={styles.typesSection}>
          <View style={styles.typesHeaderRow}>
            <Text style={styles.sectionTitle}>Specialties</Text>
            <TouchableOpacity
              style={styles.editTypesBtn}
              onPress={handleOpenEditTypes}
              accessibilityRole="button"
            >
              <Edit2 size={14} color={theme.colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.editTypesBtnText}>{TRAINERS.EDIT_TYPES_BTN}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.chipsRow}>
            {trainer.trainerTypes && trainer.trainerTypes.length > 0 ? (
              trainer.trainerTypes.map((type) => (
                <View key={type.id} style={styles.typeChip}>
                  <Text style={styles.typeChipText}>{type.name}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noSpecialtiesText}>No specialties assigned.</Text>
            )}
          </View>
        </View>
      </GlassCard>

      {/* ── Deactivated Trainer Banner (Requirement 7) ────────── */}
      {trainer.status === 'INACTIVE' && (
        <View style={styles.bannerContainer}>
          <GlassCard style={styles.bannerCard} contentStyle={styles.bannerContent}>
            <View style={styles.bannerHeader}>
              <AlertTriangle size={20} color={theme.colors.warning} style={{ marginRight: 8 }} />
              <Text style={styles.bannerTitle}>Trainer Deactivated</Text>
            </View>
            <Text style={styles.bannerDesc}>
              This trainer is inactive. All active member assignments were auto-ended.
            </Text>
            {activeOtherTrainers.length > 0 && (
              <TouchableOpacity
                style={styles.reassignActionBtn}
                onPress={() => setReassignModalVisible(true)}
              >
                <ArrowRightLeft size={16} color={theme.colors.textOnPrimary} style={{ marginRight: 6 }} />
                <Text style={styles.reassignActionText}>Reassign Members</Text>
              </TouchableOpacity>
            )}
          </GlassCard>
        </View>
      )}

      {/* ── Assigned Members Section ───────────────────────────── */}
      <View style={styles.assignmentsHeaderBar}>
        <View style={styles.assignmentsCountRow}>
          <Users size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>
            {TRAINERS.ASSIGNED_MEMBERS} ({assignments.length})
          </Text>
        </View>

        {trainer.status === 'ACTIVE' && (
          <Button
            title={TRAINERS.ASSIGN_MEMBERS_BTN}
            icon={<UserPlus size={16} color={theme.colors.textOnPrimary} />}
            onPress={() => router.push(`/(tabs)/more/trainers/${trainer.id}/assign`)}
            size="sm"
          />
        )}
      </View>

      {assignments.length === 0 ? (
        <View style={{ paddingVertical: 20 }}>
          <EmptyState
            icon={<Users size={40} color={theme.colors.primary} />}
            title={TRAINERS.NO_MEMBERS_ASSIGNED}
          />
        </View>
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item.id}
          renderItem={renderAssignmentItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefetchAll}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}

      {/* ── Deactivate Trainer Action ──────────────────────────── */}
      {trainer.status === 'ACTIVE' && (
        <View style={styles.deactivateWrapper}>
          <TouchableOpacity
            style={styles.deactivateBtn}
            onPress={handleDeactivate}
            disabled={deactivateTrainer.isPending}
            accessibilityRole="button"
          >
            <Text style={styles.deactivateBtnText}>{TRAINERS.DEACTIVATE_BTN}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Edit Types Modal ───────────────────────────────────── */}
      <Modal
        visible={typesModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !updateTypes.isPending && setTypesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheetContainer}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Edit Specialties</Text>
              <TouchableOpacity
                onPress={() => setTypesModalVisible(false)}
                disabled={updateTypes.isPending}
              >
                <X size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300, marginVertical: 12 }}>
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
                <Text style={styles.noSpecialtiesText}>No trainer types configured.</Text>
              )}
            </ScrollView>

            <Button
              title="Save Specialties"
              onPress={handleSaveTypes}
              loading={updateTypes.isPending}
              disabled={updateTypes.isPending || selectedTypeIds.length === 0}
              size="lg"
            />
          </View>
        </View>
      </Modal>

      {/* ── Reassign Modal ─────────────────────────────────────── */}
      <Modal
        visible={reassignModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !reassignTrainer.isPending && setReassignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheetContainer}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Reassign Members</Text>
              <TouchableOpacity
                onPress={() => setReassignModalVisible(false)}
                disabled={reassignTrainer.isPending}
              >
                <X size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetDesc}>
              Select an active trainer to receive reassigned members from {trainer.name}.
            </Text>

            <ScrollView style={{ maxHeight: 250, marginVertical: 10 }}>
              {activeOtherTrainers.map((t) => {
                const isSelected = targetTrainerId === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.typeSelectItem,
                      isSelected && styles.typeSelectItemActive,
                    ]}
                    onPress={() => setTargetTrainerId(t.id)}
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
              })}
            </ScrollView>

            <Button
              title="Confirm Reassign"
              onPress={handleExecuteReassign}
              loading={reassignTrainer.isPending}
              disabled={reassignTrainer.isPending || !targetTrainerId}
              size="lg"
            />
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
  profileCard: {
    margin: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  profileInner: {
    padding: theme.spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileDetails: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  nameStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trainerName: {
    ...theme.typography.h2,
    fontSize: 18,
    color: theme.colors.text,
    flex: 1,
    marginRight: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  phoneText: {
    ...theme.typography.body,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  typesSection: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  typesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    ...theme.typography.h3,
    fontSize: 16,
    color: theme.colors.text,
  },
  editTypesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editTypesBtnText: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingMedium,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typeChip: {
    backgroundColor: theme.colors.raised,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  typeChipText: {
    ...theme.typography.small,
    color: theme.colors.primary,
  },
  noSpecialtiesText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  bannerContainer: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
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
  assignmentsHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  assignmentsCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 20,
  },
  assignmentCard: {
    marginBottom: theme.spacing.sm,
  },
  assignmentInner: {
    padding: theme.spacing.md,
  },
  assignmentTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  memberInfoCol: {
    flex: 1,
  },
  memberName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    fontSize: 15,
  },
  memberCodeText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  memberPhoneText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignmentDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  detailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.raised,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
  },
  detailPillText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
  },
  deactivateWrapper: {
    padding: theme.spacing.md,
    paddingBottom: 30,
  },
  deactivateBtn: {
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deactivateBtnText: {
    ...theme.typography.button,
    color: theme.colors.error,
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
});
