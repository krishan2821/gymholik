import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { safeOpenURL } from '../../../../src/utils/safeLinking';
import { useRouter } from 'expo-router';
import {
  Plus,
  Check,
  Users,
  Search,
  X,
  MessageCircle,
  CheckCircle2,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useTheme, useStyles, ThemeValue } from '../../../../src/theme/ThemeContext';
import { useAuthStore } from '../../../../src/store/useAuthStore';
import {
  useCreateTrainer,
  useTrainerTypes,
  useCreateTrainerType,
} from '../../../../src/api/trainers';
import { useMembers } from '../../../../src/api/members';
import { useGymSettings } from '../../../../src/api/more';
import { Screen } from '../../../../src/components/Screen';
import { GlassCard } from '../../../../src/components/GlassCard';
import { Input } from '../../../../src/components/Input';
import { Button } from '../../../../src/components/Button';
import { Avatar } from '../../../../src/components/Avatar';
import { EmptyState } from '../../../../src/components/EmptyState';
import { ErrorState } from '../../../../src/components/ErrorState';
import { safeBack } from '../../../../src/utils/navigation';
import {
  TRAINERS,
  ASSIGN_MEMBERS,
  COMMON,
  ERRORS,
  VALIDATION,
} from '../../../../src/constants/strings';
import { useBreakpoint } from '../../../../src/hooks/useBreakpoint';

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export default function AddTrainerScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const { role, user } = useAuthStore();
  const { data: gymSettings } = useGymSettings();
  const { isPhone } = useBreakpoint();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const [nameError, setNameError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [typesError, setTypesError] = useState<string | undefined>();

  // Add new trainer type modal
  const [newTypeModalVisible, setNewTypeModalVisible] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  // Member multi-select modal
  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // Post-add WhatsApp sheet
  const [createdTrainerInfo, setCreatedTrainerInfo] = useState<{
    name: string;
    phone: string;
  } | null>(null);

  const submitLockRef = useRef(false);
  const createTypeLockRef = useRef(false);

  const {
    data: trainerTypes,
    isLoading: isTypesLoading,
    isError: isTypesError,
    refetch: refetchTypes,
  } = useTrainerTypes(true);

  const {
    data: membersData,
    isLoading: isMembersLoading,
  } = useMembers({ term: memberSearch, status: 'ACTIVE' });

  const createTrainer = useCreateTrainer();
  const createTrainerType = useCreateTrainerType();

  const activeTypes = useMemo(() => {
    if (!trainerTypes) return [];
    return trainerTypes.filter((t) => t.active);
  }, [trainerTypes]);

  const allMembers = useMemo(() => {
    if (!membersData?.pages) return [];
    return membersData.pages.flatMap((p) => p.content);
  }, [membersData]);

  if (role !== 'OWNER') {
    return (
      <Screen safeTop={false}>
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  const toggleType = (id: string) => {
    setTypesError(undefined);
    setSelectedTypeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreateNewType = async () => {
    const trimmed = newTypeName.trim();
    if (!trimmed || createTypeLockRef.current || createTrainerType.isPending) return;

    createTypeLockRef.current = true;
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
      // Toast handled in mutation hook
    } finally {
      createTypeLockRef.current = false;
    }
  };

  const handleSubmit = async () => {
    if (submitLockRef.current || createTrainer.isPending) return;

    const trimmedName = name.trim();
    const cleanedPhone = phone.replace(/\D/g, '');
    let valid = true;

    if (trimmedName.length < 2) {
      setNameError(VALIDATION.MIN_LENGTH(TRAINERS.NAME_LABEL, 2));
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

    if (selectedTypeIds.length === 0) {
      setTypesError(TRAINERS.TYPES_REQUIRED_ERROR);
      valid = false;
    } else {
      setTypesError(undefined);
    }

    if (!valid) return;

    submitLockRef.current = true;
    try {
      await createTrainer.mutateAsync({
        name: trimmedName,
        phone: cleanedPhone,
        trainerTypeIds: selectedTypeIds,
        memberIds: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
      });

      setCreatedTrainerInfo({
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
        setPhoneError(TRAINERS.PHONE_ALREADY_REGISTERED);
      } else {
        Toast.show({
          type: 'error',
          text1: COMMON.ERROR,
          text2: error?.response?.data?.message || ERRORS.GENERIC,
        });
      }
    } finally {
      submitLockRef.current = false;
    }
  };

  const handleShareOnWhatsApp = async () => {
    if (!createdTrainerInfo) return;
    const resolvedGymName =
      user?.gymName || gymSettings?.gymName || 'our gym';
    const message = TRAINERS.WHATSAPP_INVITE_MSG(
      createdTrainerInfo.name,
      resolvedGymName
    );
    const url = `https://wa.me/91${createdTrainerInfo.phone}?text=${encodeURIComponent(
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

  const handleDone = () => {
    setCreatedTrainerInfo(null);
    safeBack('/(tabs)/more/trainers');
  };

  return (
    <Screen
      safeTop={false}
      scrollable
      keyboardAvoiding
      contentContainerStyle={styles.container}
    >
      <GlassCard style={styles.formCard} contentStyle={styles.formContent}>
        {/* ── Name ──────────────────────────────────────────────── */}
        <Input
          label={TRAINERS.NAME_LABEL}
          placeholder={TRAINERS.NAME_PLACEHOLDER}
          value={name}
          onChangeText={(val) => {
            setName(val);
            if (nameError) setNameError(undefined);
          }}
          error={nameError}
          autoCapitalize="words"
          editable={!createTrainer.isPending}
        />

        {/* ── Mobile Number (+91, phone-pad) ────────────────────── */}
        <Input
          label={TRAINERS.PHONE_LABEL}
          prefix={TRAINERS.PHONE_PREFIX}
          placeholder={TRAINERS.PHONE_PLACEHOLDER}
          keyboardType="phone-pad"
          maxLength={10}
          value={phone}
          onChangeText={(val) => {
            const digitsOnly = val.replace(/\D/g, '').slice(0, 10);
            setPhone(digitsOnly);
            if (phoneError) setPhoneError(undefined);
          }}
          error={phoneError}
          editable={!createTrainer.isPending}
        />

        {/* ── Trainer Types Multi-Select Chips ──────────────────── */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>{TRAINERS.TYPES_LABEL}</Text>
            <TouchableOpacity
              style={styles.addTypeLink}
              onPress={() => setNewTypeModalVisible(true)}
              disabled={createTrainer.isPending}
              accessibilityRole="button"
            >
              <Plus size={14} color={colors.primary} style={styles.addTypeIcon} />
              <Text style={styles.addTypeLinkText}>{TRAINERS.ADD_NEW_TYPE_LINK}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>{TRAINERS.TYPES_HELPER}</Text>

          {isTypesLoading ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.typesLoader}
            />
          ) : isTypesError ? (
            <TouchableOpacity onPress={() => refetchTypes()}>
              <Text style={styles.errorInlineText}>{STATES_RETRY_LABEL}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.chipsGrid}>
              {activeTypes.map((type) => {
                const isSelected = selectedTypeIds.includes(type.id);
                return (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeChip,
                      isSelected && styles.typeChipSelected,
                    ]}
                    onPress={() => toggleType(type.id)}
                    activeOpacity={0.75}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                  >
                    {isSelected && (
                      <Check
                        size={14}
                        color={colors.textOnPrimary}
                        style={styles.chipCheckIcon}
                      />
                    )}
                    <Text
                      style={[
                        styles.typeChipText,
                        isSelected && styles.typeChipTextSelected,
                      ]}
                    >
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {typesError ? (
            <Text style={styles.errorInlineText}>{typesError}</Text>
          ) : null}
        </View>

        {/* ── Optional: Assign Members Now ──────────────────────── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>{TRAINERS.ASSIGN_MEMBERS_NOW_LABEL}</Text>
          <TouchableOpacity
            style={styles.assignMembersButton}
            onPress={() => setMemberModalVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <View style={styles.assignBtnLeft}>
              <Users size={18} color={colors.primary} style={styles.assignIcon} />
              <Text style={styles.assignMembersBtnText}>
                {selectedMemberIds.length > 0
                  ? TRAINERS.SELECTED_MEMBERS_COUNT(selectedMemberIds.length)
                  : TRAINERS.ASSIGN_MEMBERS_NOW_BTN}
              </Text>
            </View>
            <Text style={styles.assignChangeText}>
              {selectedMemberIds.length > 0 ? 'Edit' : 'Select'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Submit Button ─────────────────────────────────────── */}
        <View style={styles.submitRow}>
          <Button
            title={TRAINERS.ADD_BTN}
            onPress={handleSubmit}
            loading={createTrainer.isPending}
            disabled={createTrainer.isPending}
            size="lg"
          />
        </View>
      </GlassCard>

      {/* ── Add New Trainer Type Modal ──────────────────────────── */}
      <Modal
        visible={newTypeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !createTrainerType.isPending && setNewTypeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{TRAINERS.ADD_NEW_TYPE_MODAL_TITLE}</Text>
              <TouchableOpacity
                onPress={() => setNewTypeModalVisible(false)}
                disabled={createTrainerType.isPending}
              >
                <X size={20} color={colors.textSecondary} />
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

            <View style={styles.dialogActions}>
              <View style={styles.dialogBtnCol}>
                <Button
                  title={COMMON.CANCEL}
                  variant="secondary"
                  onPress={() => setNewTypeModalVisible(false)}
                  disabled={createTrainerType.isPending}
                  size="md"
                />
              </View>
              <View style={styles.dialogBtnCol}>
                <Button
                  title={COMMON.SAVE}
                  onPress={handleCreateNewType}
                  loading={createTrainerType.isPending}
                  disabled={createTrainerType.isPending || !newTypeName.trim()}
                  size="md"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Member Multi-Select Sheet ───────────────────────────── */}
      <Modal
        visible={memberModalVisible}
        transparent
        animationType={isPhone ? 'slide' : 'fade'}
        onRequestClose={() => setMemberModalVisible(false)}
      >
        <View style={[styles.modalOverlay, !isPhone && styles.modalOverlayDesktop]}>
          <View style={[styles.bottomSheet, !isPhone && styles.bottomSheetDesktop]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{TRAINERS.ASSIGN_MEMBERS_NOW_BTN}</Text>
              <TouchableOpacity
                onPress={() => setMemberModalVisible(false)}
                accessibilityRole="button"
              >
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <Search size={18} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={ASSIGN_MEMBERS.SEARCH_PLACEHOLDER}
                placeholderTextColor={colors.textSecondary}
                value={memberSearch}
                onChangeText={setMemberSearch}
              />
            </View>

            {isMembersLoading ? (
              <View style={styles.sheetLoader}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : allMembers.length === 0 ? (
              <EmptyState
                icon={<Users size={40} color={colors.primary} />}
                title={ASSIGN_MEMBERS.NO_MEMBERS_FOUND}
              />
            ) : (
              <FlatList
                data={allMembers}
                keyExtractor={(item) => item.id}
                style={styles.memberList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isSelected = selectedMemberIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.memberRow,
                        isSelected && styles.memberRowSelected,
                      ]}
                      onPress={() => toggleMember(item.id)}
                      activeOpacity={0.75}
                    >
                      <Avatar name={item.name} photoUrl={item.photoUrl} size="sm" />
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{item.name}</Text>
                        <Text style={styles.memberMeta}>
                          {item.memberCode} · {item.phone}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.checkbox,
                          isSelected && styles.checkboxSelected,
                        ]}
                      >
                        {isSelected && (
                          <Check size={14} color={colors.textOnPrimary} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            <View style={styles.sheetFooter}>
              <Button
                title={
                  selectedMemberIds.length > 0
                    ? `${COMMON.DONE} (${selectedMemberIds.length})`
                    : COMMON.DONE
                }
                onPress={() => setMemberModalVisible(false)}
                size="lg"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Post-Creation Success Sheet (WhatsApp + Done) ───────── */}
      <Modal
        visible={!!createdTrainerInfo}
        transparent
        animationType={isPhone ? 'slide' : 'fade'}
        onRequestClose={handleDone}
      >
        <View style={[styles.modalOverlay, !isPhone && styles.modalOverlayDesktop]}>
          <View style={[styles.bottomSheet, !isPhone && styles.bottomSheetDesktop]}>
            <View style={styles.successIconWrap}>
              <CheckCircle2 size={44} color={colors.primary} />
            </View>
            <Text style={styles.successSheetTitle}>{TRAINERS.SUCCESS_SHEET_TITLE}</Text>
            <Text style={styles.successSheetDesc}>{TRAINERS.SUCCESS_SHEET_DESC}</Text>

            <View style={styles.successActions}>
              <Button
                title={TRAINERS.SHARE_WHATSAPP_BTN}
                icon={<MessageCircle size={18} color={colors.textOnPrimary} />}
                onPress={handleShareOnWhatsApp}
                variant="primary"
                size="lg"
              />
              <View style={styles.doneBtnSpacing}>
                <Button
                  title={TRAINERS.DONE_BTN}
                  onPress={handleDone}
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

const STATES_RETRY_LABEL = 'Tap to retry loading types';

const makeStyles = (theme: ThemeValue) => StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    paddingBottom: 48,
  },
  formCard: {
    marginBottom: theme.spacing.lg,
  },
  formContent: {
    padding: theme.spacing.lg,
  },
  sectionBlock: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    fontFamily: theme.fonts.headingSemiBold,
  },
  helperText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 2,
    marginBottom: theme.spacing.sm,
  },
  addTypeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  addTypeIcon: {
    marginRight: 4,
  },
  addTypeLinkText: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingSemiBold,
  },
  typesLoader: {
    marginVertical: theme.spacing.md,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  typeChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipCheckIcon: {
    marginRight: 6,
  },
  typeChipText: {
    ...theme.typography.small,
    color: theme.colors.text,
    fontFamily: theme.fonts.headingMedium,
  },
  typeChipTextSelected: {
    color: theme.colors.textOnPrimary,
    fontFamily: theme.fonts.headingBold,
  },
  errorInlineText: {
    ...theme.typography.small,
    color: theme.colors.danger,
    marginTop: 6,
  },
  assignMembersButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    minHeight: 54,
  },
  assignBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignIcon: {
    marginRight: 10,
  },
  assignMembersBtnText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  assignChangeText: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingSemiBold,
  },
  submitRow: {
    marginTop: theme.spacing.md,
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
  dialogCard: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.lg,
    marginBottom: 'auto',
    marginTop: 'auto',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: theme.spacing.xs,
  },
  dialogBtnCol: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bottomSheetDesktop: {
    borderRadius: theme.radius.xl,
    width: '100%',
    maxWidth: 440,
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 15,
  },
  sheetLoader: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  memberList: {
    maxHeight: 360,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
    marginBottom: 6,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  memberRowSelected: {
    borderColor: theme.colors.primary,
  },
  memberInfo: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  memberName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  memberMeta: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  sheetFooter: {
    marginTop: theme.spacing.md,
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
