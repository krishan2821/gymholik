import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { showConfirmDialog } from '../../../src/components/ConfirmDialog';
import { safeOpenURL } from '../../../src/utils/safeLinking';
import {
  Plus,
  X,
  Phone,
  Users,
  CheckCircle2,
  MessageCircle,
  Edit2,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useTheme, useStyles, ThemeValue } from '../../../src/theme/ThemeContext';
import { useAuthStore } from '../../../src/store/useAuthStore';
import {
  useStaffList,
  useAddStaff,
  useUpdateStaff,
  useGymSettings,
  StaffMember,
} from '../../../src/api/more';
import { Screen } from '../../../src/components/Screen';
import { PageHeader } from '../../../src/components/PageHeader';
import { safeBack } from '../../../src/utils/navigation';
import { GlassCard } from '../../../src/components/GlassCard';
import { Input } from '../../../src/components/Input';
import { Button } from '../../../src/components/Button';
import { Badge } from '../../../src/components/Badge';
import { Avatar } from '../../../src/components/Avatar';
import { ErrorState } from '../../../src/components/ErrorState';
import { EmptyState } from '../../../src/components/EmptyState';
import { useBreakpoint } from '../../../src/hooks/useBreakpoint';
import {
  STAFF,
  COMMON,
  ERRORS,
  VALIDATION,
} from '../../../src/constants/strings';

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export default function StaffScreen() {
  const { role, user } = useAuthStore();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { isPhone } = useBreakpoint();
  const { data: gymSettings } = useGymSettings();

  const {
    data: staff,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useStaffList();

  const addStaff = useAddStaff();
  const updateStaff = useUpdateStaff();

  // ─── Add Staff Modal State ───────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();

  // ─── Edit Staff Modal State ──────────────────────────────────
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNameError, setEditNameError] = useState<string | undefined>();
  const [editPhoneError, setEditPhoneError] = useState<string | undefined>();

  // ─── Post-Success WhatsApp Sheet State ───────────────────────
  const [createdStaffInfo, setCreatedStaffInfo] = useState<{
    name: string;
    phone: string;
  } | null>(null);

  const addLockRef = useRef(false);
  const updateLockRef = useRef(false);

  if (role !== 'OWNER') {
    return (
      <Screen safeTop={false}>
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  const handleOpenAddModal = () => {
    setName('');
    setPhone('');
    setNameError(undefined);
    setPhoneError(undefined);
    setShowAddModal(true);
  };

  const handleAddSubmit = async () => {
    if (addLockRef.current || addStaff.isPending) return;

    const trimmedName = name.trim();
    const cleanedPhone = phone.replace(/\D/g, '');
    let valid = true;

    if (trimmedName.length < 2) {
      setNameError(VALIDATION.MIN_LENGTH(STAFF.NAME_LABEL, 2));
      valid = false;
    } else {
      setNameError(undefined);
    }

    if (!INDIAN_MOBILE_REGEX.test(cleanedPhone)) {
      setPhoneError(VALIDATION.PHONE_INVALID);
      valid = false;
    } else {
      setPhoneError(undefined);
    }

    if (!valid) return;

    addLockRef.current = true;
    try {
      await addStaff.mutateAsync({
        name: trimmedName,
        phone: cleanedPhone,
      });
      setShowAddModal(false);
      setCreatedStaffInfo({
        name: trimmedName,
        phone: cleanedPhone,
      });
    } catch (error: any) {
      const status = error?.response?.status;
      const errCode =
        error?.response?.data?.error ||
        error?.response?.data?.code ||
        '';
      if (status === 409 || errCode === 'PHONE_ALREADY_REGISTERED') {
        setPhoneError(STAFF.PHONE_ALREADY_REGISTERED);
      } else {
        Toast.show({
          type: 'error',
          text1: COMMON.ERROR,
          text2: error?.response?.data?.message || STAFF.ADD_ERROR,
        });
      }
    } finally {
      addLockRef.current = false;
    }
  };

  const handleShareOnWhatsApp = async () => {
    if (!createdStaffInfo) return;
    const resolvedGymName =
      user?.gymName || gymSettings?.gymName || 'our gym';
    const message = STAFF.WHATSAPP_INVITE_MSG(
      createdStaffInfo.name,
      resolvedGymName
    );
    const url = `https://wa.me/91${createdStaffInfo.phone}?text=${encodeURIComponent(
      message
    )}`;
    try {
      await safeOpenURL(url);
    } catch {
      Toast.show({
        type: 'error',
        text1: COMMON.ERROR,
        text2: ERRORS.GENERIC,
      });
    }
  };

  const handleOpenEditStaff = (member: StaffMember) => {
    setEditingStaff(member);
    setEditName(member.name || '');
    const cleanPhone = (member.phone || '').replace(/^\+?91/, '').replace(/\D/g, '');
    setEditPhone(cleanPhone);
    setEditNameError(undefined);
    setEditPhoneError(undefined);
  };

  const executeStaffEdit = async (
    staffId: string,
    trimmedName: string,
    cleanedPhone: string
  ) => {
    if (updateLockRef.current) return;
    updateLockRef.current = true;
    try {
      await updateStaff.mutateAsync({
        id: staffId,
        payload: {
          name: trimmedName,
          phone: cleanedPhone,
        },
      });
      Toast.show({ type: 'success', text1: 'Staff updated' });
      setEditingStaff(null);
    } catch (error: any) {
      const status = error?.response?.status;
      const errCode =
        error?.response?.data?.error ||
        error?.response?.data?.code ||
        '';
      if (status === 409 || errCode === 'PHONE_ALREADY_REGISTERED') {
        setEditPhoneError(STAFF.PHONE_ALREADY_REGISTERED);
      } else {
        Toast.show({
          type: 'error',
          text1: COMMON.ERROR,
          text2: error?.response?.data?.message || STAFF.UPDATE_ERROR,
        });
      }
    } finally {
      updateLockRef.current = false;
    }
  };

  const handleSaveEditStaff = () => {
    if (!editingStaff || updateLockRef.current || updateStaff.isPending) return;

    const trimmedName = editName.trim();
    const cleanedPhone = editPhone.replace(/\D/g, '');
    let valid = true;

    if (trimmedName.length < 2) {
      setEditNameError(VALIDATION.MIN_LENGTH(STAFF.NAME_LABEL, 2));
      valid = false;
    } else {
      setEditNameError(undefined);
    }

    if (!INDIAN_MOBILE_REGEX.test(cleanedPhone)) {
      setEditPhoneError(VALIDATION.PHONE_INVALID);
      valid = false;
    } else {
      setEditPhoneError(undefined);
    }

    if (!valid) return;

    const existingCleanPhone = (editingStaff.phone || '')
      .replace(/^\+?91/, '')
      .replace(/\D/g, '');

    if (cleanedPhone !== existingCleanPhone) {
      showConfirmDialog({
        title: STAFF.PHONE_CHANGE_CONFIRM_TITLE,
        message: STAFF.PHONE_CHANGE_CONFIRM_MSG(editingStaff.name),
        confirmText: COMMON.CONFIRM,
        cancelText: COMMON.CANCEL,
        isDestructive: true,
        onConfirm: () =>
          executeStaffEdit(editingStaff.id, trimmedName, cleanedPhone),
      });
    } else {
      executeStaffEdit(editingStaff.id, trimmedName, cleanedPhone);
    }
  };

  const handleToggleStaffStatus = (item: StaffMember) => {
    if (updateLockRef.current || updateStaff.isPending) return;
    const isCurrentlyActive = item.status === 'ACTIVE' || item.active;

    showConfirmDialog({
      title: isCurrentlyActive
        ? STAFF.DEACTIVATE_CONFIRM_TITLE
        : STAFF.REACTIVATE_CONFIRM_TITLE,
      message: isCurrentlyActive
        ? STAFF.DEACTIVATE_CONFIRM_MSG(item.name)
        : STAFF.REACTIVATE_CONFIRM_MSG(item.name),
      confirmText: isCurrentlyActive ? STAFF.DEACTIVATE_BTN : STAFF.REACTIVATE_BTN,
      cancelText: COMMON.CANCEL,
      isDestructive: isCurrentlyActive,
      onConfirm: async () => {
        if (updateLockRef.current) return;
        updateLockRef.current = true;
        try {
          await updateStaff.mutateAsync({
            id: item.id,
            payload: {
              active: !isCurrentlyActive,
              status: isCurrentlyActive ? 'INACTIVE' : 'ACTIVE',
            },
          });
          Toast.show({
            type: 'success',
            text1: isCurrentlyActive
              ? 'Staff member deactivated'
              : 'Staff member reactivated',
          });
        } catch (error: any) {
          Toast.show({
            type: 'error',
            text1: COMMON.ERROR,
            text2: error?.response?.data?.message || STAFF.UPDATE_ERROR,
          });
        } finally {
          updateLockRef.current = false;
        }
      },
    });
  };

  const renderItem = ({ item }: { item: StaffMember }) => {
    const isActive = item.status === 'ACTIVE' || item.active;
    return (
      <GlassCard style={styles.card} contentStyle={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardLeft}>
            <Avatar
              name={item.name}
              status={isActive ? 'active' : 'none'}
              size="md"
            />
            <View style={styles.cardInfo}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.phoneRow}>
                <Phone size={12} color={colors.textSecondary} style={styles.phoneIcon} />
                <Text style={styles.phone}>{item.phone}</Text>
              </View>
            </View>
          </View>
          <Badge
            label={isActive ? STAFF.STATUS_ACTIVE : STAFF.STATUS_INACTIVE}
            variant={isActive ? 'success' : 'neutral'}
            size="sm"
          />
        </View>

        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => handleOpenEditStaff(item)}
            accessibilityRole="button"
          >
            <Edit2 size={14} color={colors.primary} style={styles.actionIcon} />
            <Text style={styles.editBtnText}>{COMMON.EDIT}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statusBtn,
              isActive ? styles.deactivateActionBtn : styles.reactivateActionBtn,
            ]}
            onPress={() => handleToggleStaffStatus(item)}
            disabled={updateStaff.isPending}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.statusBtnText,
                isActive ? styles.deactivateText : styles.reactivateText,
              ]}
            >
              {isActive ? STAFF.DEACTIVATE_BTN : STAFF.REACTIVATE_BTN}
            </Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    );
  };

  return (
    <Screen safeTop={true} hasFab={true} contentContainerStyle={styles.container}>
      <PageHeader title={STAFF.SCREEN_TITLE} showBack onBack={() => safeBack('/(tabs)/more')} />
      {isLoading && !isRefetching ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <ErrorState message={STAFF.LOAD_ERROR} onRetry={() => refetch()} />
      ) : !staff || staff.length === 0 ? (
        <EmptyState
          icon={<Users size={48} color={colors.primary} />}
          title={STAFF.EMPTY}
          actionLabel={STAFF.ADD_BTN}
          onAction={handleOpenAddModal}
        />
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* ── Floating "Add staff" Button ────────────────────────── */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={handleOpenAddModal}
        accessibilityRole="button"
        accessibilityLabel={STAFF.ADD_BTN}
      >
        <Plus size={20} color={colors.textOnPrimary} style={styles.fabIcon} />
        <Text style={styles.fabText}>{STAFF.ADD_BTN}</Text>
      </TouchableOpacity>

      {/* ── Add Staff Modal (Name + Mobile) ────────────────────── */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => !addStaff.isPending && setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalOverlay, !isPhone && styles.modalOverlayWide]}
        >
          <View style={[styles.modalContent, !isPhone && styles.modalContentWide]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{STAFF.MODAL_TITLE}</Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                disabled={addStaff.isPending}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel={COMMON.CLOSE}
              >
                <X color={colors.textSecondary} size={22} />
              </TouchableOpacity>
            </View>

            <Input
              label={STAFF.NAME_LABEL}
              placeholder={STAFF.NAME_PLACEHOLDER}
              value={name}
              onChangeText={(val) => {
                setName(val);
                if (nameError) setNameError(undefined);
              }}
              error={nameError}
              autoCapitalize="words"
              editable={!addStaff.isPending}
            />

            <Input
              label={STAFF.PHONE_LABEL}
              prefix={STAFF.PHONE_PREFIX}
              placeholder={STAFF.PHONE_PLACEHOLDER}
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={(val) => {
                const digitsOnly = val.replace(/\D/g, '').slice(0, 10);
                setPhone(digitsOnly);
                if (phoneError) setPhoneError(undefined);
              }}
              error={phoneError}
              editable={!addStaff.isPending}
            />

            <View style={styles.modalActionRow}>
              <Button
                title={STAFF.SUBMIT}
                onPress={handleAddSubmit}
                loading={addStaff.isPending}
                disabled={addStaff.isPending}
                variant="primary"
                size="lg"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit Staff Modal ───────────────────────────────────── */}
      <Modal
        visible={!!editingStaff}
        transparent
        animationType="slide"
        onRequestClose={() => !updateStaff.isPending && setEditingStaff(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalOverlay, !isPhone && styles.modalOverlayWide]}
        >
          <View style={[styles.modalContent, !isPhone && styles.modalContentWide]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{STAFF.EDIT_MODAL_TITLE}</Text>
              <TouchableOpacity
                onPress={() => setEditingStaff(null)}
                disabled={updateStaff.isPending}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel={COMMON.CLOSE}
              >
                <X color={colors.textSecondary} size={22} />
              </TouchableOpacity>
            </View>

            <Input
              label={STAFF.NAME_LABEL}
              placeholder={STAFF.NAME_PLACEHOLDER}
              value={editName}
              onChangeText={(val) => {
                setEditName(val);
                if (editNameError) setEditNameError(undefined);
              }}
              error={editNameError}
              autoCapitalize="words"
              editable={!updateStaff.isPending}
            />

            <Input
              label={STAFF.PHONE_LABEL}
              prefix={STAFF.PHONE_PREFIX}
              placeholder={STAFF.PHONE_PLACEHOLDER}
              keyboardType="phone-pad"
              maxLength={10}
              value={editPhone}
              onChangeText={(val) => {
                const digitsOnly = val.replace(/\D/g, '').slice(0, 10);
                setEditPhone(digitsOnly);
                if (editPhoneError) setEditPhoneError(undefined);
              }}
              error={editPhoneError}
              editable={!updateStaff.isPending}
            />

            <View style={styles.modalActionRow}>
              <Button
                title={STAFF.SAVE_CHANGES}
                onPress={handleSaveEditStaff}
                loading={updateStaff.isPending}
                disabled={updateStaff.isPending}
                variant="primary"
                size="lg"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Post-Creation Success Sheet (WhatsApp + Done) ───────── */}
      <Modal
        visible={!!createdStaffInfo}
        transparent
        animationType="slide"
        onRequestClose={() => setCreatedStaffInfo(null)}
      >
        <View style={[styles.modalOverlay, !isPhone && styles.modalOverlayWide]}>
          <View style={[styles.modalContent, !isPhone && styles.modalContentWide]}>
            <View style={styles.successIconWrap}>
              <CheckCircle2 size={44} color={colors.primary} />
            </View>
            <Text style={styles.successSheetTitle}>{STAFF.SUCCESS_SHEET_TITLE}</Text>
            <Text style={styles.successSheetDesc}>{STAFF.SUCCESS_SHEET_DESC}</Text>

            <View style={styles.successActions}>
              <Button
                title={STAFF.SHARE_WHATSAPP_BTN}
                icon={<MessageCircle size={18} color={colors.textOnPrimary} />}
                onPress={handleShareOnWhatsApp}
                variant="primary"
                size="lg"
              />
              <View style={styles.doneBtnSpacing}>
                <Button
                  title={STAFF.DONE_BTN}
                  onPress={() => setCreatedStaffInfo(null)}
                  variant="secondary"
                  size="lg"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: theme.spacing.md,
    paddingBottom: 120,
  },
  card: {
    marginBottom: theme.spacing.md,
  },
  cardContent: {
    padding: theme.spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  phoneIcon: {
    marginRight: 4,
  },
  phone: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  actionIcon: {
    marginRight: 4,
  },
  editBtnText: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingMedium,
  },
  statusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
  },
  deactivateActionBtn: {
    backgroundColor: theme.colors.surfaceRaised,
    borderColor: theme.colors.danger,
  },
  reactivateActionBtn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  statusBtnText: {
    ...theme.typography.small,
    fontFamily: theme.fonts.headingSemiBold,
  },
  deactivateText: {
    color: theme.colors.danger,
  },
  reactivateText: {
    color: theme.colors.textOnPrimary,
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
    alignItems: 'center',
  },
  modalOverlayWide: {
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalContentWide: {
    maxWidth: 440,
    borderRadius: theme.radius.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionRow: {
    marginTop: theme.spacing.xs,
  },
  successIconWrap: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  successSheetTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  successSheetDesc: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  successActions: {
    width: '100%',
  },
  doneBtnSpacing: {
    marginTop: theme.spacing.sm,
  },
});
