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
  RefreshControl,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { showConfirmDialog } from '../../../../src/components/ConfirmDialog';
import { Tag, Plus, Edit2, PowerOff, RotateCcw, X } from 'lucide-react-native';
import { useTheme, useStyles, ThemeValue } from '../../../../src/theme/ThemeContext';
import { useAuthStore } from '../../../../src/store/useAuthStore';
import {
  useTrainerTypes,
  useCreateTrainerType,
  useUpdateTrainerType,
  useDeactivateTrainerType,
  useReactivateTrainerType,
  TrainerType,
} from '../../../../src/api/trainers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen, getScreenBottomPadding } from '../../../../src/components/Screen';
import { PageHeader } from '../../../../src/components/PageHeader';
import { safeBack } from '../../../../src/utils/navigation';
import { GlassCard } from '../../../../src/components/GlassCard';
import { Badge } from '../../../../src/components/Badge';
import { Button } from '../../../../src/components/Button';
import { EmptyState } from '../../../../src/components/EmptyState';
import { ErrorState } from '../../../../src/components/ErrorState';
import { TRAINER_TYPES, COMMON, ERRORS } from '../../../../src/constants/strings';

export default function TrainerTypesScreen() {
  const insets = useSafeAreaInsets();
  const { role } = useAuthStore();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { data: types, isLoading, isError, refetch, isRefetching } = useTrainerTypes();
  const createType = useCreateTrainerType();
  const updateType = useUpdateTrainerType();
  const deactivateType = useDeactivateTrainerType();
  const reactivateType = useReactivateTrainerType();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingType, setEditingType] = useState<TrainerType | null>(null);
  const [typeName, setTypeName] = useState('');

  if (role !== 'OWNER') {
    return (
      <Screen safeTop={true}>
        <PageHeader title={TRAINER_TYPES.SCREEN_TITLE} showBack onBack={() => safeBack('/(tabs)/more/trainers')} />
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  if (isLoading && !isRefetching) {
    return (
      <Screen safeTop={true} style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen safeTop={true}>
        <PageHeader title={TRAINER_TYPES.SCREEN_TITLE} showBack onBack={() => safeBack('/(tabs)/more/trainers')} />
        <ErrorState message={TRAINER_TYPES.LOAD_ERROR} onRetry={() => refetch()} />
      </Screen>
    );
  }

  const handleOpenAdd = () => {
    setEditingType(null);
    setTypeName('');
    setModalVisible(true);
  };

  const handleOpenEdit = (item: TrainerType) => {
    setEditingType(item);
    setTypeName(item.name);
    setModalVisible(true);
  };

  const handleSave = async () => {
    const trimmed = typeName.trim();
    if (!trimmed) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Type name cannot be empty' });
      return;
    }

    try {
      if (editingType) {
        await updateType.mutateAsync({ id: editingType.id, name: trimmed });
      } else {
        await createType.mutateAsync(trimmed);
      }
      setModalVisible(false);
      setTypeName('');
      setEditingType(null);
    } catch {
      // toast shown in mutation
    }
  };

  const handleDeactivate = (item: TrainerType) => {
    showConfirmDialog({
      title: TRAINER_TYPES.DEACTIVATE_CONFIRM_TITLE,
      message: TRAINER_TYPES.DEACTIVATE_CONFIRM_MSG(item.name),
      confirmText: TRAINER_TYPES.DEACTIVATE_BTN,
      cancelText: COMMON.CANCEL,
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deactivateType.mutateAsync(item.id);
        } catch {
          // toast shown in mutation
        }
      },
    });
  };

  const handleReactivate = (item: TrainerType) => {
    showConfirmDialog({
      title: TRAINER_TYPES.REACTIVATE_CONFIRM_TITLE,
      message: TRAINER_TYPES.REACTIVATE_CONFIRM_MSG(item.name),
      confirmText: TRAINER_TYPES.REACTIVATE_BTN,
      cancelText: COMMON.CANCEL,
      onConfirm: async () => {
        try {
          await reactivateType.mutateAsync({ id: item.id, name: item.name });
        } catch {
          // toast shown in mutation
        }
      },
    });
  };

  const isSaving = createType.isPending || updateType.isPending;
  const isActionPending = deactivateType.isPending || reactivateType.isPending;

  const renderItem = ({ item }: { item: TrainerType }) => {
    const isInactive = !item.active;
    return (
      <GlassCard
        style={[styles.card, isInactive && styles.cardInactive]}
        contentStyle={styles.cardContent}
      >
        <View style={styles.itemLeft}>
          <View style={[styles.tagIconWrapper, isInactive && styles.tagIconInactive]}>
            <Tag size={18} color={isInactive ? colors.textSecondary : colors.primary} />
          </View>
          <View style={styles.nameContainer}>
            <Text style={[styles.typeName, isInactive && styles.typeNameInactive]}>
              {item.name}
            </Text>
            {isInactive && (
              <View style={{ marginTop: 4 }}>
                <Badge label="Inactive" variant="neutral" size="sm" />
              </View>
            )}
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => handleOpenEdit(item)}
            accessibilityRole="button"
            accessibilityLabel="Edit type"
            disabled={isActionPending}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Edit2 size={18} color={colors.text} />
          </TouchableOpacity>
          {item.active ? (
            <TouchableOpacity
              style={[styles.iconBtn, styles.deleteBtn]}
              onPress={() => handleDeactivate(item)}
              accessibilityRole="button"
              accessibilityLabel="Deactivate type"
              disabled={isActionPending}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <PowerOff size={18} color={colors.danger} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.iconBtn, styles.reactivateBtn]}
              onPress={() => handleReactivate(item)}
              accessibilityRole="button"
              accessibilityLabel="Reactivate type"
              disabled={isActionPending}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <RotateCcw size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </GlassCard>
    );
  };

  return (
    <Screen safeTop={true} safeBottom={false} contentContainerStyle={styles.container}>
      <PageHeader
        title={TRAINER_TYPES.SCREEN_TITLE}
        showBack
        onBack={() => safeBack('/(tabs)/more/trainers')}
        rightAction={
          <Button
            title={TRAINER_TYPES.ADD_BTN}
            onPress={handleOpenAdd}
            size="sm"
            fullWidth={false}
            style={{ paddingHorizontal: 14 }}
          />
        }
      />

      {(!types || types.length === 0) ? (
        <EmptyState
          icon={<Tag size={48} color={colors.primary} />}
          title={TRAINER_TYPES.EMPTY}
          actionLabel="Add type"
          onAction={handleOpenAdd}
        />
      ) : (
        <FlatList
          data={types}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: getScreenBottomPadding(insets.bottom) }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* ── Add / Edit Modal ────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isSaving && setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingType ? TRAINER_TYPES.MODAL_EDIT_TITLE : TRAINER_TYPES.MODAL_ADD_TITLE}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                disabled={isSaving}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>{TRAINER_TYPES.NAME_LABEL}</Text>
            <TextInput
              style={styles.modalInput}
              value={typeName}
              onChangeText={setTypeName}
              placeholder={TRAINER_TYPES.NAME_PLACEHOLDER}
              placeholderTextColor={colors.textSecondary}
              autoFocus
              editable={!isSaving}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={isSaving}
              >
                <Text style={styles.cancelBtnText}>{COMMON.CANCEL}</Text>
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Button
                  title={editingType ? TRAINER_TYPES.UPDATE_BTN : TRAINER_TYPES.SAVE_BTN}
                  onPress={handleSave}
                  loading={isSaving}
                  disabled={isSaving}
                  size="md"
                />
              </View>
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
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
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
    padding: theme.spacing.md,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: theme.spacing.sm,
  },
  tagIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
    flexShrink: 0,
  },
  tagIconInactive: {
    backgroundColor: theme.colors.surface,
  },
  nameContainer: {
    flex: 1,
    minWidth: 0,
  },
  typeName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  typeNameInactive: {
    color: theme.colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.xs,
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
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
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  modalLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 16,
    marginBottom: theme.spacing.xl,
  },
  modalButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceRaised,
  },
  cancelBtnText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
  },
});