import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { X, Receipt, Share2, User, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react-native';
import { theme } from '../theme/theme';
import { GlassCard } from './GlassCard';
import { Button } from './Button';
import { Badge } from './Badge';
import { formatMoney, formatDate, formatTime } from '../utils/formatters';
import {
  usePaymentDetail,
  useReversePayment,
  downloadAndShareReceipt,
  ReversalReasonCode,
} from '../api/payments';
import { showConfirmDialog } from './ConfirmDialog';
import Toast from 'react-native-toast-message';

interface PaymentDetailSheetProps {
  paymentId: string | null;
  isOwner: boolean;
  onClose: () => void;
  onViewMember: (memberId: string) => void;
}

export const PaymentDetailSheet: React.FC<PaymentDetailSheetProps> = ({
  paymentId,
  isOwner,
  onClose,
  onViewMember,
}) => {
  const { data: detail, isLoading, isError } = usePaymentDetail(paymentId);
  const reverseMutation = useReversePayment();

  const [showReverseSheet, setShowReverseSheet] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ReversalReasonCode>('WRONG_ENTRY');
  const [reverseNote, setReverseNote] = useState('');

  if (!paymentId) return null;

  const handleOpenReverse = () => {
    setShowReverseSheet(true);
    setSelectedReason('WRONG_ENTRY');
    setReverseNote('');
  };

  const handleConfirmReverse = async () => {
    if (reverseNote.trim().length < 5) {
      Toast.show({ type: 'error', text1: 'Note must be at least 5 characters' });
      return;
    }

    try {
      await reverseMutation.mutateAsync({
        id: paymentId,
        reasonCode: selectedReason,
        note: reverseNote.trim(),
      });
      setShowReverseSheet(false);
      onClose();
    } catch (e) {
      // Handled by onError in hook
    }
  };

  const isReversal = detail?.type === 'REVERSAL';
  const isAlreadyReversed = Boolean(detail?.reversedByPaymentId);

  return (
    <Modal
      visible={Boolean(paymentId)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Receipt size={20} color={theme.colors.primary} />
              <Text style={styles.headerTitle}>
                {isReversal ? 'Reversal Details' : 'Payment Details'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
              {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
            >
              <X size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading details...</Text>
            </View>
          ) : isError || !detail ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.errorText}>Failed to load payment details</Text>
              <Button title="Close" onPress={onClose} size="sm" variant="secondary" />
            </View>
          ) : (
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              {/* Receipt / Amount Banner */}
              <View style={styles.amountBanner}>
                <Text style={styles.receiptNo}>Receipt #{detail.receiptNo}</Text>
                <Text style={[styles.amountText, isReversal && styles.amountReversal]}>
                  {isReversal ? '-' : '+'}{formatMoney(detail.amountPaise)}
                </Text>

                <View style={styles.badgeRow}>
                  {isReversal ? (
                    <Badge label="REVERSED ENTRY" variant="error" size="sm" />
                  ) : isAlreadyReversed ? (
                    <Badge label="REVERSED" variant="error" size="sm" />
                  ) : (
                    <Badge label="SUCCESSFUL" variant="success" size="sm" />
                  )}
                  <Badge label={detail.mode} variant="info" size="sm" />
                </View>

                {isAlreadyReversed && detail.reversalReceiptNo && (
                  <View style={styles.reversalNotice}>
                    <Text style={styles.reversalNoticeText}>
                      Reversed by receipt #{detail.reversalReceiptNo}
                    </Text>
                  </View>
                )}

                {isReversal && detail.reversalOfReceiptNo && (
                  <View style={styles.reversalNotice}>
                    <Text style={styles.reversalNoticeText}>
                      Reversal of receipt #{detail.reversalOfReceiptNo}
                    </Text>
                  </View>
                )}
              </View>

              {/* Transaction Meta Details */}
              <GlassCard style={styles.card} contentStyle={styles.cardInner}>
                <Text style={styles.sectionHeader}>TRANSACTION INFO</Text>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Member</Text>
                  <Text style={styles.infoValue}>{detail.memberName} ({detail.memberCode || '—'})</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Plan & Period</Text>
                  <Text style={styles.infoValue}>{detail.planName || detail.membershipSummary?.planName || '—'}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Date & Time</Text>
                  <Text style={styles.infoValue}>
                    {detail.paidAt
                      ? `${formatDate(detail.paidAt)}, ${formatTime(detail.paidAt)}`
                      : '—'}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Reference No.</Text>
                  <Text style={styles.infoValue}>{detail.referenceNo || '—'}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Collected By</Text>
                  <Text style={styles.infoValue}>{detail.collectedByName || 'Owner'}</Text>
                </View>

                {Boolean(detail.reason || detail.note) && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Notes / Reason</Text>
                    <Text style={styles.infoValue}>{detail.note || detail.reason}</Text>
                  </View>
                )}
              </GlassCard>

              {/* Membership Summary */}
              {detail.membershipSummary && (
                <GlassCard style={styles.card} contentStyle={styles.cardInner}>
                  <Text style={styles.sectionHeader}>MEMBERSHIP SUMMARY</Text>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Plan Total</Text>
                    <Text style={styles.infoValue}>{formatMoney(detail.membershipSummary.totalPaise)}</Text>
                  </View>

                  {detail.membershipSummary.discountPaise > 0 && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Discount Applied</Text>
                      <Text style={[styles.infoValue, { color: theme.colors.warning }]}>
                        -{formatMoney(detail.membershipSummary.discountPaise)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Total Paid</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.primary }]}>
                      {formatMoney(detail.membershipSummary.paidPaise)}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Balance Due</Text>
                    <Text style={[styles.infoValue, detail.membershipSummary.duePaise > 0 ? { color: '#FF6B6B' } : {}]}>
                      {formatMoney(detail.membershipSummary.duePaise)}
                    </Text>
                  </View>
                </GlassCard>
              )}

              {/* Actions */}
              <View style={styles.actionsContainer}>
                <Button
                  title="Share Receipt"
                  icon={<Share2 size={16} color="#051F20" />}
                  variant="primary"
                  size="md"
                  onPress={() => downloadAndShareReceipt(detail.id, detail.receiptNo)}
                  style={styles.actionBtn}
                />

                <Button
                  title="View Member"
                  icon={<User size={16} color="#DAF1DE" />}
                  variant="secondary"
                  size="md"
                  onPress={() => {
                    onClose();
                    onViewMember(detail.memberId);
                  }}
                  style={styles.actionBtn}
                />

                {isOwner && !isReversal && !isAlreadyReversed && (
                  <Button
                    title="Reverse Payment"
                    icon={<RotateCcw size={16} color="#FF6B6B" />}
                    variant="ghost"
                    size="md"
                    onPress={handleOpenReverse}
                    style={[styles.actionBtn, styles.reverseBtn]}
                  />
                )}
              </View>
            </ScrollView>
          )}

          {/* Reversal Inner Sheet */}
          {showReverseSheet && (
            <View style={styles.reverseSheetOverlay}>
              <View style={styles.reverseSheetCard}>
                <View style={styles.reverseHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <AlertTriangle size={18} color={theme.colors.error} style={{ marginRight: 8 }} />
                    <Text style={styles.reverseTitle}>Reverse Payment</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowReverseSheet(false)}>
                    <X size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.reverseSubtitle}>
                  Select reason code and provide a mandatory note (min 5 chars).
                </Text>

                {/* Reason Chips */}
                <View style={styles.reasonChipsRow}>
                  {(['WRONG_ENTRY', 'DUPLICATE', 'REFUND', 'OTHER'] as ReversalReasonCode[]).map((code) => {
                    const isSelected = selectedReason === code;
                    return (
                      <TouchableOpacity
                        key={code}
                        style={[styles.reasonChip, isSelected && styles.reasonChipActive]}
                        onPress={() => setSelectedReason(code)}
                      >
                        <Text style={[styles.reasonChipText, isSelected && styles.reasonChipTextActive]}>
                          {code.replace('_', ' ')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Note Field */}
                <TextInput
                  style={styles.noteInput}
                  placeholder="Enter reason details (5-300 characters)..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={reverseNote}
                  onChangeText={setReverseNote}
                  multiline
                  maxLength={300}
                />

                <View style={styles.reverseActionRow}>
                  <Button
                    title="Cancel"
                    variant="ghost"
                    size="sm"
                    onPress={() => setShowReverseSheet(false)}
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Button
                    title="Proceed"
                    variant="primary"
                    size="sm"
                    loading={reverseMutation.isPending}
                    onPress={handleConfirmReverse}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.85)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: 'center',
    padding: Platform.OS === 'web' ? 16 : 0,
  },
  sheetContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 480 : '100%',
    maxHeight: '90%',
    backgroundColor: '#0B2B26',
    borderTopLeftRadius: Platform.OS === 'web' ? theme.radius.lg : theme.radius.xl,
    borderTopRightRadius: Platform.OS === 'web' ? theme.radius.lg : theme.radius.xl,
    borderRadius: Platform.OS === 'web' ? theme.radius.lg : undefined,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.16)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.08)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 16,
    color: theme.colors.text,
    marginLeft: 8,
  },
  closeBtn: {
    padding: 6,
    borderRadius: theme.radius.full,
  },
  loadingWrap: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 12,
  },
  errorText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 14,
    color: theme.colors.error,
    marginBottom: 16,
  },
  scroll: {
    padding: 16,
  },
  amountBanner: {
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 14,
  },
  receiptNo: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  amountText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 32,
    color: theme.colors.text,
    marginBottom: 10,
  },
  amountReversal: {
    color: '#FF6B6B',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reversalNotice: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.25)',
  },
  reversalNoticeText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: '#FF6B6B',
  },
  card: {
    marginBottom: 14,
    borderRadius: theme.radius.md,
  },
  cardInner: {
    padding: 14,
  },
  sectionHeader: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: theme.colors.textMuted,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.04)',
  },
  infoLabel: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    color: theme.colors.textMuted,
    flex: 1,
  },
  infoValue: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.text,
    flex: 1.2,
    textAlign: 'right',
  },
  actionsContainer: {
    gap: 10,
    paddingBottom: 24,
  },
  actionBtn: {
    width: '100%',
  },
  reverseBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  reverseSheetOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 31, 32, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  reverseSheetCard: {
    width: '100%',
    backgroundColor: '#163832',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.18)',
    padding: 16,
  },
  reverseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reverseTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 16,
    color: theme.colors.text,
  },
  reverseSubtitle: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 14,
  },
  reasonChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(218, 241, 222, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.12)',
  },
  reasonChipActive: {
    backgroundColor: 'rgba(255, 107, 107, 0.18)',
    borderColor: '#FF6B6B',
  },
  reasonChipText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  reasonChipTextActive: {
    color: '#FF6B6B',
    fontFamily: theme.fonts.bodyBold,
  },
  noteInput: {
    backgroundColor: 'rgba(5, 31, 32, 0.6)',
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.12)',
    padding: 10,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    color: theme.colors.text,
    minHeight: 64,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  reverseActionRow: {
    flexDirection: 'row',
  },
});
