import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, parseISO } from 'date-fns';
import { LineChart } from 'react-native-gifted-charts';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Plus,
  X,
  Dumbbell,
  Apple,
  TrendingUp,
  FileText,
  Edit2,
  Scale,
  Calendar,
  NotebookPen,
} from 'lucide-react-native';
import { theme } from '../../src/theme/theme';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useMembers, Member } from '../../src/api/members';
import {
  useMemberNotes,
  useCreateMemberNote,
  useUpdateMemberNote,
  MemberNote,
  NoteType,
} from '../../src/api/notes';
import { Screen, TAB_BAR_HEIGHT, getScreenBottomPadding } from '../../src/components/Screen';
import { GlassCard } from '../../src/components/GlassCard';
import { Badge, BadgeVariant } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Avatar } from '../../src/components/Avatar';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorState } from '../../src/components/ErrorState';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const NOTE_TYPES: { type: NoteType; label: string; icon: any; variant: BadgeVariant }[] = [
  { type: 'WORKOUT', label: 'Workout', icon: Dumbbell, variant: 'neutral' },
  { type: 'DIET', label: 'Diet', icon: Apple, variant: 'success' },
  { type: 'PROGRESS', label: 'Progress', icon: TrendingUp, variant: 'warning' },
  { type: 'GENERAL', label: 'General', icon: FileText, variant: 'neutral' },
];

export default function NotesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const role = user?.role || useAuthStore((state) => state.role);
  const { userId } = useAuthStore();
  const isTrainer = role === 'TRAINER';

  React.useEffect(() => {
    if (role && role !== 'TRAINER') {
      router.replace('/(tabs)');
    }
  }, [role, router]);

  // 1. Fetch assigned members
  const {
    data: membersData,
    isLoading: isLoadingMembers,
    isError: isMembersError,
    refetch: refetchMembers,
  } = useMembers();

  const members: Member[] = useMemo(() => {
    return membersData?.pages.flatMap((page) => page.content) || [];
  }, [membersData]);

  // Selected member ID
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Auto-select first member once loaded if none selected
  const activeMemberId = selectedMemberId || (members.length > 0 ? members[0].id : null);
  const activeMember = members.find((m) => m.id === activeMemberId);

  // 2. Fetch notes for selected member
  const {
    data: notes = [],
    isLoading: isLoadingNotes,
    isError: isNotesError,
    refetch: refetchNotes,
  } = useMemberNotes(activeMemberId || undefined);

  // Mutations
  const createNoteMutation = useCreateMemberNote(activeMemberId || '');
  const updateNoteMutation = useUpdateMemberNote(activeMemberId || '');

  // Filter notes by type
  const [filterType, setFilterType] = useState<string>('ALL');

  // Modal state for Add/Edit
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<MemberNote | null>(null);

  // Form states
  const [formType, setFormType] = useState<NoteType>('WORKOUT');
  const [formText, setFormText] = useState('');
  const [formWeight, setFormWeight] = useState('');
  const [formChest, setFormChest] = useState('');
  const [formWaist, setFormWaist] = useState('');
  const [formHips, setFormHips] = useState('');
  const [formArms, setFormArms] = useState('');

  const openCreateModal = () => {
    setEditingNote(null);
    setFormType('WORKOUT');
    setFormText('');
    setFormWeight('');
    setFormChest('');
    setFormWaist('');
    setFormHips('');
    setFormArms('');
    setModalVisible(true);
  };

  const openEditModal = (note: MemberNote) => {
    setEditingNote(note);
    setFormType(note.type);
    setFormText(note.text);
    setFormWeight(note.weightKg ? String(note.weightKg) : '');
    const m = note.bodyMeasurements || {};
    setFormChest(m.chest ? String(m.chest) : '');
    setFormWaist(m.waist ? String(m.waist) : '');
    setFormHips(m.hips ? String(m.hips) : '');
    setFormArms(m.arms ? String(m.arms) : '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formText.trim() || !activeMemberId) return;

    const measurements: Record<string, any> = {};
    if (formChest.trim()) measurements.chest = formChest.trim();
    if (formWaist.trim()) measurements.waist = formWaist.trim();
    if (formHips.trim()) measurements.hips = formHips.trim();
    if (formArms.trim()) measurements.arms = formArms.trim();

    const payload = {
      type: formType,
      text: formText.trim(),
      weightKg: formWeight.trim() ? parseFloat(formWeight.trim()) : undefined,
      bodyMeasurements: Object.keys(measurements).length > 0 ? measurements : undefined,
    };

    try {
      if (editingNote) {
        await updateNoteMutation.mutateAsync({
          noteId: editingNote.id,
          payload,
        });
      } else {
        await createNoteMutation.mutateAsync(payload);
      }
      setModalVisible(false);
    } catch {
      // Toast error handled in mutation
    }
  };

  // 3. Prepare weight chart data
  const weightChartData = useMemo(() => {
    const weightNotes = notes
      .filter((n) => typeof n.weightKg === 'number' && n.weightKg > 0)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (weightNotes.length === 0) return [];

    return weightNotes.map((n) => {
      let label = '';
      try {
        label = format(parseISO(n.createdAt), 'dd MMM');
      } catch {
        label = '';
      }
      return {
        value: n.weightKg!,
        label,
        dataPointText: `${n.weightKg}kg`,
      };
    });
  }, [notes]);

  // Filtered notes
  const filteredNotes = useMemo(() => {
    if (filterType === 'ALL') return notes;
    return notes.filter((n) => n.type === filterType);
  }, [notes, filterType]);

  if (role && role !== 'TRAINER') {
    return null;
  }

  if (isLoadingMembers) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  if (isMembersError) {
    return (
      <Screen style={styles.centered}>
        <ErrorState message="Failed to load assigned members" onRetry={() => refetchMembers()} />
      </Screen>
    );
  }

  if (members.length === 0) {
    return (
      <Screen style={styles.centered}>
        <EmptyState
          icon={<NotebookPen size={40} color={theme.colors.primary} />}
          title="No Assigned Members"
          message="No members assigned yet. Your gym owner will assign members to you."
        />
      </Screen>
    );
  }

  const scrollBottomPad = getScreenBottomPadding(insets.bottom);

  return (
    <Screen safeBottom={false} style={{ flex: 1 }}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: scrollBottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Screen Header (Titled "Notes") ────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Notes</Text>
        </View>

        {/* ── 2. Member Selector Bar ───────────────────────────────── */}
        <View style={styles.memberSelectorHeader}>
          <Text style={styles.sectionHeading}>Assigned Members</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.memberChipsContainer}
        >
          {members.map((member) => {
            const isSelected = member.id === activeMemberId;
            return (
              <TouchableOpacity
                key={member.id}
                style={[
                  styles.memberChip,
                  isSelected && styles.memberChipSelected,
                ]}
                onPress={() => setSelectedMemberId(member.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Select ${member.name}`}
              >
                <Avatar
                  photoUrl={member.photoUrl}
                  name={member.name}
                  size="sm"
                />
                <Text
                  style={[
                    styles.memberChipName,
                    isSelected && styles.memberChipNameSelected,
                  ]}
                  numberOfLines={1}
                >
                  {member.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Active Member Info (No Duplicate Button) ─────────────── */}
        <View style={styles.memberHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.activeMemberTitle}>
              {activeMember?.name || 'Member Notes'}
            </Text>
            <Text style={styles.activeMemberSubtitle}>
              Track workout routines, diets, and weight progress
            </Text>
          </View>
        </View>

        {/* ── 6. Weight Progress Chart ─────────────────────────────── */}
        <GlassCard style={styles.chartCard} contentStyle={styles.chartCardContent}>
          <View style={styles.chartHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Scale size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.chartTitle}>Weight Progress (kg)</Text>
            </View>
            {weightChartData.length > 0 && (
              <Text style={styles.chartLatestText}>
                Latest: {weightChartData[weightChartData.length - 1].value} kg
              </Text>
            )}
          </View>

          {weightChartData.length >= 2 ? (
            <View style={styles.chartWrapper}>
              <LineChart
                data={weightChartData}
                width={SCREEN_WIDTH - 64}
                height={180}
                color={theme.colors.primary}
                thickness={2.5}
                curved
                areaChart
                startFillColor={theme.colors.primary + '33'}
                endFillColor={theme.colors.primary + '02'}
                startOpacity={0.4}
                endOpacity={0.0}
                initialSpacing={20}
                endSpacing={20}
                noOfSections={4}
                yAxisColor="transparent"
                xAxisColor={theme.colors.border}
                yAxisTextStyle={{ color: theme.colors.textMuted, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: theme.colors.textMuted, fontSize: 10 }}
                dataPointsColor={theme.colors.primary}
                dataPointsRadius={4}
                textFontSize={10}
                textColor={theme.colors.textMuted}
                textShiftY={-8}
                textShiftX={-10}
                rulesColor="rgba(218, 241, 222, 0.06)"
                rulesType="solid"
              />
            </View>
          ) : weightChartData.length === 1 ? (
            <View style={styles.singlePointBox}>
              <View style={styles.singlePointGridLine} />
              <View style={styles.singlePointMarker}>
                <View style={styles.singlePointBadge}>
                  <Text style={styles.singlePointBadgeText}>
                    {weightChartData[0].value} kg
                  </Text>
                </View>
                <View style={styles.singlePointHalo}>
                  <View style={styles.singlePointDot} />
                </View>
                <Text style={styles.singlePointDateText}>
                  {weightChartData[0].label}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.chartEmptyBox}>
              <Scale size={28} color={theme.colors.textMuted} style={{ marginBottom: 6 }} />
              <Text style={styles.chartEmptyText}>
                No weight entries yet. Add progress notes with weight to track changes.
              </Text>
            </View>
          )}
        </GlassCard>

        {/* ── 5. Filter Chips with Fade & Non-Zero Counts ──────────── */}
        <View style={styles.filterWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <TouchableOpacity
              style={[styles.filterChip, filterType === 'ALL' && styles.filterChipActive]}
              onPress={() => setFilterType('ALL')}
            >
              <Text style={[styles.filterChipText, filterType === 'ALL' && styles.filterChipTextActive]}>
                All{notes.length > 0 ? ` (${notes.length})` : ''}
              </Text>
            </TouchableOpacity>
            {NOTE_TYPES.map((t) => {
              const count = notes.filter((n) => n.type === t.type).length;
              const isActive = filterType === t.type;
              return (
                <TouchableOpacity
                  key={t.type}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setFilterType(t.type)}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {t.label}{count > 0 ? ` (${count})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <LinearGradient
            colors={['transparent', theme.colors.background]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.fadeGradientRight}
            pointerEvents="none"
          />
        </View>

        {/* ── 4. Notes Timeline & Empty State ──────────────────────── */}
        {isLoadingNotes ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : isNotesError ? (
          <ErrorState message="Failed to load notes" onRetry={() => refetchNotes()} />
        ) : filteredNotes.length === 0 ? (
          <EmptyState
            icon={<NotebookPen size={36} color={theme.colors.primary} />}
            message={`No notes yet. Add the first note for ${activeMember?.name || 'this member'}.`}
          />
        ) : (
          filteredNotes.map((note) => {
            const typeDef = NOTE_TYPES.find((t) => t.type === note.type) || NOTE_TYPES[3];
            const canEdit = isTrainer ? note.trainerId === userId : true;
            let createdDateStr = '';
            try {
              createdDateStr = format(parseISO(note.createdAt), 'dd MMM yyyy, hh:mm a');
            } catch {
              createdDateStr = '';
            }

            return (
              <GlassCard key={note.id} style={styles.noteCard} contentStyle={styles.noteCardContent}>
                <View style={styles.noteHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Badge label={typeDef.label} variant={typeDef.variant} size="sm" />
                    {note.trainerName && (
                      <Text style={styles.noteTrainerText}>by {note.trainerName}</Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Calendar size={13} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
                    <Text style={styles.noteDateText}>{createdDateStr}</Text>
                    {canEdit && (
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => openEditModal(note)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Edit note"
                      >
                        <Edit2 size={15} color={theme.colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <Text style={styles.noteBodyText}>{note.text}</Text>

                {/* Extra details: weight and measurements */}
                {(typeof note.weightKg === 'number' || note.bodyMeasurements) && (
                  <View style={styles.extraDetailsWrap}>
                    {typeof note.weightKg === 'number' && (
                      <View style={styles.metricPill}>
                        <Scale size={13} color={theme.colors.primary} style={{ marginRight: 4 }} />
                        <Text style={styles.metricPillText}>Weight: {note.weightKg} kg</Text>
                      </View>
                    )}
                    {note.bodyMeasurements &&
                      Object.entries(note.bodyMeasurements).map(([key, val]) => (
                        <View key={key} style={styles.metricPill}>
                          <Text style={styles.metricPillText}>
                            {key.charAt(0).toUpperCase() + key.slice(1)}: {String(val)}
                          </Text>
                        </View>
                      ))}
                  </View>
                )}
              </GlassCard>
            );
          })
        )}
      </ScrollView>

      {/* ── 3. Single Primary "Add Note" Button (FAB) ─────────────── */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            bottom: TAB_BAR_HEIGHT + insets.bottom + 16,
          },
        ]}
        onPress={openCreateModal}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Add Note"
      >
        <Plus size={26} color={theme.colors.textOnPrimary} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* ── Add / Edit Note Modal ──────────────────────────────────── */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingNote ? 'Edit Note' : 'Add Note'}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Type selector */}
              <Text style={styles.inputLabel}>Note Type *</Text>
              <View style={styles.typeSelectorRow}>
                {NOTE_TYPES.map((t) => {
                  const isSelected = formType === t.type;
                  const Icon = t.icon;
                  return (
                    <TouchableOpacity
                      key={t.type}
                      style={[styles.typeOption, isSelected && styles.typeOptionSelected]}
                      onPress={() => setFormType(t.type)}
                      activeOpacity={0.8}
                    >
                      <Icon
                        size={16}
                        color={isSelected ? theme.colors.textOnPrimary : theme.colors.textMuted}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.typeOptionText,
                          isSelected && styles.typeOptionTextSelected,
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Note Text */}
              <Text style={styles.inputLabel}>Details / Instructions *</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Enter workout set, diet plan or progress observations..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={4}
                value={formText}
                onChangeText={setFormText}
                textAlignVertical="top"
                cursorColor="#8EB69B"
                selectionColor="#8EB69B"
              />

              {/* Optional Progress Metrics */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Weight (kg) — optional</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 74.5"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                value={formWeight}
                onChangeText={setFormWeight}
                cursorColor="#8EB69B"
                selectionColor="#8EB69B"
              />

              {/* Measurements */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Body Measurements (optional)
              </Text>
              <View style={styles.measurementsGrid}>
                <View style={styles.measurementItem}>
                  <Text style={styles.measurementSubLabel}>Chest (in)</Text>
                  <TextInput
                    style={styles.measurementInput}
                    placeholder="38"
                    placeholderTextColor={theme.colors.textMuted}
                    value={formChest}
                    onChangeText={setFormChest}
                    cursorColor="#8EB69B"
                    selectionColor="#8EB69B"
                  />
                </View>
                <View style={styles.measurementItem}>
                  <Text style={styles.measurementSubLabel}>Waist (in)</Text>
                  <TextInput
                    style={styles.measurementInput}
                    placeholder="32"
                    placeholderTextColor={theme.colors.textMuted}
                    value={formWaist}
                    onChangeText={setFormWaist}
                    cursorColor="#8EB69B"
                    selectionColor="#8EB69B"
                  />
                </View>
                <View style={styles.measurementItem}>
                  <Text style={styles.measurementSubLabel}>Hips (in)</Text>
                  <TextInput
                    style={styles.measurementInput}
                    placeholder="36"
                    placeholderTextColor={theme.colors.textMuted}
                    value={formHips}
                    onChangeText={setFormHips}
                    cursorColor="#8EB69B"
                    selectionColor="#8EB69B"
                  />
                </View>
                <View style={styles.measurementItem}>
                  <Text style={styles.measurementSubLabel}>Arms (in)</Text>
                  <TextInput
                    style={styles.measurementInput}
                    placeholder="14"
                    placeholderTextColor={theme.colors.textMuted}
                    value={formArms}
                    onChangeText={setFormArms}
                    cursorColor="#8EB69B"
                    selectionColor="#8EB69B"
                  />
                </View>
              </View>

              <View style={{ marginTop: 24, marginBottom: 20 }}>
                <Button
                  title={editingNote ? 'Update Note' : 'Save Note'}
                  onPress={handleSave}
                  loading={createNoteMutation.isPending || updateNoteMutation.isPending}
                  disabled={!formText.trim()}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  header: {
    marginBottom: theme.spacing.md,
  },
  headerTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 26,
    color: theme.colors.text,
  },
  memberSelectorHeader: {
    marginBottom: 8,
  },
  sectionHeading: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  memberChipsContainer: {
    paddingBottom: 12,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginRight: 8,
  },
  memberChipSelected: {
    backgroundColor: 'rgba(142, 182, 155, 0.18)',
    borderColor: theme.colors.primary,
  },
  memberChipName: {
    ...theme.typography.body,
    fontSize: 13,
    color: theme.colors.textMuted,
    marginLeft: 8,
    marginRight: 4,
    maxWidth: 110,
  },
  memberChipNameSelected: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodySemiBold,
  },
  memberHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  activeMemberTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  activeMemberSubtitle: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  chartCard: {
    marginBottom: 16,
  },
  chartCardContent: {
    padding: theme.spacing.md,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chartTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  chartLatestText: {
    ...theme.typography.caption,
    color: theme.colors.primaryLight,
  },
  chartWrapper: {
    alignItems: 'center',
    marginVertical: 6,
    overflow: 'hidden',
  },
  singlePointBox: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 6,
  },
  singlePointGridLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(218, 241, 222, 0.08)',
  },
  singlePointMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  singlePointBadge: {
    backgroundColor: theme.colors.raised,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    marginBottom: 8,
  },
  singlePointBadgeText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 12,
    color: theme.colors.text,
  },
  singlePointHalo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(142, 182, 155, 0.20)',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singlePointDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  singlePointDateText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 8,
    fontSize: 11,
  },
  chartEmptyBox: {
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: theme.radius.md,
    paddingHorizontal: 20,
  },
  chartEmptyText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  filterWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  filterRow: {
    paddingBottom: 4,
    paddingRight: 24,
  },
  fadeGradientRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 36,
  },
  filterChip: {
    backgroundColor: theme.colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: 'rgba(142, 182, 155, 0.2)',
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
  },
  filterChipTextActive: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.bodySemiBold,
  },
  noteCard: {
    marginBottom: 12,
  },
  noteCardContent: {
    padding: theme.spacing.md,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  noteTrainerText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginLeft: 8,
  },
  noteDateText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginRight: 8,
  },
  editBtn: {
    padding: 4,
  },
  noteBodyText: {
    ...theme.typography.body,
    color: theme.colors.text,
    lineHeight: 22,
  },
  extraDetailsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.raised,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  metricPillText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  modalBody: {
    maxHeight: 520,
  },
  inputLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 6,
    fontFamily: theme.fonts.headingMedium,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
  },
  typeOptionSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  typeOptionText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  typeOptionTextSelected: {
    color: theme.colors.textOnPrimary,
    fontFamily: theme.fonts.headingBold,
  },
  textArea: {
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 14,
    minHeight: 90,
  },
  textInput: {
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 14,
  },
  measurementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  measurementItem: {
    width: '48%',
  },
  measurementSubLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 4,
    fontSize: 11,
  },
  measurementInput: {
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 10,
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 14,
  },
});
