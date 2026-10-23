import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import {
  Users,
  AlertTriangle,
  ArrowRightLeft,
  ChevronRight,
  Plus,
  Tag,
  X,
  Phone,
} from 'lucide-react-native';
import { useTheme, useStyles, ThemeValue } from '../../../../src/theme/ThemeContext';
import { useAuthStore } from '../../../../src/store/useAuthStore';
import {
  useTrainers,
  useReassignTrainer,
  Trainer,
} from '../../../../src/api/trainers';
import { Screen } from '../../../../src/components/Screen';
import { PageHeader } from '../../../../src/components/PageHeader';
import { safeBack } from '../../../../src/utils/navigation';
import { GlassCard } from '../../../../src/components/GlassCard';
import { Avatar } from '../../../../src/components/Avatar';
import { Badge } from '../../../../src/components/Badge';
import { Button } from '../../../../src/components/Button';
import { FilterChips } from '../../../../src/components/FilterChips';
import { EmptyState } from '../../../../src/components/EmptyState';
import { ErrorState } from '../../../../src/components/ErrorState';
import { TRAINERS, COMMON, ERRORS } from '../../../../src/constants/strings';
import { useBreakpoint } from '../../../../src/hooks/useBreakpoint';

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: TRAINERS.STATUS_ACTIVE },
  { value: 'INACTIVE', label: TRAINERS.STATUS_INACTIVE },
];

export default function TrainersScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const { role } = useAuthStore();
  const { isPhone } = useBreakpoint();
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const reassignLockRef = useRef(false);

  const {
    data: trainers,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useTrainers(selectedStatus === 'ALL' ? undefined : selectedStatus);

  const reassignTrainer = useReassignTrainer();

  // ─── Reassign Modal State ────────────────────────────────────
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [fromTrainerId, setFromTrainerId] = useState<string>('');
  const [toTrainerId, setToTrainerId] = useState<string>('');
  const [reassignNotes, setReassignNotes] = useState<string>('');

  const deactivatedTrainers = useMemo(() => {
    if (!trainers) return [];
    return trainers.filter((t) => t.status === 'INACTIVE');
  }, [trainers]);

  const activeTrainers = useMemo(() => {
    if (!trainers) return [];
    return trainers.filter((t) => t.status === 'ACTIVE');
  }, [trainers]);

  if (role !== 'OWNER') {
    return (
      <Screen safeTop={false}>
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  const handleExecuteReassign = async () => {
    if (reassignLockRef.current || reassignTrainer.isPending) return;
    if (!fromTrainerId || !toTrainerId) {
      Toast.show({ type: 'error', text1: COMMON.ERROR, text2: 'Please select both source and destination trainers.' });
      return;
    }
    if (fromTrainerId === toTrainerId) {
      Toast.show({ type: 'error', text1: COMMON.ERROR, text2: 'Source and target trainer cannot be the same.' });
      return;
    }

    reassignLockRef.current = true;
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
      // Toast handled in hook
    } finally {
      reassignLockRef.current = false;
    }
  };

  const renderTrainerItem = ({ item }: { item: Trainer }) => {
    const isActive = item.status === 'ACTIVE';
    const statusLabel = isActive ? TRAINERS.STATUS_ACTIVE : TRAINERS.STATUS_INACTIVE;
    const badgeVariant = isActive ? 'success' : 'neutral';

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push(`/(tabs)/more/trainers/${item.id}`)}
        accessibilityRole="button"
      >
        <GlassCard style={styles.card} contentStyle={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Avatar name={item.name} status={isActive ? 'active' : 'none'} size="md" />
            <View style={styles.headerInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.trainerName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Badge label={statusLabel} variant={badgeVariant} size="sm" />
              </View>
              {item.phone ? (
                <View style={styles.phoneRow}>
                  <Phone size={12} color={colors.textSecondary} style={styles.phoneIcon} />
                  <Text style={styles.phoneText}>{item.phone}</Text>
                </View>
              ) : null}
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </View>

          {/* Trainer Type Chips */}
          {item.trainerTypes && item.trainerTypes.length > 0 ? (
            <View style={styles.chipsRow}>
              {item.trainerTypes.map((type) => (
                <View key={type.id} style={styles.typeChip}>
                  <Text style={styles.typeChipText}>{type.name}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Assigned Member Count */}
          <View style={styles.cardFooter}>
            <View style={styles.membersCountRow}>
              <Users size={14} color={colors.primary} style={styles.membersIcon} />
              <Text style={styles.membersCountText}>
                {TRAINERS.ASSIGNED_COUNT_LABEL(item.activeAssignmentsCount || 0)}
              </Text>
            </View>
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  return (
    <Screen safeTop={true} hasFab={true} contentContainerStyle={styles.container}>
      <PageHeader title={TRAINERS.SCREEN_TITLE} showBack onBack={() => safeBack('/(tabs)/more')} />
      {/* ── Top Bar ────────────────────────────────────────────── */}
      <View style={styles.topActionsBar}>
        <View style={styles.filterContainer}>
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
          <Tag size={16} color={colors.primary} style={styles.tagIcon} />
          <Text style={styles.manageTypesText}>{TRAINERS.MANAGE_TYPES_BTN}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Deactivated Trainer Reassign Banner ────────────────── */}
      {deactivatedTrainers.length > 0 && (
        <View style={styles.bannerContainer}>
          <GlassCard style={styles.bannerCard} contentStyle={styles.bannerContent}>
            <View style={styles.bannerHeader}>
              <AlertTriangle size={20} color={colors.warning} style={styles.bannerIcon} />
              <Text style={styles.bannerTitle}>{TRAINERS.DEACTIVATED_BANNER_TITLE}</Text>
            </View>
            <Text style={styles.bannerDesc}>
              {TRAINERS.DEACTIVATED_LIST_BANNER_DESC(
                deactivatedTrainers.map((t) => t.name).join(', ')
              )}
            </Text>
            <TouchableOpacity
              style={styles.reassignActionBtn}
              onPress={() => {
                setFromTrainerId(deactivatedTrainers[0]?.id || '');
                setReassignModalVisible(true);
              }}
              accessibilityRole="button"
            >
              <ArrowRightLeft
                size={16}
                color={colors.textOnPrimary}
                style={styles.reassignIcon}
              />
              <Text style={styles.reassignActionText}>{TRAINERS.REASSIGN_BTN}</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      )}

      {/* ── Trainers List ──────────────────────────────────────── */}
      {isLoading && !isRefetching ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <ErrorState message={TRAINERS.LOAD_ERROR} onRetry={() => refetch()} />
      ) : !trainers || trainers.length === 0 ? (
        <EmptyState
          icon={<Users size={48} color={colors.primary} />}
          title={TRAINERS.EMPTY}
          actionLabel={TRAINERS.ADD_BTN}
          onAction={() => router.push('/(tabs)/more/trainers/add')}
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
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* ── Floating "Add trainer" Button ──────────────────────── */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push('/(tabs)/more/trainers/add')}
        accessibilityRole="button"
        accessibilityLabel={TRAINERS.ADD_BTN}
      >
        <Plus size={20} color={colors.textOnPrimary} style={styles.fabIcon} />
        <Text style={styles.fabText}>{TRAINERS.ADD_BTN}</Text>
      </TouchableOpacity>

      {/* ── Reassign Members Modal ──────────────────────────────── */}
      <Modal
        visible={reassignModalVisible}
        transparent
        animationType={isPhone ? 'slide' : 'fade'}
        onRequestClose={() => !reassignTrainer.isPending && setReassignModalVisible(false)}
      >
        <View style={[styles.modalOverlay, !isPhone && styles.modalOverlayDesktop]}>
          <View style={[styles.bottomSheetContainer, !isPhone && styles.bottomSheetContainerDesktop]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{TRAINERS.REASSIGN_MODAL_TITLE}</Text>
              <TouchableOpacity
                onPress={() => setReassignModalVisible(false)}
                disabled={reassignTrainer.isPending}
                accessibilityRole="button"
              >
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetDesc}>{TRAINERS.REASSIGN_DESC}</Text>

            <ScrollView style={styles.sheetScroll}>
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
                        {t.name} ({t.status === 'ACTIVE' ? TRAINERS.STATUS_ACTIVE : TRAINERS.STATUS_INACTIVE})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.selectLabel, styles.selectLabelSpaced]}>
                {TRAINERS.SELECT_TARGET_TRAINER}
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

              <Text style={[styles.selectLabel, styles.selectLabelSpaced]}>Notes (Optional)</Text>
              <TextInput
                style={styles.dialogInput}
                value={reassignNotes}
                onChangeText={setReassignNotes}
                placeholder="Reason for reassignment…"
                placeholderTextColor={colors.textSecondary}
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

const makeStyles = (theme: ThemeValue) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
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
  filterContainer: {
    flex: 1,
  },
  manageTypesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  tagIcon: {
    marginRight: 6,
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
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.warning,
  },
  bannerContent: {
    padding: theme.spacing.md,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bannerIcon: {
    marginRight: 8,
  },
  bannerTitle: {
    ...theme.typography.h3,
    fontSize: 15,
    color: theme.colors.warning,
  },
  bannerDesc: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
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
  reassignIcon: {
    marginRight: 6,
  },
  reassignActionText: {
    ...theme.typography.button,
    fontSize: 13,
    color: theme.colors.textOnPrimary,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 120,
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
  phoneIcon: {
    marginRight: 4,
  },
  phoneText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.spacing.sm,
    gap: 6,
  },
  typeChip: {
    backgroundColor: theme.colors.surfaceRaised,
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
  membersIcon: {
    marginRight: 6,
  },
  membersCountText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  fab: {
    position: 'absolute',
    right: theme.spacing.lg,
    bottom: theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    borderRadius: theme.radius.full,
    ...theme.shadows.glow,
  },
  fabIcon: {
    marginRight: 8,
  },
  fabText: {
    ...theme.typography.button,
    color: theme.colors.textOnPrimary,
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
  bottomSheetContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bottomSheetContainerDesktop: {
    borderRadius: theme.radius.xl,
    width: '100%',
    maxWidth: 440,
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
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  sheetScroll: {
    maxHeight: 350,
    marginVertical: 10,
  },
  sheetFooter: {
    marginTop: theme.spacing.md,
  },
  selectLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    fontFamily: theme.fonts.headingMedium,
  },
  selectLabelSpaced: {
    marginTop: 16,
  },
  trainerChipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trainerSelectChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceRaised,
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
    fontFamily: theme.fonts.headingSemiBold,
  },
  dialogInput: {
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 15,
  },
});
