import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Tag, Plus, Edit2, Trash2, X, Check } from 'lucide-react-native';
import { theme } from '../../../../src/theme/theme';
import { useAuthStore } from '../../../../src/store/useAuthStore';
import {
  useTrainerTypes,
  useCreateTrainerType,
  useUpdateTrainerType,
  useDeactivateTrainerType,
  TrainerType,
} from '../../../../src/api/trainers';
import { Screen } from '../../../../src/components/Screen';
import { GlassCard } from '../../../../src/components/GlassCard';
import { Badge } from '../../../../src/components/Badge';
import { Button } from '../../../../src/components/Button';
import { EmptyState } from '../../../../src/components/EmptyState';
import { ErrorState } from '../../../../src/components/ErrorState';
import { TRAINER_TYPES, COMMON, ERRORS } from '../../../../src/constants/strings';

export default function TrainerTypesScreen() {
  const { role } = useAuthStore();
  const { data: types, isLoading, isError, refetch, isRefetching } = useTrainerTypes();
  const createType = useCreateTrainerType();
  const updateType = useUpdateTrainerType();
  const deactivateType = useDeactivateTrainerType();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingType, setEditingType] = useState<TrainerType | null>(null);
  const [typeName, setTypeName] = useState('');

  if (role !== 'OWNER') {
    return (
      <Screen safeTop={false}>
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  if (isLoading && !isRefetching) {
    return (
      <Screen safeTop={false} style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen safeTop={false}>
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
      Alert.alert('Validation Error', 'Type name cannot be empty');
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
    Alert.alert(
      TRAINER_TYPES.DEACTIVATE_CONFIRM_TITLE,
      TRAINER_TYPES.DEACTIVATE_CONFIRM_MSG(item.name),
      [
        { text: COMMON.CANCEL, style: 'cancel' },
        {
          text: TRAINER_TYPES.DEACTIVATE_BTN,
          style: 'destructive',
          onPress: async () => {
            try {
              await deactivateType.mutateAsync(item.id);
            } catch {
              // toast shown in mutation
            }
          },
        },
      ]
    );
  };

  const isSaving = createType.isPending || updateType.isPending;

  const renderItem = ({ item }: { item: TrainerType }) => (
    <GlassCard style={styles.card} contentStyle={styles.cardContent}>
      <View style={styles.itemLeft}>
        <View style={styles.tagIconWrapper}>
          <Tag size={18} color={theme.colors.primary} />
        </View>
        <View style={styles.nameContainer}>
          <Text style={styles.typeName}>{item.name}</Text>
          <View style={{ marginTop: 4 }}>
            <Badge
              label={item.active ? 'Active' : 'Inactive'}
              variant={item.active ? 'success' : 'neutral'}
              size="sm"
            />
          </View>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => handleOpenEdit(item)}
          accessibilityRole="button"
          accessibilityLabel="Edit type"
          disabled={deactivateType.isPending}
        >
          <Edit2 size={18} color={theme.colors.text} />
        </TouchableOpacity>
        {item.active && (
          <TouchableOpacity
            style={[styles.iconBtn, styles.deleteBtn]}
            onPress={() => handleDeactivate(item)}
            accessibilityRole="button"
            accessibilityLabel="Deactivate type"
            disabled={deactivateType.isPending}
          >
            <Trash2 size={18} color={theme.colors.error} />
          </TouchableOpacity>
        )}
      </View>
    </GlassCard>
  );

  return (
    <Screen safeTop={false} contentContainerStyle={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.headerTitle}>{TRAINER_TYPES.SCREEN_TITLE}</Text>
        <Button
          title={TRAINER_TYPES.ADD_BTN}
          icon={<Plus size={16} color={theme.colors.textOnPrimary} />}
          onPress={handleOpenAdd}
          size="sm"
        />
      </View>

      {(!types || types.length === 0) ? (
        <EmptyState
          icon={<Tag size={48} color={theme.colors.primary} />}
          title={TRAINER_TYPES.EMPTY}
        />
      ) : (
        <FlatList
          data={types}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
                <X size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>{TRAINER_TYPES.NAME_LABEL}</Text>
            <TextInput
              style={styles.modalInput}
              value={typeName}
              onChangeText={setTypeName}
              placeholder={TRAINER_TYPES.NAME_PLACEHOLDER}
              placeholderTextColor={theme.colors.textMuted}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  headerTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  card: {
    marginBottom: theme.spacing.sm,
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
  },
  tagIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.raised,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  nameContainer: {
    flex: 1,
  },
  typeName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.raised,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.xs,
  },
  deleteBtn: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    width: '100%',
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
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: theme.colors.raised,
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
    backgroundColor: theme.colors.raised,
  },
  cancelBtnText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textMuted,
  },
});
