import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { X, Search, CheckCircle, CreditCard, Banknote, Smartphone } from 'lucide-react-native';
import { theme } from '../theme/theme';
import { Button } from './Button';
import { useMember, useMembers, Member } from '../api/members';
import { useCollectPayment, downloadAndShareReceipt } from '../api/payments';
import { formatMoney } from '../utils/formatters';

export interface CollectPaymentModalProps {
  visible: boolean;
  memberId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CollectPaymentModal: React.FC<CollectPaymentModalProps> = ({
  visible,
  memberId: initialMemberId,
  onClose,
  onSuccess,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>(
    initialMemberId
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [mode, setMode] = useState<'CASH' | 'UPI' | 'CARD'>('UPI');
  const [notes, setNotes] = useState('');
  const [successData, setSuccessData] = useState<{ id: string; receiptNumber: string } | null>(
    null
  );

  const { data: member } = useMember(selectedMemberId || '');
  const { data: searchResultsData } = useMembers({
    term: searchQuery,
    status: 'ALL',
  });
  const collectPayment = useCollectPayment();

  const membersList = searchResultsData?.pages.flatMap((p) => p.content) || [];

  // Handle Esc key to close modal
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  // Reset or initialize state
  useEffect(() => {
    if (visible) {
      setSelectedMemberId(initialMemberId);
      setSuccessData(null);
      setNotes('');
      setAmountStr('');
      setSearchQuery('');
    }
  }, [visible, initialMemberId]);

  // Autofill amount from member's due
  useEffect(() => {
    if (member?.currentMembership && member.currentMembership.duePaise > 0) {
      setAmountStr((member.currentMembership.duePaise / 100).toString());
    }
  }, [member]);

  const dueAmount = member?.currentMembership?.duePaise || 0;
  const inputAmount = parseInt(amountStr || '0', 10) * 100;

  const handleSubmit = async () => {
    if (!selectedMemberId) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please select a member' });
      return;
    }
    if (inputAmount <= 0) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Amount must be greater than zero' });
      return;
    }
    if (inputAmount > dueAmount) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: `Amount exceeds outstanding dues (${formatMoney(dueAmount)})`,
      });
      return;
    }

    try {
      const res = await collectPayment.mutateAsync({
        memberId: selectedMemberId,
        membershipId: member?.currentMembership?.id,
        amount: inputAmount,
        amountPaise: inputAmount,
        mode,
        notes: notes || undefined,
      });

      const receiptNumber = res?.receiptNo || res?.receiptNumber || 'Receipt';
      setSuccessData({ id: res.id, receiptNumber });
      onSuccess?.();
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: e.response?.data?.message || 'Failed to collect payment',
      });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Collect Fee</Text>
              <Text style={styles.modalSubtitle}>Record member payment and generate receipt</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close modal"
              {...({ tabIndex: 0 } as any)}
            >
              <X size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Success View */}
          {successData ? (
            <View style={styles.successView}>
              <View style={styles.successIconCircle}>
                <CheckCircle size={48} color={theme.colors.primary} />
              </View>
              <Text style={styles.successTitle}>Payment Recorded!</Text>
              <Text style={styles.successReceipt}>Receipt: {successData.receiptNumber}</Text>
              <Text style={styles.successAmount}>{formatMoney(inputAmount)} received via {mode}</Text>

              <View style={styles.successButtonsRow}>
                <Button
                  title="Download Receipt"
                  variant="primary"
                  size="md"
                  onPress={() => downloadAndShareReceipt(successData.id, successData.receiptNumber)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Done"
                  variant="secondary"
                  size="md"
                  onPress={onClose}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : (
            <>
              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
              >
                {/* ── Member Selection ─────────────────────────────── */}
                {!selectedMemberId ? (
                  <View style={styles.memberPickerSection}>
                    <Text style={styles.label}>Select Member *</Text>
                    <View style={styles.searchRow}>
                      <Search size={18} color={theme.colors.primary} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search member by name or mobile..."
                        placeholderTextColor={theme.colors.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoFocus
                      />
                    </View>

                    <View style={styles.membersListContainer}>
                      {membersList.slice(0, 5).map((m: Member) => (
                        <TouchableOpacity
                          key={m.id}
                          style={styles.memberSelectItem}
                          onPress={() => setSelectedMemberId(m.id)}
                        >
                          <View>
                            <Text style={styles.memberName}>{m.name}</Text>
                            <Text style={styles.memberPhone}>{m.phone}</Text>
                          </View>
                          {((m as any).dueTotalPaise ?? m.currentMembership?.duePaise ?? 0) > 0 ? (
                            <Text
                              style={[
                                styles.memberDueText,
                                { color: theme.colors.coral },
                              ]}
                            >
                              Due: {formatMoney((m as any).dueTotalPaise ?? m.currentMembership?.duePaise)}
                            </Text>
                          ) : (
                            <Text style={[styles.memberDueText, { color: theme.colors.textMuted }]}>
                              No due
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.selectedMemberCard}>
                    <View style={styles.selectedMemberLeft}>
                      <Text style={styles.selectedMemberName}>{member?.name || 'Selected Member'}</Text>
                      <Text style={styles.selectedMemberPhone}>{member?.phone}</Text>
                      <Text style={styles.selectedMemberPlan}>
                        Plan: {member?.currentMembership?.planName || 'Active Membership'}
                      </Text>
                    </View>
                    <View style={styles.selectedMemberRight}>
                      <Text style={styles.dueLabel}>Outstanding Due</Text>
                      <Text style={styles.dueValue}>{formatMoney(dueAmount)}</Text>
                      {!initialMemberId && (
                        <TouchableOpacity
                          onPress={() => setSelectedMemberId(undefined)}
                          style={styles.changeMemberBtn}
                        >
                          <Text style={styles.changeMemberText}>Change</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {/* ── Amount Input ─────────────────────────────────── */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Amount to Collect (₹) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={`e.g. ${dueAmount / 100 || 1000}`}
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="numeric"
                    value={amountStr}
                    onChangeText={setAmountStr}
                    onSubmitEditing={handleSubmit}
                    autoFocus={Boolean(selectedMemberId)}
                  />
                  {dueAmount > 0 && (
                    <Text style={styles.helperText}>Max payable due: {formatMoney(dueAmount)}</Text>
                  )}
                </View>

                {/* ── Payment Mode ─────────────────────────────────── */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Payment Mode *</Text>
                  <View style={styles.modeRow}>
                    {(['UPI', 'CASH', 'CARD'] as const).map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                        onPress={() => setMode(m)}
                      >
                        {m === 'UPI' && (
                          <Smartphone
                            size={16}
                            color={mode === m ? '#DAF1DE' : 'rgba(218, 241, 222, 0.6)'}
                          />
                        )}
                        {m === 'CASH' && (
                          <Banknote
                            size={16}
                            color={mode === m ? '#DAF1DE' : 'rgba(218, 241, 222, 0.6)'}
                          />
                        )}
                        {m === 'CARD' && (
                          <CreditCard
                            size={16}
                            color={mode === m ? '#DAF1DE' : 'rgba(218, 241, 222, 0.6)'}
                          />
                        )}
                        <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                          {m}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* ── Notes ────────────────────────────────────────── */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Notes (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Monthly installment paid via GPay"
                    placeholderTextColor={theme.colors.textMuted}
                    value={notes}
                    onChangeText={setNotes}
                    onSubmitEditing={handleSubmit}
                  />
                </View>
              </ScrollView>

              {/* Footer */}
              <View style={styles.modalFooter}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  size="md"
                  onPress={onClose}
                  style={{ flex: 1 }}
                />
                <Button
                  title={`Collect ${inputAmount > 0 ? formatMoney(inputAmount) : 'Payment'}`}
                  variant="primary"
                  size="md"
                  loading={collectPayment.isPending}
                  onPress={handleSubmit}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: '#072728',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.16)',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7)',
        } as any)
      : {}),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.08)',
  },
  modalTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
    color: '#DAF1DE',
  },
  modalSubtitle: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(218, 241, 222, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formScroll: {
    flexGrow: 0,
  },
  formContent: {
    padding: 24,
    gap: 16,
  },
  memberPickerSection: {
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(11, 43, 38, 0.8)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.14)',
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 14,
    color: '#DAF1DE',
  },
  membersListContainer: {
    backgroundColor: 'rgba(11, 43, 38, 0.6)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.08)',
    overflow: 'hidden',
    marginTop: 4,
  },
  memberSelectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.06)',
  },
  memberName: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 14,
    color: '#DAF1DE',
  },
  memberPhone: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  memberDueText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 13,
    color: '#DAF1DE',
  },
  selectedMemberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(11, 43, 38, 0.9)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(142, 182, 155, 0.25)',
  },
  selectedMemberLeft: {
    flex: 1,
  },
  selectedMemberName: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 16,
    color: '#DAF1DE',
  },
  selectedMemberPhone: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  selectedMemberPlan: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.primary,
    marginTop: 4,
  },
  selectedMemberRight: {
    alignItems: 'flex-end',
  },
  dueLabel: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  dueValue: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
    color: theme.colors.error,
    marginTop: 2,
  },
  changeMemberBtn: {
    marginTop: 6,
  },
  changeMemberText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 13,
    color: '#DAF1DE',
  },
  input: {
    backgroundColor: 'rgba(11, 43, 38, 0.8)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.14)',
    color: '#DAF1DE',
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  helperText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 11,
    color: theme.colors.primary,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.14)',
    backgroundColor: 'rgba(11, 43, 38, 0.6)',
  },
  modeBtnActive: {
    backgroundColor: 'rgba(142, 182, 155, 0.22)',
    borderColor: theme.colors.primary,
  },
  modeBtnText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    color: 'rgba(218, 241, 222, 0.65)',
  },
  modeBtnTextActive: {
    color: '#DAF1DE',
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(218, 241, 222, 0.08)',
    backgroundColor: '#072728',
  },
  successView: {
    padding: 32,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(142, 182, 155, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 20,
    color: '#DAF1DE',
    marginBottom: 4,
  },
  successReceipt: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  successAmount: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 16,
    color: theme.colors.primary,
    marginBottom: 24,
  },
  successButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
});
