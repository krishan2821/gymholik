import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle, Search, X } from 'lucide-react-native';
import { theme } from '../../../src/theme/theme';
import { useMember, useMembers } from '../../../src/api/members';
import { useCollectPayment, downloadAndShareReceipt } from '../../../src/api/payments';
import { Screen } from '../../../src/components/Screen';
import { GlassCard } from '../../../src/components/GlassCard';
import { Button } from '../../../src/components/Button';
import { Avatar } from '../../../src/components/Avatar';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { ErrorState } from '../../../src/components/ErrorState';
import { COLLECT, ERRORS, COMMON, FIELDS } from '../../../src/constants/strings';

export default function CollectPaymentScreen() {
  const { memberId: initialMemberId } = useLocalSearchParams<{ memberId?: string }>();
  const router = useRouter();
  const { role } = useAuthStore();

  if (role !== 'OWNER') {
    return (
      <Screen style={styles.center}>
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  const [memberId, setMemberId] = useState<string | undefined>(initialMemberId);
  const [showPicker, setShowPicker] = useState(!initialMemberId);

  const { data: member } = useMember(memberId || '');
  const collectPayment = useCollectPayment();

  const [amountStr, setAmountStr] = useState('');
  const [mode, setMode] = useState<'CASH' | 'UPI' | 'CARD'>('UPI');
  const [notes, setNotes] = useState('');
  const [successData, setSuccessData] = useState<{ id: string; receiptNumber: string } | null>(
    null
  );

  // Auto-fill amount if member is loaded and has dues
  useEffect(() => {
    if (member?.currentMembership && member.currentMembership.duePaise > 0) {
      setAmountStr((member.currentMembership.duePaise / 100).toString());
    }
  }, [member]);

  const dueAmount = member?.currentMembership?.duePaise || 0;
  const inputAmount = parseInt(amountStr || '0') * 100;

  const handleSubmit = async () => {
    if (!memberId) {
      Alert.alert('Error', ERRORS.SELECT_MEMBER);
      return;
    }
    if (inputAmount <= 0) {
      Alert.alert('Error', ERRORS.AMOUNT_ZERO);
      return;
    }
    if (inputAmount > dueAmount) {
      Alert.alert('Error', ERRORS.AMOUNT_EXCEEDS_DUE);
      return;
    }

    try {
      const res = await collectPayment.mutateAsync({
        memberId,
        amount: inputAmount,
        mode,
        notes: notes || undefined,
      });

      setSuccessData({ id: res.id, receiptNumber: res.receiptNumber });
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || ERRORS.GENERIC);
    }
  };

  if (successData) {
    return (
      <Screen style={styles.successScreen}>
        <View style={styles.successIconCircle}>
          <CheckCircle color={theme.colors.primary} size={64} />
        </View>
        <Text style={styles.successTitle}>{COLLECT.SUCCESS_TITLE}</Text>
        <Text style={styles.receiptText}>{COLLECT.RECEIPT_NO(successData.receiptNumber)}</Text>

        <View style={styles.successBtnContainer}>
          <Button
            title={COLLECT.SHARE_RECEIPT}
            onPress={() => downloadAndShareReceipt(successData.id, successData.receiptNumber)}
            size="md"
          />
          <View style={{ height: 12 }} />
          <Button
            title={COMMON.DONE}
            variant="secondary"
            onPress={() => router.back()}
            size="md"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable keyboardAvoiding contentContainerStyle={styles.scroll}>
      {/* ── Member Selection ───────────────────────────────────────── */}
      <GlassCard style={styles.card} contentStyle={styles.cardContent}>
        <Text style={styles.sectionTitle}>Member Details</Text>

        {member ? (
          <TouchableOpacity
            style={styles.memberBox}
            onPress={() => setShowPicker(true)}
            accessibilityRole="button"
          >
            <Avatar name={member.name} photoUrl={member.photoUrl} size="md" />
            <View style={styles.memberDetails}>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.memberPhone}>{member.phone}</Text>
            </View>
            <Text style={styles.changeText}>Change</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.selectMemberBtn}
            onPress={() => setShowPicker(true)}
            accessibilityRole="button"
          >
            <Search color={theme.colors.primary} size={20} />
            <Text style={styles.selectMemberText}>Search Member</Text>
          </TouchableOpacity>
        )}

        {member && member.currentMembership && (
          <View style={styles.dueSummary}>
            <View style={styles.dueRow}>
              <Text style={styles.dueLabel}>Plan Total:</Text>
              <Text style={styles.dueValue}>₹{member.currentMembership.totalPaise / 100}</Text>
            </View>
            <View style={styles.dueRow}>
              <Text style={styles.dueLabel}>Already Paid:</Text>
              <Text style={styles.dueValue}>₹{member.currentMembership.paidPaise / 100}</Text>
            </View>
            <View style={[styles.dueRow, styles.dueRowHighlight]}>
              <Text style={styles.dueLabelHighlight}>Remaining Due:</Text>
              <Text style={styles.dueValueHighlight}>₹{dueAmount / 100}</Text>
            </View>
          </View>
        )}
      </GlassCard>

      {/* ── Payment Details ───────────────────────────────────────── */}
      {member && (
        <GlassCard style={styles.card} contentStyle={styles.cardContent}>
          <Text style={styles.sectionTitle}>Payment Details</Text>

          <Text style={styles.label}>{FIELDS.AMOUNT_PAID}</Text>
          <View style={styles.amountInputContainer}>
            <TextInput
              style={styles.amountInput}
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={theme.colors.textMuted}
            />
            {dueAmount > 0 && inputAmount !== dueAmount && (
              <TouchableOpacity
                style={styles.payFullBtn}
                onPress={() => setAmountStr((dueAmount / 100).toString())}
                accessibilityRole="button"
              >
                <Text style={styles.payFullText}>Pay Full</Text>
              </TouchableOpacity>
            )}
          </View>
          {inputAmount > dueAmount && (
            <Text style={styles.errorText}>Amount exceeds due (₹{dueAmount / 100})</Text>
          )}

          <Text style={[styles.label, { marginTop: 14 }]}>{FIELDS.PAYMENT_MODE}</Text>
          <View style={styles.modeRow}>
            {(['CASH', 'UPI', 'CARD'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, mode === m && styles.modeBtnSelected]}
                onPress={() => setMode(m)}
                accessibilityRole="button"
              >
                <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextSelected]}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 14 }]}>{FIELDS.NOTES}</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. partial payment"
            placeholderTextColor={theme.colors.textMuted}
          />
        </GlassCard>
      )}

      {member && (
        <View style={styles.submitContainer}>
          <Button
            title={COLLECT.SUBMIT}
            onPress={handleSubmit}
            loading={collectPayment.isPending}
            disabled={inputAmount <= 0 || inputAmount > dueAmount}
            size="md"
          />
        </View>
      )}

      {/* ── Member Search Modal ────────────────────────────────────── */}
      <MemberPickerModal
        visible={showPicker}
        onClose={() => {
          if (!memberId) router.back();
          else setShowPicker(false);
        }}
        onSelect={(id: string) => {
          setMemberId(id);
          setShowPicker(false);
        }}
      />
    </Screen>
  );
}

// Inline component for picking member
const MemberPickerModal = ({ visible, onClose, onSelect }: any) => {
  const [term, setTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term), 400);
    return () => clearTimeout(timer);
  }, [term]);

  const { data, isLoading } = useMembers({ term: debouncedTerm, status: 'DUE' });
  const members = data?.pages.flatMap((p) => p.content) || [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Member</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
            <X color={theme.colors.text} size={22} />
          </TouchableOpacity>
        </View>
        <View style={styles.searchBox}>
          <Search color={theme.colors.primary} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder={COLLECT.SELECT_MEMBER_PLACEHOLDER}
            placeholderTextColor={theme.colors.textMuted}
            value={term}
            onChangeText={setTerm}
          />
        </View>

        {isLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.pickerList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.pickerItem}
                onPress={() => onSelect(item.id)}
                accessibilityRole="button"
              >
                <Avatar name={item.name} photoUrl={item.photoUrl} size="sm" />
                <View style={styles.pickerInfo}>
                  <Text style={styles.pickerItemName}>{item.name}</Text>
                  <Text style={styles.pickerItemPhone}>{item.phone}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptySearchText}>No members with due found</Text>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  card: {
    marginBottom: theme.spacing.md,
  },
  cardContent: {
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.h3,
    marginBottom: theme.spacing.md,
  },
  memberBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.raised,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 64, // 44px+ tap target
  },
  memberDetails: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  memberName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  memberPhone: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  changeText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingBold,
    fontWeight: '700',
  },
  selectMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.raised,
    paddingHorizontal: 16,
    minHeight: 52, // 44px+ tap target
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectMemberText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.md,
  },
  dueSummary: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.raised,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  dueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dueLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  dueValue: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  dueRowHighlight: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: 6,
    marginTop: 4,
    marginBottom: 0,
  },
  dueLabelHighlight: {
    ...theme.typography.bodyMedium,
    color: theme.colors.error,
    fontWeight: '700',
  },
  dueValueHighlight: {
    ...theme.typography.h3,
    color: theme.colors.error,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.raised,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    minHeight: 54, // 44px+ tap target
  },
  amountInput: {
    flex: 1,
    fontFamily: theme.fonts.headingBold,
    fontSize: 20,
    color: theme.colors.text,
    paddingVertical: 10,
  },
  payFullBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  payFullText: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingBold,
  },
  errorText: {
    ...theme.typography.small,
    color: theme.colors.error,
    marginTop: 4,
    marginLeft: 4,
  },
  modeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  modeBtn: {
    flex: 1,
    minHeight: 44, // 44px tap target
    backgroundColor: theme.colors.raised,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  modeBtnText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 14,
    color: theme.colors.text,
  },
  modeBtnTextSelected: {
    color: theme.colors.textOnPrimary, // #051F20 contrast
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: theme.colors.raised,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    minHeight: 48,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 15,
    color: theme.colors.text,
  },
  submitContainer: {
    marginTop: theme.spacing.md,
  },
  successScreen: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  successIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(142, 182, 155, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(142, 182, 155, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  successTitle: {
    ...theme.typography.h1,
    marginBottom: 4,
    textAlign: 'center',
  },
  receiptText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xxl,
    textAlign: 'center',
  },
  successBtnContainer: {
    width: '100%',
    maxWidth: 320,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  modalTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.raised,
    margin: theme.spacing.md,
    paddingHorizontal: 16,
    minHeight: 48,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 15,
    color: theme.colors.text,
  },
  pickerList: {
    paddingHorizontal: theme.spacing.md,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 56, // 44px+ tap target
  },
  pickerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  pickerItemName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  pickerItemPhone: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  emptySearchText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
});
