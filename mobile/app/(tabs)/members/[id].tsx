import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Phone,
  MessageCircle,
  Edit,
  Trash2,
  CalendarDays,
  Wallet,
  CreditCard,
  RefreshCw,
  QrCode,
  X,
  Share2,
  Dumbbell,
  ArrowRightLeft,
  UserX,
  Apple,
  TrendingUp,
  Scale,
  Edit2,
  Lock,
  Plus,
} from 'lucide-react-native';
import { differenceInDays, parseISO, format } from 'date-fns';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { theme } from '../../../src/theme/theme';
import { useMember } from '../../../src/api/members';
import {
  useTrainerAssignments,
  useTrainers,
  useEndAssignment,
  useAssignMembers,
} from '../../../src/api/trainers';
import {
  useMemberNotes,
  useCreateMemberNote,
  useUpdateMemberNote,
  MemberNote,
  NoteType,
} from '../../../src/api/notes';
import { useMemberAttendanceHistory } from '../../../src/api/attendance';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { Screen } from '../../../src/components/Screen';
import { GlassCard } from '../../../src/components/GlassCard';
import { Avatar, AvatarStatus } from '../../../src/components/Avatar';
import { Badge, BadgeVariant } from '../../../src/components/Badge';
import { Button } from '../../../src/components/Button';
import { ErrorState } from '../../../src/components/ErrorState';
import { MaskedPhone, isPhoneMasked } from '../../../src/components/MaskedPhone';
import { MEMBER_PROFILE, COMMON } from '../../../src/constants/strings';

function formatCheckInTime(time: any): string {
  if (!time) return 'Checked In';
  if (typeof time === 'string') {
    try {
      return format(parseISO(time), 'hh:mm a');
    } catch {
      return time;
    }
  }
  if (typeof time === 'object' && typeof time.hour === 'number') {
    const h = time.hour % 12 || 12;
    const m = String(time.minute).padStart(2, '0');
    const ampm = time.hour >= 12 ? 'PM' : 'AM';
    return `${h}:${m} ${ampm}`;
  }
  return 'Checked In';
}

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { role, userId } = useAuthStore();
  const { data: member, isLoading, isError, error, refetch } = useMember(id as string);
  const isOwner = role === 'OWNER';
  const isTrainer = role === 'TRAINER';

  const { data: assignmentsData, refetch: refetchAssignment } = useTrainerAssignments({
    memberId: id as string,
    status: 'ACTIVE',
  });
  const { data: activeTrainers } = useTrainers('ACTIVE');
  const endAssignmentMutation = useEndAssignment();
  const assignMemberMutation = useAssignMembers();

  // Attendance history for member
  const { data: attendanceHistory = [], isLoading: isLoadingAttendance } = useMemberAttendanceHistory(id as string);

  // Notes for member
  const { data: memberNotes = [], isLoading: isLoadingNotes } = useMemberNotes(id as string);
  const createNoteMutation = useCreateMemberNote(id as string);
  const updateNoteMutation = useUpdateMemberNote(id as string);

  // Note modal state
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<MemberNote | null>(null);
  const [noteType, setNoteType] = useState<NoteType>('WORKOUT');
  const [noteText, setNoteText] = useState('');
  const [noteWeight, setNoteWeight] = useState('');
  const [noteChest, setNoteChest] = useState('');
  const [noteWaist, setNoteWaist] = useState('');
  const [noteHips, setNoteHips] = useState('');
  const [noteArms, setNoteArms] = useState('');

  const openCreateNoteModal = () => {
    setEditingNote(null);
    setNoteType('WORKOUT');
    setNoteText('');
    setNoteWeight('');
    setNoteChest('');
    setNoteWaist('');
    setNoteHips('');
    setNoteArms('');
    setNoteModalVisible(true);
  };

  const openEditNoteModal = (note: MemberNote) => {
    setEditingNote(note);
    setNoteType(note.type);
    setNoteText(note.text);
    setNoteWeight(note.weightKg ? String(note.weightKg) : '');
    const m = note.bodyMeasurements || {};
    setNoteChest(m.chest ? String(m.chest) : '');
    setNoteWaist(m.waist ? String(m.waist) : '');
    setNoteHips(m.hips ? String(m.hips) : '');
    setNoteArms(m.arms ? String(m.arms) : '');
    setNoteModalVisible(true);
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    const measurements: Record<string, any> = {};
    if (noteChest.trim()) measurements.chest = noteChest.trim();
    if (noteWaist.trim()) measurements.waist = noteWaist.trim();
    if (noteHips.trim()) measurements.hips = noteHips.trim();
    if (noteArms.trim()) measurements.arms = noteArms.trim();

    const payload = {
      type: noteType,
      text: noteText.trim(),
      weightKg: noteWeight.trim() ? parseFloat(noteWeight.trim()) : undefined,
      bodyMeasurements: Object.keys(measurements).length > 0 ? measurements : undefined,
    };

    try {
      if (editingNote) {
        await updateNoteMutation.mutateAsync({ noteId: editingNote.id, payload });
      } else {
        await createNoteMutation.mutateAsync(payload);
      }
      setNoteModalVisible(false);
    } catch {
      // Toast error handled in mutation
    }
  };

  const [showQRModal, setShowQRModal] = useState(false);
  const [trainerPickerVisible, setTrainerPickerVisible] = useState(false);
  const viewShotRef = useRef<any>(null);

  const handleShareQR = async () => {
    try {
      const uri = await viewShotRef.current?.capture();
      if (uri) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/jpeg',
            dialogTitle: 'Share QR Card',
          });
        } else {
          Alert.alert('Error', 'Sharing not available on this device');
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to capture QR code');
    }
  };

  if (isLoading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  const is404 = (error as any)?.response?.status === 404;

  if (isError || !member) {
    if (is404) {
      return (
        <Screen style={styles.centered}>
          <ErrorState
            message={
              isTrainer
                ? 'This member is no longer assigned to you'
                : 'This member was not found.'
            }
            onRetry={() => router.back()}
          />
          <View style={{ marginTop: 16 }}>
            <Button
              title="Go Back"
              variant="secondary"
              onPress={() => router.back()}
              size="sm"
            />
          </View>
        </Screen>
      );
    }
    return (
      <Screen style={styles.centered}>
        <ErrorState message={MEMBER_PROFILE.LOAD_ERROR} onRetry={() => refetch()} />
      </Screen>
    );
  }

  const { name, phone, photoUrl, currentMembership, memberCode } = member;
  const status = getMembershipStatus(currentMembership);
  const masked = isPhoneMasked(phone);

  const openWhatsApp = () => {
    if (masked || isTrainer) return;
    Linking.openURL(`https://wa.me/91${phone}`);
  };

  const callPhone = () => {
    if (masked || isTrainer) return;
    Linking.openURL(`tel:${phone}`);
  };

  const handleDelete = () => {
    Alert.alert(
      MEMBER_PROFILE.DELETE_CONFIRM_TITLE,
      MEMBER_PROFILE.DELETE_CONFIRM_MSG,
      [
        { text: COMMON.CANCEL, style: 'cancel' },
        {
          text: COMMON.DELETE,
          style: 'destructive',
          onPress: () => console.log('Delete member', id),
        },
      ]
    );
  };

  const activeAssignment = assignmentsData?.content?.[0];

  const handleUnassignTrainer = () => {
    if (!activeAssignment) return;
    Alert.alert(
      'Unassign Trainer',
      `Unassign ${activeAssignment.trainerName || 'trainer'} from ${name}?`,
      [
        { text: COMMON.CANCEL, style: 'cancel' },
        {
          text: 'Unassign',
          style: 'destructive',
          onPress: async () => {
            try {
              await endAssignmentMutation.mutateAsync(activeAssignment.id);
              refetchAssignment();
            } catch {
              // Handled by toast
            }
          },
        },
      ]
    );
  };

  const handleSelectTrainer = async (newTrainer: any) => {
    try {
      if (activeAssignment) {
        await endAssignmentMutation.mutateAsync(activeAssignment.id);
      }
      await assignMemberMutation.mutateAsync({
        trainerId: newTrainer.id,
        memberIds: [id as string],
      });
      setTrainerPickerVisible(false);
      refetchAssignment();
    } catch {
      // Handled by toast
    }
  };

  return (
    <Screen scrollable contentContainerStyle={styles.scroll}>
      {/* ── Top Member Header Card ─────────────────────────────────── */}
      <GlassCard style={styles.headerCard} contentStyle={styles.headerInner}>
        <View style={styles.headerTop}>
          <Avatar
            photoUrl={photoUrl}
            name={name}
            status={status.avatarStatus}
            size="lg"
          />
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.memberCode}>{memberCode}</Text>
            {!masked && !isTrainer ? (
              <TouchableOpacity onPress={callPhone} style={styles.phoneRow} accessibilityRole="button">
                <Phone color={theme.colors.primary} size={15} style={{ marginRight: 6 }} />
                <MaskedPhone phone={phone} textStyle={styles.phone} showTooltipOnPress={false} />
              </TouchableOpacity>
            ) : (
              <View style={styles.phoneRow}>
                <MaskedPhone phone={phone} textStyle={styles.phone} showTooltipOnPress={true} />
              </View>
            )}
          </View>
          <Badge label={status.text} variant={status.badgeVariant} size="sm" />
        </View>

        {!isTrainer && (!masked || isOwner) && (
          <View style={styles.actionRow}>
            {!masked && (
              <TouchableOpacity style={styles.actionBtn} onPress={openWhatsApp} accessibilityRole="button">
                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(142, 182, 155, 0.15)' }]}>
                  <MessageCircle color={theme.colors.primary} size={20} />
                </View>
                <Text style={styles.actionText}>WhatsApp</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.actionBtn} accessibilityRole="button">
              <View style={[styles.actionIconBox, { backgroundColor: theme.colors.raised }]}>
                <Edit color={theme.colors.text} size={20} />
              </View>
              <Text style={styles.actionText}>{COMMON.EDIT}</Text>
            </TouchableOpacity>

            {isOwner && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleDelete} accessibilityRole="button">
                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(255, 107, 107, 0.15)' }]}>
                  <Trash2 color={theme.colors.error} size={20} />
                </View>
                <Text style={[styles.actionText, { color: theme.colors.error }]}>
                  {COMMON.DELETE}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </GlassCard>

      {/* ── Membership Details ────────────────────────────────────── */}
      <GlassCard style={styles.sectionCard} contentStyle={styles.sectionInner}>
        <Text style={styles.sectionTitle}>{MEMBER_PROFILE.SECTION_MEMBERSHIP}</Text>
        {currentMembership ? (
          <>
            <View style={styles.planCard}>
              <View style={styles.planHeaderRow}>
                <DaysLeftProgressRing
                  startDate={currentMembership.startDate}
                  expiryDate={currentMembership.expiryDate}
                />
                <View style={styles.planHeaderInfo}>
                  <Text style={styles.planName}>{currentMembership.planName}</Text>
                  <Text style={styles.planDatesSubtext}>
                    {format(parseISO(currentMembership.startDate), 'dd MMM yyyy')} –{' '}
                    {format(parseISO(currentMembership.expiryDate), 'dd MMM yyyy')}
                  </Text>
                  <Badge label={status.text} variant={status.badgeVariant} size="sm" />
                </View>
              </View>

              {!isTrainer && (
                <>
                  <View style={styles.divider} />

                  <View style={styles.detailRow}>
                    <View style={styles.detailBox}>
                      <Text style={styles.detailLabel}>Total Fee</Text>
                      <Text style={styles.detailValue}>₹{currentMembership.totalPaise / 100}</Text>
                    </View>
                    <View style={styles.detailBox}>
                      <Text style={styles.detailLabel}>Due Amount</Text>
                      <Text
                        style={[
                          styles.detailValue,
                          currentMembership.duePaise > 0 && { color: theme.colors.error },
                        ]}
                      >
                        ₹{currentMembership.duePaise / 100}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {!isTrainer && (
              <>
                <View style={styles.buttonRow}>
                  {currentMembership.duePaise > 0 && (
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Button
                        title={MEMBER_PROFILE.COLLECT}
                        icon={<Wallet color={theme.colors.textOnPrimary} size={18} />}
                        onPress={() =>
                          router.push({
                            pathname: '/(tabs)/payments/collect',
                            params: { memberId: id },
                          })
                        }
                        size="sm"
                      />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Button
                      title={MEMBER_PROFILE.RENEW}
                      icon={<RefreshCw color={theme.colors.textOnPrimary} size={18} />}
                      onPress={() => router.push(`/(tabs)/members/${id}/renew`)}
                      size="sm"
                    />
                  </View>
                </View>

                <View style={{ marginTop: theme.spacing.md }}>
                  <Button
                    title="Show QR Card"
                    variant="secondary"
                    icon={<QrCode color={theme.colors.text} size={18} />}
                    onPress={() => setShowQRModal(true)}
                    size="sm"
                  />
                </View>
              </>
            )}
          </>
        ) : (
          <View style={styles.planCard}>
            <Text style={styles.noMembershipText}>{MEMBER_PROFILE.NO_MEMBERSHIP}</Text>
            {!isTrainer && (
              <View style={{ marginTop: 16 }}>
                <Button
                  title={MEMBER_PROFILE.RENEW}
                  icon={<RefreshCw color={theme.colors.textOnPrimary} size={18} />}
                  onPress={() => router.push(`/(tabs)/members/${id}/renew`)}
                  size="sm"
                />
              </View>
            )}
          </View>
        )}
      </GlassCard>

      {/* ── Last 30 Days Attendance (for Trainer and others) ─────── */}
      <GlassCard style={styles.sectionCard} contentStyle={styles.sectionInner}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <CalendarDays size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Last 30 Days Attendance</Text>
          </View>
          <Badge
            label={`${attendanceHistory.length} Check-ins`}
            variant={attendanceHistory.length > 0 ? 'success' : 'neutral'}
            size="sm"
          />
        </View>

        {isLoadingAttendance ? (
          <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
        ) : attendanceHistory.length === 0 ? (
          <Text style={styles.emptyAttendanceText}>No check-ins recorded in the last 30 days.</Text>
        ) : (
          <View style={styles.attendanceHistoryList}>
            {attendanceHistory.slice(0, 10).map((record) => {
              let dateStr = record.date;
              try {
                dateStr = format(parseISO(record.date), 'dd MMM yyyy (EEE)');
              } catch {}
              return (
                <View key={record.id} style={styles.attendanceItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attendanceDateText}>{dateStr}</Text>
                    <Text style={styles.attendanceTimeText}>
                      {formatCheckInTime(record.checkInTime)}
                    </Text>
                  </View>
                  <Badge label="Present" variant="success" size="sm" />
                </View>
              );
            })}
            {attendanceHistory.length > 10 && (
              <Text style={styles.moreAttendanceText}>+ {attendanceHistory.length - 10} more check-ins</Text>
            )}
          </View>
        )}
      </GlassCard>

      {/* ── Notes Timeline (for Trainer and others) ────────────────── */}
      <GlassCard style={styles.sectionCard} contentStyle={styles.sectionInner}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Dumbbell size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Notes Timeline</Text>
          </View>
          <TouchableOpacity
            style={styles.addNoteSmallBtn}
            onPress={openCreateNoteModal}
            accessibilityRole="button"
            accessibilityLabel="Add Note"
          >
            <Plus size={14} color={theme.colors.textOnPrimary} />
            <Text style={styles.addNoteSmallBtnText}>Add Note</Text>
          </TouchableOpacity>
        </View>

        {isLoadingNotes ? (
          <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
        ) : memberNotes.length === 0 ? (
          <Text style={styles.emptyAttendanceText}>No notes recorded yet for this member.</Text>
        ) : (
          <View style={styles.notesTimelineWrap}>
            {memberNotes.map((note) => {
              const canEdit = isTrainer ? note.trainerId === userId : true;
              let dateStr = '';
              try {
                dateStr = format(parseISO(note.createdAt), 'dd MMM yyyy, hh:mm a');
              } catch {}
              return (
                <View key={note.id} style={styles.timelineNoteItem}>
                  <View style={styles.timelineNoteHeader}>
                    <Badge label={note.type} variant="neutral" size="sm" />
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.noteDateText}>{dateStr}</Text>
                      {canEdit && (
                        <TouchableOpacity
                          onPress={() => openEditNoteModal(note)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ marginLeft: 8 }}
                          accessibilityLabel="Edit note"
                        >
                          <Edit2 size={14} color={theme.colors.primary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <Text style={styles.noteText}>{note.text}</Text>
                  {(typeof note.weightKg === 'number' || note.bodyMeasurements) && (
                    <View style={styles.noteMetricsRow}>
                      {typeof note.weightKg === 'number' && (
                        <Text style={styles.noteMetricPill}>Weight: {note.weightKg} kg</Text>
                      )}
                      {note.bodyMeasurements &&
                        Object.entries(note.bodyMeasurements).map(([k, v]) => (
                          <Text key={k} style={styles.noteMetricPill}>
                            {k.charAt(0).toUpperCase() + k.slice(1)}: {String(v)}
                          </Text>
                        ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </GlassCard>

      {/* ── Assigned Trainer Card (OWNER Only) ────────────────────── */}
      {isOwner && (
        <GlassCard style={styles.sectionCard} contentStyle={styles.sectionInner}>
          <View style={styles.trainerHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Dumbbell size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Assigned Trainer</Text>
            </View>
            <Badge
              label={activeAssignment ? 'Assigned' : 'None'}
              variant={activeAssignment ? 'success' : 'neutral'}
              size="sm"
            />
          </View>

          {activeAssignment ? (
            <View style={styles.trainerBox}>
              <View style={styles.trainerInfoRow}>
                <Avatar name={activeAssignment.trainerName || 'Trainer'} size="sm" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.trainerNameText}>
                    {activeAssignment.trainerName || 'Trainer'}
                  </Text>
                  {activeAssignment.startDate ? (
                    <Text style={styles.trainerSubText}>
                      Since {format(parseISO(activeAssignment.startDate), 'dd MMM yyyy')}
                    </Text>
                  ) : null}
                  {activeAssignment.ptFeePaise ? (
                    <Text style={styles.trainerSubText}>
                      PT Fee: ₹{activeAssignment.ptFeePaise / 100}
                      {activeAssignment.sessionsTotal
                        ? ` · ${activeAssignment.sessionsTotal} sessions`
                        : ''}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.trainerActionButtonsRow}>
                <TouchableOpacity
                  style={styles.trainerChangeBtn}
                  onPress={() => setTrainerPickerVisible(true)}
                  accessibilityRole="button"
                  disabled={endAssignmentMutation.isPending || assignMemberMutation.isPending}
                >
                  <ArrowRightLeft size={14} color={theme.colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.trainerChangeBtnText}>Change Trainer</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.trainerUnassignBtn}
                  onPress={handleUnassignTrainer}
                  accessibilityRole="button"
                  disabled={endAssignmentMutation.isPending || assignMemberMutation.isPending}
                >
                  <UserX size={14} color={theme.colors.error} style={{ marginRight: 4 }} />
                  <Text style={styles.trainerUnassignBtnText}>Unassign</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.trainerEmptyBox}>
              <Text style={styles.trainerEmptyText}>No trainer currently assigned.</Text>
              <TouchableOpacity
                style={styles.assignTrainerBtn}
                onPress={() => setTrainerPickerVisible(true)}
                accessibilityRole="button"
                disabled={assignMemberMutation.isPending}
              >
                <Text style={styles.assignTrainerBtnText}>Assign Trainer</Text>
              </TouchableOpacity>
            </View>
          )}
        </GlassCard>
      )}

      {/* ── History Menu (OWNER and STAFF only, hidden for TRAINER) ─ */}
      {!isTrainer && (
        <GlassCard style={styles.sectionCard} contentStyle={styles.sectionInner}>
          <Text style={styles.sectionTitle}>History</Text>
          <TouchableOpacity style={styles.menuItem} accessibilityRole="button">
            <CalendarDays color={theme.colors.primary} size={22} />
            <Text style={styles.menuText}>Attendance Record</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} accessibilityRole="button">
            <CreditCard color={theme.colors.primary} size={22} />
            <Text style={styles.menuText}>Payment History</Text>
          </TouchableOpacity>
        </GlassCard>
      )}

      <View style={{ height: 40 }} />

      {/* ── QR Modal ──────────────────────────────────────────────── */}
      <Modal visible={showQRModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.qrModalCard} contentStyle={styles.qrModalContent}>
            <TouchableOpacity
              style={styles.closeQRBtn}
              onPress={() => setShowQRModal(false)}
              accessibilityLabel="Close"
            >
              <X color={theme.colors.textMuted} size={22} />
            </TouchableOpacity>

            <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }} style={styles.qrCard}>
              <Text style={styles.qrGymName}>Gymholik Fitness</Text>
              <View style={styles.qrWrapper}>
                <QRCode
                  value={member.memberCode}
                  size={190}
                  color="#051F20"
                  backgroundColor="#DAF1DE"
                />
              </View>
              <Text style={styles.qrMemberName}>{member.name}</Text>
              <Text style={styles.qrCodeText}>{member.memberCode}</Text>
            </ViewShot>

            <View style={{ marginTop: theme.spacing.lg }}>
              <Button
                title="Share on WhatsApp"
                icon={<Share2 color={theme.colors.textOnPrimary} size={18} />}
                onPress={handleShareQR}
                size="md"
              />
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* ── Trainer Picker Modal ──────────────────────────────────── */}
      <Modal
        visible={trainerPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTrainerPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {activeAssignment ? 'Change Trainer' : 'Select Trainer'}
              </Text>
              <TouchableOpacity
                onPress={() => setTrainerPickerVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320, marginVertical: 8 }}>
              {activeTrainers && activeTrainers.length > 0 ? (
                activeTrainers.map((t) => {
                  const isCurrent = activeAssignment?.trainerId === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.trainerPickerItem,
                        isCurrent && styles.trainerPickerItemActive,
                      ]}
                      onPress={() => handleSelectTrainer(t)}
                      disabled={
                        isCurrent ||
                        assignMemberMutation.isPending ||
                        endAssignmentMutation.isPending
                      }
                    >
                      <Avatar name={t.name} size="sm" />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.trainerPickerName}>{t.name}</Text>
                        {t.trainerTypes && t.trainerTypes.length > 0 ? (
                          <Text style={styles.trainerPickerTypes}>
                            {t.trainerTypes.map((type) => type.name).join(', ')}
                          </Text>
                        ) : null}
                      </View>
                      {isCurrent && (
                        <Badge label="Current" variant="neutral" size="sm" />
                      )}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.noTrainersText}>No active trainers found.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Add / Edit Note Modal ──────────────────────────────────── */}
      <Modal visible={noteModalVisible} transparent animationType="slide" onRequestClose={() => setNoteModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.noteModalSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {editingNote ? 'Edit Note' : 'Add Note'}
              </Text>
              <TouchableOpacity
                onPress={() => setNoteModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalInputLabel}>Note Type *</Text>
              <View style={styles.noteTypeSelectorRow}>
                {(['WORKOUT', 'DIET', 'PROGRESS', 'GENERAL'] as NoteType[]).map((t) => {
                  const isSelected = noteType === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.noteTypeChip, isSelected && styles.noteTypeChipSelected]}
                      onPress={() => setNoteType(t)}
                    >
                      <Text
                        style={[
                          styles.noteTypeChipText,
                          isSelected && styles.noteTypeChipTextSelected,
                        ]}
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.modalInputLabel}>Note Content *</Text>
              <TextInput
                style={styles.noteTextArea}
                placeholder="Enter workout instructions, diet notes or progress notes..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={4}
                value={noteText}
                onChangeText={setNoteText}
                textAlignVertical="top"
              />

              <Text style={[styles.modalInputLabel, { marginTop: 12 }]}>Weight (kg) — optional</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="e.g. 72.5"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                value={noteWeight}
                onChangeText={setNoteWeight}
              />

              <Text style={[styles.modalInputLabel, { marginTop: 12 }]}>Body Measurements (optional)</Text>
              <View style={styles.measurementsGrid}>
                <View style={styles.measurementItem}>
                  <Text style={styles.measurementSubLabel}>Chest (in)</Text>
                  <TextInput
                    style={styles.noteInput}
                    placeholder="38"
                    placeholderTextColor={theme.colors.textMuted}
                    value={noteChest}
                    onChangeText={setNoteChest}
                  />
                </View>
                <View style={styles.measurementItem}>
                  <Text style={styles.measurementSubLabel}>Waist (in)</Text>
                  <TextInput
                    style={styles.noteInput}
                    placeholder="32"
                    placeholderTextColor={theme.colors.textMuted}
                    value={noteWaist}
                    onChangeText={setNoteWaist}
                  />
                </View>
                <View style={styles.measurementItem}>
                  <Text style={styles.measurementSubLabel}>Hips (in)</Text>
                  <TextInput
                    style={styles.noteInput}
                    placeholder="36"
                    placeholderTextColor={theme.colors.textMuted}
                    value={noteHips}
                    onChangeText={setNoteHips}
                  />
                </View>
                <View style={styles.measurementItem}>
                  <Text style={styles.measurementSubLabel}>Arms (in)</Text>
                  <TextInput
                    style={styles.noteInput}
                    placeholder="14"
                    placeholderTextColor={theme.colors.textMuted}
                    value={noteArms}
                    onChangeText={setNoteArms}
                  />
                </View>
              </View>

              <View style={{ marginTop: 20, marginBottom: 16 }}>
                <Button
                  title={editingNote ? 'Update Note' : 'Save Note'}
                  onPress={handleSaveNote}
                  loading={createNoteMutation.isPending || updateNoteMutation.isPending}
                  disabled={!noteText.trim()}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

function DaysLeftProgressRing({
  startDate,
  expiryDate,
}: {
  startDate: string;
  expiryDate: string;
}) {
  const size = 80;
  const strokeWidth = 6.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let daysRemaining = 0;
  let totalDays = 30;
  try {
    const start = parseISO(startDate);
    const expiry = parseISO(expiryDate);
    totalDays = Math.max(1, differenceInDays(expiry, start));
    daysRemaining = Math.max(0, differenceInDays(expiry, new Date()));
  } catch {}

  const progress = Math.min(1, Math.max(0, daysRemaining / totalDays));
  const strokeDashoffset = circumference - progress * circumference;

  const color =
    daysRemaining === 0
      ? theme.colors.error
      : daysRemaining <= 5
      ? theme.colors.warning
      : theme.colors.primary;

  return (
    <View style={styles.daysRingWrapper}>
      <Svg width={size} height={size}>
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(218, 241, 222, 0.12)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.daysRingCenter}>
          <Text style={[styles.daysRingNumber, { color }]}>
            {daysRemaining}
          </Text>
          <Text style={styles.daysRingLabel}>
            {daysRemaining === 0 ? 'EXPIRED' : daysRemaining === 1 ? 'DAY' : 'DAYS'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function getMembershipStatus(currentMembership: any): {
  badgeVariant: BadgeVariant;
  avatarStatus: AvatarStatus;
  text: string;
} {
  if (!currentMembership) return { badgeVariant: 'error', avatarStatus: 'expired', text: 'No Plan' };
  if (currentMembership.status === 'EXPIRED') return { badgeVariant: 'error', avatarStatus: 'expired', text: 'Expired' };
  try {
    const expiry = parseISO(currentMembership.expiryDate);
    const daysLeft = differenceInDays(expiry, new Date());
    if (daysLeft <= 5) return { badgeVariant: 'warning', avatarStatus: 'expiring', text: daysLeft <= 0 ? 'Expiring today' : `Exp in ${daysLeft}d` };
  } catch {}
  return { badgeVariant: 'success', avatarStatus: 'active', text: 'Active' };
}

const styles = StyleSheet.create({
  daysRingWrapper: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysRingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysRingNumber: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 20,
    lineHeight: 24,
  },
  daysRingLabel: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 9,
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  planHeaderInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
    gap: 4,
  },
  planDatesSubtext: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  headerCard: {
    marginBottom: theme.spacing.md,
  },
  headerInner: {
    padding: theme.spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  name: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  memberCode: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    minHeight: 32,
  },
  phone: {
    ...theme.typography.body,
    color: theme.colors.primary,
    marginLeft: 6,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  actionBtn: {
    alignItems: 'center',
    minWidth: 64,
    minHeight: 52, // 44px+ tap target
    justifyContent: 'center',
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginBottom: 4,
  },
  actionText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    fontWeight: '600',
  },
  sectionCard: {
    marginBottom: theme.spacing.md,
  },
  sectionInner: {
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.h3,
    marginBottom: theme.spacing.md,
  },
  planCard: {
    backgroundColor: theme.colors.raised,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  planName: {
    ...theme.typography.h3,
    color: theme.colors.primary,
    marginBottom: theme.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailBox: {
    flex: 1,
  },
  detailLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: theme.spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
  },
  noMembershipText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52, // 44px+ tap target
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  menuText: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginLeft: theme.spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  qrModalCard: {
    width: '100%',
    maxWidth: 360,
  },
  qrModalContent: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  closeQRBtn: {
    alignSelf: 'flex-end',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    width: '100%',
  },
  qrGymName: {
    ...theme.typography.h3,
    color: theme.colors.primary,
    marginBottom: theme.spacing.md,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: theme.colors.text,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
  },
  qrMemberName: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  qrCodeText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
    letterSpacing: 2,
  },
  trainerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  trainerBox: {
    backgroundColor: theme.colors.raised,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  trainerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trainerNameText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    fontSize: 16,
  },
  trainerSubText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  trainerActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    gap: 12,
  },
  trainerChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
  },
  trainerChangeBtnText: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingMedium,
  },
  trainerUnassignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
  },
  trainerUnassignBtnText: {
    ...theme.typography.small,
    color: theme.colors.error,
    fontFamily: theme.fonts.headingMedium,
  },
  trainerEmptyBox: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  trainerEmptyText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  assignTrainerBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
  },
  assignTrainerBtnText: {
    ...theme.typography.button,
    color: theme.colors.textOnPrimary,
    fontSize: 13,
  },
  pickerModalContent: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  pickerTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  trainerPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.raised,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  trainerPickerItemActive: {
    borderColor: theme.colors.primary,
  },
  trainerPickerName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  trainerPickerTypes: {
    ...theme.typography.small,
    color: theme.colors.primary,
    marginTop: 2,
  },
  noTrainersText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addNoteSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
  },
  addNoteSmallBtnText: {
    ...theme.typography.small,
    color: theme.colors.textOnPrimary,
    marginLeft: 4,
    fontFamily: theme.fonts.bodySemiBold,
  },
  emptyAttendanceText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginVertical: 6,
  },
  attendanceHistoryList: {
    marginTop: 4,
  },
  attendanceItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.06)',
  },
  attendanceDateText: {
    ...theme.typography.body,
    fontSize: 13,
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyMedium,
  },
  attendanceTimeText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  moreAttendanceText: {
    ...theme.typography.caption,
    color: theme.colors.primaryLight,
    textAlign: 'center',
    marginTop: 8,
  },
  notesTimelineWrap: {
    marginTop: 6,
  },
  timelineNoteItem: {
    backgroundColor: theme.colors.raised,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  timelineNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  noteDateText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
  },
  noteText: {
    ...theme.typography.body,
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 18,
  },
  noteMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  noteMetricPill: {
    ...theme.typography.small,
    color: theme.colors.primaryLight,
    backgroundColor: 'rgba(142, 182, 155, 0.1)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: theme.radius.xs,
  },
  noteModalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    maxHeight: '85%',
  },
  modalInputLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  noteTypeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  noteTypeChip: {
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
  },
  noteTypeChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  noteTypeChipText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
  },
  noteTypeChipTextSelected: {
    color: theme.colors.textOnPrimary,
    fontFamily: theme.fonts.bodySemiBold,
  },
  noteTextArea: {
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 14,
    minHeight: 84,
  },
  noteInput: {
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    height: 40,
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
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
    ...theme.typography.small,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
});
