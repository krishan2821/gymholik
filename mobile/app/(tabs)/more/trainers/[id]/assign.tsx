import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { showConfirmDialog } from '../../../../../src/components/ConfirmDialog';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { safeBack } from '../../../../../src/utils/navigation';
import { Search, Check, Users, IndianRupee, Dumbbell, FileText } from 'lucide-react-native';
import { useTheme, useStyles, ThemeValue } from '../../../../../src/theme/ThemeContext';
import { useAuthStore } from '../../../../../src/store/useAuthStore';
import {
  useTrainer,
  useTrainerAssignments,
  useAssignMembers,
} from '../../../../../src/api/trainers';
import { useMembers } from '../../../../../src/api/members';
import { Screen } from '../../../../../src/components/Screen';
import { PageHeader } from '../../../../../src/components/PageHeader';
import { GlassCard } from '../../../../../src/components/GlassCard';
import { Avatar } from '../../../../../src/components/Avatar';
import { Badge } from '../../../../../src/components/Badge';
import { Button } from '../../../../../src/components/Button';
import { EmptyState } from '../../../../../src/components/EmptyState';
import { ErrorState } from '../../../../../src/components/ErrorState';
import { ASSIGN_MEMBERS, COMMON, ERRORS } from '../../../../../src/constants/strings';

export default function AssignMembersScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { role } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [ptFee, setPtFee] = useState('');
  const [sessionsTotal, setSessionsTotal] = useState('');
  const [notes, setNotes] = useState('');

  const { data: trainer, isLoading: isTrainerLoading } = useTrainer(id as string);

  // Fetch active gym members
  const {
    data: membersData,
    isLoading: isMembersLoading,
    isError: isMembersError,
    refetch: refetchMembers,
  } = useMembers({ term: searchTerm, status: 'ACTIVE' });

  // Fetch all active assignments in gym to see who is already assigned
  const {
    data: assignmentsData,
    isLoading: isAssignmentsLoading,
  } = useTrainerAssignments({ status: 'ACTIVE', size: 500 });

  const assignMutation = useAssignMembers();

  if (role !== 'OWNER') {
    return (
      <Screen safeTop={true}>
        <PageHeader title={ASSIGN_MEMBERS.SCREEN_TITLE} showBack onBack={() => safeBack(`/(tabs)/more/trainers/${id}`)} />
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  // Map active assignments by memberId
  const assignmentsByMemberId = useMemo(() => {
    const map = new Map<string, { trainerId: string; trainerName: string }>();
    if (assignmentsData?.content) {
      for (const a of assignmentsData.content) {
        map.set(a.memberId, {
          trainerId: a.trainerId,
          trainerName: a.trainerName || 'Another Trainer',
        });
      }
    }
    return map;
  }, [assignmentsData]);

  // Flatten infinite query member pages
  const allMembers = useMemo(() => {
    if (!membersData?.pages) return [];
    return membersData.pages.flatMap((page) => page.content);
  }, [membersData]);

  const toggleSelectMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((i) => i !== memberId) : [...prev, memberId]
    );
  };

  const handleConfirmSubmit = () => {
    if (selectedMemberIds.length === 0) return;
    const trainerName = trainer?.name || 'Trainer';

    showConfirmDialog({
      title: ASSIGN_MEMBERS.CONFIRM_TITLE,
      message: ASSIGN_MEMBERS.CONFIRM_MSG(selectedMemberIds.length, trainerName),
      confirmText: COMMON.CONFIRM,
      cancelText: COMMON.CANCEL,
      onConfirm: async () => {
        try {
          const feeNumber = ptFee.trim() ? Math.round(parseFloat(ptFee) * 100) : undefined;
          const sessionsNum = sessionsTotal.trim() ? parseInt(sessionsTotal, 10) : undefined;

          await assignMutation.mutateAsync({
            trainerId: id as string,
            memberIds: selectedMemberIds,
            ptFeePaise: feeNumber,
            sessionsTotal: sessionsNum,
            notes: notes.trim() || undefined,
          });
          safeBack('/(tabs)/more');
        } catch {
          // Toast
        }
      },
    });
  };

  const isLoading = isTrainerLoading || isMembersLoading || isAssignmentsLoading;

  if (isLoading && !membersData) {
    return (
      <Screen safeTop={false} style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (isMembersError) {
    return (
      <Screen safeTop={true}>
        <PageHeader title={ASSIGN_MEMBERS.SCREEN_TITLE} showBack onBack={() => safeBack(`/(tabs)/more/trainers/${id}`)} />
        <ErrorState message={ERRORS.GENERIC} onRetry={() => refetchMembers()} />
      </Screen>
    );
  }

  const renderMemberItem = ({ item }: { item: any }) => {
    const existing = assignmentsByMemberId.get(item.id);
    const isAssignedToThisTrainer = existing && existing.trainerId === id;
    const isAssignedToOther = existing && existing.trainerId !== id;
    const isSelected = selectedMemberIds.includes(item.id);

    return (
      <TouchableOpacity
        activeOpacity={isAssignedToThisTrainer ? 1 : 0.7}
        onPress={() => {
          if (!isAssignedToThisTrainer) {
            toggleSelectMember(item.id);
          }
        }}
        disabled={isAssignedToThisTrainer}
      >
        <GlassCard
          style={[
            styles.memberCard,
            isSelected && styles.memberCardSelected,
            isAssignedToThisTrainer && styles.memberCardDisabled,
          ]}
          contentStyle={styles.memberCardContent}
        >
          <View style={styles.memberCardLeft}>
            <Avatar name={item.name} photoUrl={item.photoUrl} size="md" />
            <View style={styles.memberDetails}>
              <Text style={styles.memberName}>{item.name}</Text>
              <Text style={styles.memberSub}>
                ID: {item.memberCode} · {item.phone}
              </Text>

              {isAssignedToThisTrainer && (
                <View style={{ marginTop: 4 }}>
                  <Badge
                    label={ASSIGN_MEMBERS.ALREADY_ASSIGNED_THIS}
                    variant="neutral"
                    size="sm"
                  />
                </View>
              )}

              {isAssignedToOther && (
                <View style={{ marginTop: 4 }}>
                  <Badge
                    label={ASSIGN_MEMBERS.ALREADY_ASSIGNED_OTHER(existing.trainerName)}
                    variant="warning"
                    size="sm"
                  />
                </View>
              )}
            </View>
          </View>

          <View
            style={[
              styles.checkboxBox,
              isSelected && styles.checkboxBoxSelected,
              isAssignedToThisTrainer && styles.checkboxBoxDisabled,
            ]}
          >
            {isSelected && <Check size={16} color={colors.textOnPrimary} />}
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  return (
    <Screen safeTop={true} keyboardAvoiding contentContainerStyle={styles.container}>
      <PageHeader
        title={ASSIGN_MEMBERS.SCREEN_TITLE}
        showBack
        onBack={() => safeBack(`/(tabs)/more/trainers/${id}`)}
      />
      {/* ── Search Bar ─────────────────────────────────────────── */}
      <View style={styles.searchBox}>
        <Search size={18} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={ASSIGN_MEMBERS.SEARCH_PLACEHOLDER}
          placeholderTextColor={colors.textSecondary}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      {/* ── Members List ───────────────────────────────────────── */}
      {allMembers.length === 0 ? (
        <EmptyState
          icon={<Users size={40} color={colors.primary} />}
          title={ASSIGN_MEMBERS.NO_MEMBERS_FOUND}
        />
      ) : (
        <FlatList
          data={allMembers}
          keyExtractor={(item) => item.id}
          renderItem={renderMemberItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* ── Optional Assignment Fields & Submit ────────────────── */}
      <GlassCard style={styles.bottomCard} contentStyle={styles.bottomCardContent}>
        <View style={styles.optionalFieldsRow}>
          <View style={styles.fieldCol}>
            <Text style={styles.fieldLabel}>PT Fee (₹)</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. 2500"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={ptFee}
              onChangeText={setPtFee}
            />
          </View>
          <View style={styles.fieldCol}>
            <Text style={styles.fieldLabel}>Sessions</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. 12"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={sessionsTotal}
              onChangeText={setSessionsTotal}
            />
          </View>
        </View>

        <View style={{ marginTop: 8 }}>
          <Text style={styles.fieldLabel}>Notes (Optional)</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="Special instructions or batch timing"
            placeholderTextColor={colors.textSecondary}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        <View style={styles.actionBtnRow}>
          <Button
            title={
              selectedMemberIds.length > 0
                ? ASSIGN_MEMBERS.SUBMIT_BTN(selectedMemberIds.length)
                : 'Select Members'
            }
            onPress={handleConfirmSubmit}
            loading={assignMutation.isPending}
            disabled={assignMutation.isPending || selectedMemberIds.length === 0}
            size="lg"
          />
        </View>
      </GlassCard>
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 220,
  },
  memberCard: {
    marginBottom: theme.spacing.sm,
  },
  memberCardSelected: {
    borderColor: theme.colors.primary,
  },
  memberCardDisabled: {
    opacity: 0.6,
  },
  memberCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  memberCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberDetails: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  memberName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  memberSub: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxBoxSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkboxBoxDisabled: {
    backgroundColor: theme.colors.surfaceRaised,
    borderColor: theme.colors.borderLight,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  bottomCardContent: {
    padding: theme.spacing.md,
    paddingBottom: 28,
  },
  optionalFieldsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldCol: {
    flex: 1,
  },
  fieldLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
    color: theme.colors.text,
    fontSize: 14,
  },
  actionBtnRow: {
    marginTop: theme.spacing.md,
  },
});
