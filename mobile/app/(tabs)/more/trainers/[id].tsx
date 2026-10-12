import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { showConfirmDialog } from '../../../../src/components/ConfirmDialog';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Users,
  UserPlus,
  Phone,
  Trash2,
  Edit2,
  X,
  Check,
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  IndianRupee,
  Plus,
} from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import Toast from 'react-native-toast-message';
import { theme } from '../../../../src/theme/theme';
import { useAuthStore } from '../../../../src/store/useAuthStore';
import {
  useTrainer,
  useTrainerTypes,
  useCreateTrainerType,
  useTrainerAssignments,
  usePatchTrainer,
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
import { Input } from '../../../../src/components/Input';
import { EmptyState } from '../../../../src/components/EmptyState';
import { ErrorState } from '../../../../src/components/ErrorState';
import { useBreakpoint } from '../../../../src/hooks/useBreakpoint';
import { TRAINERS, COMMON, ERRORS, VALIDATION } from '../../../../src/constants/strings';
import { formatMoney } from '../../../../src/utils/formatters';

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export default function TrainerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { role } = useAuthStore();
  const { isPhone } = useBreakpoint();

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
    refetch: refetchAssignments,
    isRefetching: isRefetchingAssignments,
  } = useTrainerAssignments({
    trainerId: id as string,
    status: 'ACTIVE',
  });

  const { data: allTypes, refetch: refetchTypes } = useTrainerTypes(true);
  const { data: allTrainers } = useTrainers();
  const patchTrainer = usePatchTrainer();
  const createTrainerType = useCreateTrainerType();
  const endAssignment = useEndAssignment();
  const reassignTrainer = useReassignTrainer();

  // ─── Edit Name & Types Modal ──────────────────────────────────
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNameError, setEditNameError] = useState<string | undefined>();
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [typesError, setTypesError] = useState<string | undefined>();

  // ─── Add New Type Inline Modal ────────────────────────────────
  const [newTypeModalVisible, setNewTypeModalVisible] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  // ─── Change Mobile Number Modal ───────────────────────────────
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | undefined>();

  // ─── Reassign Modal ──────────────────────────────────────────
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [targetTrainerId, setTargetTrainerId] = useState<string>('');

  const saveLockRef = useRef(false);
  const phoneLockRef = useRef(false);
  const statusLockRef = useRef(false);
  const reassignLockRef = useRef(false);

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

  const handleOpenEditModal = () => {
    setEditName(trainer.name || '');
    setEditNameError(undefined);
    setSelectedTypeIds(trainer.trainerTypes?.map((t) => t.id) || []);
    setTypesError(undefined);
    setEditModalVisible(true);
  };

  const toggleTypeId = (typeId: string) => {
    setTypesError(undefined);
    setSelectedTypeIds((prev) =>
      prev.includes(typeId) ? prev.filter((i) => i !== typeId) : [...prev, typeId]
    );
  };

  const handleSaveDetails = async () => {
    if (saveLockRef.current || patchTrainer.isPending) return;

    const trimmedName = editName.trim();
    let valid = true;

    if (trimmedName.length < 2) {
      setEditNameError(VALIDATION.MIN_LENGTH(TRAINERS.NAME_LABEL, 2));
      valid = false;
    } else {
      setEditNameError(undefined);
    }

    if (selectedTypeIds.length === 0) {
      setTypesError(TRAINERS.TYPES_REQUIRED_ERROR);
      valid = false;
    } else {
      setTypesError(undefined);
    }

    if (!valid) return;

    saveLockRef.current = true;
    try {
      await patchTrainer.mutateAsync({
        id: trainer.id,
        payload: {
          name: trimmedName,
          trainerTypeIds: selectedTypeIds,
        },
      });
      Toast.show({ type: 'success', text1: 'Trainer details updated' });
      setEditModalVisible(false);
      refetchTrainer();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: COMMON.ERROR,
        text2: error?.response?.data?.message || ERRORS.GENERIC,
      });
    } finally {
      saveLockRef.current = false;
    }
  };

  const handleCreateNewTypeInline = async () => {
    const trimmed = newTypeName.trim();
    if (!trimmed || createTrainerType.isPending) return;
    try {
      const created = await createTrainerType.mutateAsync(trimmed);
      setNewTypeName('');
      setNewTypeModalVisible(false);
      await refetchTypes();
      if (created?.id) {
        setSelectedTypeIds((prev) =>
          prev.includes(created.id) ? prev : [...prev, created.id]
        );
        setTypesError(undefined);
      }
    } catch {
      // Toast handled in hook
    }
  };

  const handleOpenPhoneModal = () => {
    const cleanExisting = (trainer.phone || '').replace(/^\+?91/, '').replace(/\D/g, '');
    setNewPhone(cleanExisting);
    setPhoneError(undefined);
    setPhoneModalVisible(true);
  };

  const handleConfirmPhoneChange = () => {
    if (phoneLockRef.current || patchTrainer.isPending) return;
    const cleaned = newPhone.replace(/\D/g, '');
    if (!INDIAN_MOBILE_REGEX.test(cleaned)) {
      setPhoneError(VALIDATION.PHONE_INVALID);
      return;
    }

    showConfirmDialog({
      title: TRAINERS.CHANGE_PHONE_CONFIRM_TITLE,
      message: TRAINERS.CHANGE_PHONE_CONFIRM_MSG(trainer.name),
      confirmText: COMMON.CONFIRM,
      cancelText: COMMON.CANCEL,
      isDestructive: true,
      onConfirm: async () => {
        if (phoneLockRef.current) return;
        phoneLockRef.current = true;
        try {
          await patchTrainer.mutateAsync({
            id: trainer.id,
            payload: {
              phone: cleaned,
            },
          });
          Toast.show({ type: 'success', text1: 'Mobile number updated' });
          setPhoneModalVisible(false);
          refetchTrainer();
        } catch (error: any) {
          const status = error?.response?.status;
          const errCode =
            error?.response?.data?.error ||
            error?.response?.data?.code ||
            '';
          if (status === 409 || errCode === 'PHONE_ALREADY_REGISTERED') {
            setPhoneError(TRAINERS.PHONE_ALREADY_REGISTERED);
          } else {
            Toast.show({
              type: 'error',
              text1: COMMON.ERROR,
              text2: error?.response?.data?.message || ERRORS.GENERIC,
            });
          }
        } finally {
          phoneLockRef.current = false;
        }
      },
    });
  };

  const handleToggleStatus = () => {
    if (statusLockRef.current || patchTrainer.isPending) return;
    const isCurrentlyActive = trainer.status === 'ACTIVE';

    showConfirmDialog({
      title: isCurrentlyActive
        ? TRAINERS.DEACTIVATE_CONFIRM_TITLE
        : TRAINERS.REACTIVATE_CONFIRM_TITLE,
      message: isCurrentlyActive
        ? TRAINERS.DEACTIVATE_CONFIRM_MSG(trainer.name)
        : TRAINERS.REACTIVATE_CONFIRM_MSG(trainer.name),
      confirmText: isCurrentlyActive ? TRAINERS.DEACTIVATE_BTN : TRAINERS.REACTIVATE_BTN,
      cancelText: COMMON.CANCEL,
      isDestructive: isCurrentlyActive,
      onConfirm: async () => {
        if (statusLockRef.current) return;
        statusLockRef.current = true;
        try {
          await patchTrainer.mutateAsync({
            id: trainer.id,
            payload: {
              active: !isCurrentlyActive,
              status: isCurrentlyActive ? 'INACTIVE' : 'ACTIVE',
            },
          });
          Toast.show({
            type: 'success',
            text1: isCurrentlyActive ? 'Trainer deactivated' : 'Trainer reactivated',
          });
          handleRefetchAll();
        } catch (error: any) {
          Toast.show({
            type: 'error',
            text1: COMMON.ERROR,
            text2: error?.response?.data?.message || ERRORS.GENERIC,
          });
        } finally {
          statusLockRef.current = false;
        }
      },
    });
  };

  const handleRemoveAssignment = (item: TrainerAssignment) => {
    showConfirmDialog({
      title: TRAINERS.REMOVE_CONFIRM_TITLE,
      message: TRAINERS.REMOVE_CONFIRM_MSG(item.memberName || 'this member'),
      confirmText: TRAINERS.REMOVE_ASSIGNMENT,
      cancelText: COMMON.CANCEL,
      isDestructive: true,
      onConfirm: async () => {
        try {
          await endAssignment.mutateAsync(item.id);
          refetchAssignments();
          refetchTrainer();
        } catch {
          // Toast handled in hook
        }
      },
    });
  };

  const handleExecuteReassign = async () => {
    if (reassignLockRef.current || reassignTrainer.isPending) return;
    if (!targetTrainerId) {
      Toast.show({ type: 'error', text1: COMMON.ERROR, text2: 'Please select a destination trainer.' });
      return;
    }
    reassignLockRef.current = true;
    try {
      await reassignTrainer.mutateAsync({
        fromTrainerId: trainer.id,
        toTrainerId: targetTrainerId,
      });
      setReassignModalVisible(false);
      setTargetTrainerId('');
      handleRefetchAll();
    } catch {
      // Toast handled in hook
    } finally {
      reassignLockRef.current = false;
    }
  };

  const assignments = assignmentsData?.content || [];
  const isActive = trainer.status === 'ACTIVE';
  const statusLabel = isActive ? TRAINERS.STATUS_ACTIVE : TRAINERS.STATUS_INACTIVE;
  const badgeVariant = isActive ? 'success' : 'neutral';

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
      // keep raw
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

        {item.ptFeePaise || item.sessionsTotal || formattedStart ? (
          <View style={styles.assignmentDetailsRow}>
            {formattedStart ? (
              <View style={styles.detailPill}>
                <Calendar size={12} color={theme.colors.textMuted} style={styles.pillIcon} />
                <Text style={styles.detailPillText}>Started {formattedStart}</Text>
              </View>
            ) : null}
            {item.ptFeePaise ? (
              <View style={styles.detailPill}>
                <Text style={styles.detailPillText}>{formatMoney(item.ptFeePaise)}</Text>
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
          <Avatar name={trainer.name} status={isActive ? 'active' : 'none'} size="lg" />
          <View style={styles.profileDetails}>
            <View style={styles.nameStatusRow}>
              <Text style={styles.trainerName} numberOfLines={1}>
                {trainer.name}
              </Text>
              <Badge label={statusLabel} variant={badgeVariant} size="sm" />
            </View>
            <View style={styles.phoneActionRow}>
              <View style={styles.phoneRow}>
                <Phone size={14} color={theme.colors.primary} style={styles.phoneIcon} />
                <Text style={styles.phoneText}>{trainer.phone || '—'}</Text>
              </View>
              <TouchableOpacity
                onPress={handleOpenPhoneModal}
                style={styles.changePhoneLink}
                accessibilityRole="button"
              >
                <Text style={styles.changePhoneLinkText}>{TRAINERS.CHANGE_PHONE_BTN}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Specialty Types & Edit Details ────────────────────── */}
        <View style={styles.typesSection}>
          <View style={styles.typesHeaderRow}>
            <Text style={styles.sectionTitle}>{TRAINERS.TYPES_LABEL}</Text>
            <TouchableOpacity
              style={styles.editTypesBtn}
              onPress={handleOpenEditModal}
              accessibilityRole="button"
            >
              <Edit2 size={14} color={theme.colors.primary} style={styles.editIcon} />
              <Text style={styles.editTypesBtnText}>{TRAINERS.EDIT_DETAILS_BTN}</Text>
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

      {/* ── Deactivated Trainer Banner (Reassign Members) ───────── */}
      {!isActive && (
        <View style={styles.bannerContainer}>
          <GlassCard style={styles.bannerCard} contentStyle={styles.bannerContent}>
            <View style={styles.bannerHeader}>
              <AlertTriangle size={20} color={theme.colors.warning} style={styles.bannerIcon} />
              <Text style={styles.bannerTitle}>{TRAINERS.DEACTIVATED_BANNER_TITLE}</Text>
            </View>
            <Text style={styles.bannerDesc}>{TRAINERS.DEACTIVATED_BANNER_MSG}</Text>
            {activeOtherTrainers.length > 0 && (
              <TouchableOpacity
                style={styles.reassignActionBtn}
                onPress={() => setReassignModalVisible(true)}
                accessibilityRole="button"
              >
                <ArrowRightLeft
                  size={16}
                  color={theme.colors.textOnPrimary}
                  style={styles.reassignIcon}
                />
                <Text style={styles.reassignActionText}>{TRAINERS.REASSIGN_BTN}</Text>
              </TouchableOpacity>
            )}
          </GlassCard>
        </View>
      )}

      {/* ── Assigned Members Section ───────────────────────────── */}
      <View style={styles.assignmentsHeaderBar}>
        <View style={styles.assignmentsCountRow}>
          <Users size={18} color={theme.colors.primary} style={styles.usersIcon} />
          <Text style={styles.sectionTitle}>
            {TRAINERS.ASSIGNED_MEMBERS} ({assignments.length})
          </Text>
        </View>

        {isActive && (
          <Button
            title={TRAINERS.ASSIGN_MEMBERS_BTN}
            icon={<UserPlus size={16} color={theme.colors.textOnPrimary} />}
            onPress={() => router.push(`/(tabs)/more/trainers/${trainer.id}/assign`)}
            size="sm"
            fullWidth={false}
          />
        )}
      </View>

      {assignments.length === 0 ? (
        <View style={styles.emptyAssignmentsWrap}>
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

      {/* ── Deactivate / Reactivate Trainer Action ─────────────── */}
      <View style={styles.statusActionWrapper}>
        {isActive ? (
          <TouchableOpacity
            style={styles.deactivateBtn}
            onPress={handleToggleStatus}
            disabled={patchTrainer.isPending}
            accessibilityRole="button"
          >
            <Text style={styles.deactivateBtnText}>{TRAINERS.DEACTIVATE_BTN}</Text>
          </TouchableOpacity>
        ) : (
          <Button
            title={TRAINERS.REACTIVATE_BTN}
            onPress={handleToggleStatus}
            loading={patchTrainer.isPending}
            disabled={patchTrainer.isPending}
            variant="primary"
            size="lg"
          />
        )}
      </View>

      {/* ── Edit Name & Types Modal ────────────────────────────── */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !patchTrainer.isPending && setEditModalVisible(false)}
      >
        <View style={[styles.modalOverlay, !isPhone && styles.modalOverlayWide]}>
          <View style={[styles.bottomSheetContainer, !isPhone && styles.bottomSheetContainerWide]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{TRAINERS.EDIT_NAME_TYPES_TITLE}</Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                disabled={patchTrainer.isPending}
              >
                <X size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Input
              label={TRAINERS.NAME_LABEL}
              placeholder={TRAINERS.NAME_PLACEHOLDER}
              value={editName}
              onChangeText={(val) => {
                setEditName(val);
                if (editNameError) setEditNameError(undefined);
              }}
              error={editNameError}
              editable={!patchTrainer.isPending}
            />

            <View style={styles.typesHeaderRow}>
              <Text style={styles.selectLabel}>{TRAINERS.TYPES_LABEL}</Text>
              <TouchableOpacity
                style={styles.addTypeInlineBtn}
                onPress={() => setNewTypeModalVisible(true)}
                disabled={patchTrainer.isPending}
              >
                <Plus size={14} color={theme.colors.primary} style={styles.editIcon} />
                <Text style={styles.editTypesBtnText}>{TRAINERS.ADD_NEW_TYPE_LINK}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.typesScroll}>
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
                          {isSelected && (
                            <Check size={14} color={theme.colors.textOnPrimary} />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
              ) : (
                <Text style={styles.noSpecialtiesText}>No trainer types configured.</Text>
              )}
            </ScrollView>

            {typesError ? <Text style={styles.errorText}>{typesError}</Text> : null}

            <Button
              title={TRAINERS.SAVE_CHANGES_BTN}
              onPress={handleSaveDetails}
              loading={patchTrainer.isPending}
              disabled={patchTrainer.isPending}
              size="lg"
            />
          </View>
        </View>
      </Modal>

      {/* ── Add New Type Modal ─────────────────────────────────── */}
      <Modal
        visible={newTypeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !createTrainerType.isPending && setNewTypeModalVisible(false)}
      >
        <View style={[styles.modalOverlay, !isPhone && styles.modalOverlayWide]}>
          <View style={styles.dialogCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{TRAINERS.ADD_NEW_TYPE_MODAL_TITLE}</Text>
              <TouchableOpacity
                onPress={() => setNewTypeModalVisible(false)}
                disabled={createTrainerType.isPending}
              >
                <X size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Input
              label={TRAINERS.TYPES_LABEL}
              placeholder={TRAINERS.ADD_NEW_TYPE_PLACEHOLDER}
              value={newTypeName}
              onChangeText={setNewTypeName}
              autoFocus
              editable={!createTrainerType.isPending}
            />
            <Button
              title={COMMON.SAVE}
              onPress={handleCreateNewTypeInline}
              loading={createTrainerType.isPending}
              disabled={createTrainerType.isPending || !newTypeName.trim()}
              size="md"
            />
          </View>
        </View>
      </Modal>

      {/* ── Change Mobile Number Modal ─────────────────────────── */}
      <Modal
        visible={phoneModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !patchTrainer.isPending && setPhoneModalVisible(false)}
      >
        <View style={[styles.modalOverlay, !isPhone && styles.modalOverlayWide]}>
          <View style={[styles.bottomSheetContainer, !isPhone && styles.bottomSheetContainerWide]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{TRAINERS.CHANGE_PHONE_MODAL_TITLE}</Text>
              <TouchableOpacity
                onPress={() => setPhoneModalVisible(false)}
                disabled={patchTrainer.isPending}
              >
                <X size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.warningBox}>
              <AlertTriangle size={18} color={theme.colors.warning} style={styles.bannerIcon} />
              <Text style={styles.warningText}>{TRAINERS.CHANGE_PHONE_WARNING}</Text>
            </View>

            <Input
              label={TRAINERS.PHONE_LABEL}
              prefix={TRAINERS.PHONE_PREFIX}
              placeholder={TRAINERS.PHONE_PLACEHOLDER}
              keyboardType="phone-pad"
              maxLength={10}
              value={newPhone}
              onChangeText={(val) => {
                const digitsOnly = val.replace(/\D/g, '').slice(0, 10);
                setNewPhone(digitsOnly);
                if (phoneError) setPhoneError(undefined);
              }}
              error={phoneError}
              editable={!patchTrainer.isPending}
            />

            <Button
              title={TRAINERS.SAVE_CHANGES_BTN}
              onPress={handleConfirmPhoneChange}
              loading={patchTrainer.isPending}
              disabled={patchTrainer.isPending}
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
        <View style={[styles.modalOverlay, !isPhone && styles.modalOverlayWide]}>
          <View style={[styles.bottomSheetContainer, !isPhone && styles.bottomSheetContainerWide]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{TRAINERS.REASSIGN_MODAL_TITLE}</Text>
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

            <ScrollView style={styles.typesScroll}>
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
              title={TRAINERS.REASSIGN_CONFIRM_BTN}
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
  phoneActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneIcon: {
    marginRight: 6,
  },
  phoneText: {
    ...theme.typography.body,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  changePhoneLink: {
    paddingVertical: 2,
  },
  changePhoneLinkText: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingMedium,
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
  addTypeInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editIcon: {
    marginRight: 4,
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
  reassignIcon: {
    marginRight: 6,
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
  usersIcon: {
    marginRight: 6,
  },
  emptyAssignmentsWrap: {
    paddingVertical: 20,
    flex: 1,
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
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.error,
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
  pillIcon: {
    marginRight: 4,
  },
  rupeeIcon: {
    marginRight: 2,
  },
  detailPillText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
  },
  statusActionWrapper: {
    padding: theme.spacing.md,
    paddingBottom: 30,
  },
  deactivateBtn: {
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deactivateBtnText: {
    ...theme.typography.button,
    color: theme.colors.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlayEnd,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalOverlayWide: {
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  bottomSheetContainer: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bottomSheetContainerWide: {
    maxWidth: 440,
    borderRadius: theme.radius.xl,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sheetTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  sheetDesc: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  selectLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  typesScroll: {
    maxHeight: 240,
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
  },
  typeSelectText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  typeSelectTextActive: {
    color: theme.colors.primary,
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
  errorText: {
    ...theme.typography.small,
    color: theme.colors.error,
    marginBottom: theme.spacing.sm,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  warningText: {
    ...theme.typography.caption,
    color: theme.colors.warning,
    flex: 1,
  },
});
