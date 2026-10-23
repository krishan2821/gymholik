import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Animated,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CheckCircle,
  Search,
  X,
  QrCode,
  Calendar,
  AlertTriangle,
  Share2,
  Send,
  RefreshCw,
  Plus,
  Tag,
  Clock,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import { useTheme, useStyles, ThemeValue } from '../../../src/theme/ThemeContext';
import { Screen } from '../../../src/components/Screen';
import { PageHeader } from '../../../src/components/PageHeader';
import { GlassCard } from '../../../src/components/GlassCard';
import { Button } from '../../../src/components/Button';
import { Avatar } from '../../../src/components/Avatar';
import { Badge, getStatusBadgeVariant } from '../../../src/components/Badge';
import { Skeleton } from '../../../src/components/Skeleton';
import { ErrorState } from '../../../src/components/ErrorState';
import { useAuthStore } from '../../../src/store/useAuthStore';
import {
  useMember,
  useMembers,
  useMemberFees,
  useApplyDiscount,
  Member,
  MembershipFeeItem,
} from '../../../src/api/members';
import {
  useCollectPayment,
  useDues,
  usePaymentDetail,
  useMemberPaymentContext,
  downloadAndShareReceipt,
} from '../../../src/api/payments';
import { useCollectionInfo, useGymProfile } from '../../../src/api/more';
import { COLLECT, ERRORS, COMMON, FIELDS } from '../../../src/constants/strings';
import {
  formatMoney,
  formatDate,
  isPhoneMasked,
  getTodayISTDateString,
  getYesterdayISTDateString,
  getFutureISTDateString,
} from '../../../src/utils/formatters';
import { safeNotificationAsync, NotificationFeedbackType } from '../../../src/utils/safeHaptics';
import { safeOpenURL } from '../../../src/utils/safeLinking';
import { safeBack } from '../../../src/utils/navigation';

export default function CollectPaymentScreen() {
  const { colors, fonts } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{
    memberId?: string;
    membershipId?: string;
  }>();
  const rawInsets = useSafeAreaInsets();
  const insets = Platform.OS === 'web' ? { top: 0, right: 0, bottom: 0, left: 0 } : (rawInsets ?? { top: 0, right: 0, bottom: 0, left: 0 });

  const user = useAuthStore((s) => s.user);
  const role = user?.role || useAuthStore((s) => s.role);
  const isOwner = role === 'OWNER';
  const isStaff = role === 'STAFF';

  // Gym Profile (for staff phone visibility, gym name, etc.)
  const { data: gymProfile } = useGymProfile({ enabled: isOwner || isStaff });
  // Gym UPI collection info
  const { data: collectionInfo, isLoading: loadingCollectionInfo } = useCollectionInfo({
    enabled: isOwner || isStaff,
  });

  // State
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>(params.memberId);
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | undefined>(
    params.membershipId
  );
  const [showMemberPicker, setShowMemberPicker] = useState<boolean>(!params.memberId);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');

  // Dedicated member payment context (all dues and individual memberships)
  const { data: paymentContext } = useMemberPaymentContext(selectedMemberId);

  // Mode: CASH | UPI | CARD
  const [mode, setMode] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');

  // Amount typing and chips
  const [rawAmountText, setRawAmountText] = useState('');
  const [selectedChip, setSelectedChip] = useState<'full' | 'half' | 'custom'>('custom');

  // Extra inputs
  const [referenceNo, setReferenceNo] = useState('');
  const [note, setNote] = useState('');
  const [dateChip, setDateChip] = useState<'today' | 'yesterday' | 'other'>('today');
  const [customPastDate, setCustomPastDate] = useState<string>('');
  const [promiseDate, setPromiseDate] = useState<string>('');
  const [promiseDateChip, setPromiseDateChip] = useState<'7' | '15' | '30' | 'custom' | null>(
    null
  );
  const [showAllMemberships, setShowAllMemberships] = useState<boolean>(false);

  // UPI QR toggle
  const [showUpiQr, setShowUpiQr] = useState(false);

  // Discount modal state (OWNER only)
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountAmountStr, setDiscountAmountStr] = useState('');
  const [discountReason, setDiscountReason] = useState('');

  // Idempotency key per attempt & submit safety
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());
  const isSubmittingRef = useRef<boolean>(false);

  // Animation values for success check
  const checkScale = useRef(new Animated.Value(0.5)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  // Error banner state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success state
  const [successPayment, setSuccessPayment] = useState<{
    id: string;
    receiptNo: string;
    amountPaise: number;
    remainingDuePaise: number;
    memberPhone?: string;
    memberName?: string;
  } | null>(null);
  const [isSharingReceipt, setIsSharingReceipt] = useState(false);

  useEffect(() => {
    if (successPayment) {
      Animated.parallel([
        Animated.spring(checkScale, {
          toValue: 1,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(checkOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      checkScale.setValue(0.5);
      checkOpacity.setValue(0);
    }
  }, [successPayment]);

  // Fetch Member Details
  const {
    data: member,
    isLoading: loadingMember,
    refetch: refetchMember,
  } = useMember(selectedMemberId || '');

  // Fetch Member Fees (GET /api/members/{id}/fees)
  const {
    data: memberFeesData,
    isLoading: loadingFees,
    refetch: refetchFees,
  } = useMemberFees(selectedMemberId);

  // Search Members (when picker open)
  const { data: searchMembersData, isLoading: loadingSearch } = useMembers({
    term: memberSearchTerm,
    status: 'ALL',
  });

  // Collect Payment Mutation
  const collectPaymentMutation = useCollectPayment();
  // Apply Discount Mutation
  const applyDiscountMutation = useApplyDiscount();

  // If params change, update state
  useEffect(() => {
    if (params.memberId) {
      setSelectedMemberId(params.memberId);
      setShowMemberPicker(false);
    }
    if (params.membershipId) {
      setSelectedMembershipId(params.membershipId);
    }
  }, [params.memberId, params.membershipId]);

  // Reset showAllMemberships on member change
  useEffect(() => {
    setShowAllMemberships(false);
  }, [selectedMemberId]);

  // Memberships list from GET /api/members/{id}/fees
  const allMemberships: MembershipFeeItem[] = useMemo(() => {
    return memberFeesData?.memberships || [];
  }, [memberFeesData]);

  // Filtered memberships with due
  const membershipsWithDue = useMemo(() => {
    return allMemberships.filter((m) => m.duePaise > 0);
  }, [allMemberships]);

  // Visible memberships in chooser: hide zero-due unless user taps "Show all"
  const visibleChooserMemberships = useMemo(() => {
    if (showAllMemberships) {
      return allMemberships;
    }
    return membershipsWithDue;
  }, [allMemberships, membershipsWithDue, showAllMemberships]);

  // Show chooser when more than one membership with a due (or show all clicked)
  const showChooser = membershipsWithDue.length > 1 || (showAllMemberships && allMemberships.length > 1);

  // Auto-select server's defaultMembershipId, or fall back to first with due, or first membership
  useEffect(() => {
    if (!allMemberships.length) return;
    const currentValid = allMemberships.some((m) => m.id === selectedMembershipId);
    if (!selectedMembershipId || !currentValid) {
      const defaultId = memberFeesData?.defaultMembershipId;
      const defaultValid = defaultId && allMemberships.some((m) => m.id === defaultId);
      if (defaultValid) {
        setSelectedMembershipId(defaultId);
      } else if (membershipsWithDue.length > 0) {
        setSelectedMembershipId(membershipsWithDue[0].id);
      } else {
        setSelectedMembershipId(allMemberships[0].id);
      }
    }
  }, [memberFeesData, allMemberships, membershipsWithDue, selectedMembershipId]);

  // Selected membership for Summary card (numbers of SELECTED membership only!)
  const chosenMembership: MembershipFeeItem | null = useMemo(() => {
    if (!allMemberships.length) return null;
    const found = allMemberships.find((m) => m.id === selectedMembershipId);
    return found || allMemberships[0];
  }, [allMemberships, selectedMembershipId]);

  // Total outstanding due
  const duePaise = chosenMembership ? Math.max(0, chosenMembership.duePaise) : 0;

  // Initialize or set amount when membership loads or changes
  useEffect(() => {
    if (duePaise > 0 && !rawAmountText) {
      const rupees = Math.round(duePaise / 100);
      setRawAmountText(formatNumericTyping(rupees.toString()));
      setSelectedChip('full');
    }
  }, [duePaise]);

  // Parsed amount in paise
  const inputAmountPaise = useMemo(() => {
    const clean = rawAmountText.replace(/,/g, '').trim();
    const rupees = parseInt(clean, 10);
    return isNaN(rupees) || rupees < 0 ? 0 : rupees * 100;
  }, [rawAmountText]);

  // Balance after this payment
  const balanceAfterPaise = Math.max(0, duePaise - inputAmountPaise);

  // Handlers for Amount Quick Chips
  const handleSelectChip = (chip: 'full' | 'half' | 'custom') => {
    setSelectedChip(chip);
    setErrorMessage(null);
    if (chip === 'full') {
      const rupees = Math.round(duePaise / 100);
      setRawAmountText(formatNumericTyping(rupees.toString()));
    } else if (chip === 'half') {
      const rupees = Math.round(duePaise / 200);
      setRawAmountText(formatNumericTyping(rupees.toString()));
    } else {
      setRawAmountText('');
    }
  };

  const handleAmountChange = (text: string) => {
    setErrorMessage(null);
    const formatted = formatNumericTyping(text);
    setRawAmountText(formatted);
    setSelectedChip('custom');
  };

  // Resolved past payment date: only sent when owner explicitly changed Date row to a past day
  const resolvedPastPaymentDate = useMemo(() => {
    if (!isOwner) return undefined;
    if (dateChip === 'yesterday') {
      return getYesterdayISTDateString();
    }
    if (dateChip === 'other' && customPastDate.trim()) {
      return customPastDate.trim();
    }
    return undefined; // 'today' sends nothing, server assigns real time in IST
  }, [isOwner, dateChip, customPastDate]);

  const isPaymentDateValid = useMemo(() => {
    if (!isOwner || dateChip === 'today') return true;
    if (dateChip === 'yesterday') return true;
    if (dateChip === 'other') {
      const trimmed = customPastDate.trim();
      if (!trimmed) return false;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
      const todayStr = getTodayISTDateString();
      const minDateStr = getFutureISTDateString(-31);
      return trimmed < todayStr && trimmed >= minDateStr;
    }
    return true;
  }, [isOwner, dateChip, customPastDate]);

  const isPromiseDateValid = useMemo(() => {
    if (!promiseDate.trim()) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(promiseDate.trim())) return false;
    const tomorrowStr = getFutureISTDateString(1);
    const maxDateStr = getFutureISTDateString(90);
    return promiseDate.trim() >= tomorrowStr && promiseDate.trim() <= maxDateStr;
  }, [promiseDate]);

  // Validation
  const validationError = useMemo(() => {
    if (!selectedMemberId) return null;
    if (inputAmountPaise <= 0) {
      return COLLECT.AMOUNT_LABEL + ': ' + ERRORS.AMOUNT_ZERO;
    }
    if (inputAmountPaise > duePaise) {
      return ERRORS.AMOUNT_EXCEEDS_DUE;
    }
    if (!isPaymentDateValid) {
      return COLLECT.INVALID_DATE_RANGE;
    }
    if (promiseDate.trim() && !isPromiseDateValid) {
      return COLLECT.INVALID_PROMISE_DATE;
    }
    return null;
  }, [selectedMemberId, inputAmountPaise, duePaise, isPaymentDateValid, promiseDate, isPromiseDateValid]);

  // Submit Payment
  const handleSubmitPayment = async () => {
    if (isSubmittingRef.current || collectPaymentMutation.isPending) {
      return;
    }
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    if (!selectedMemberId) {
      setErrorMessage(ERRORS.SELECT_MEMBER);
      return;
    }

    setErrorMessage(null);
    isSubmittingRef.current = true;

    // Save promise date in background if OWNER specified it and balance remains
    if (isOwner && balanceAfterPaise > 0 && promiseDate.trim() && chosenMembership?.id) {
      try {
        await updatePromisedDateSilently(chosenMembership.id, promiseDate.trim());
      } catch (e) {
        // ignore or log
      }
    }

    try {
      const payload: any = {
        memberId: selectedMemberId,
        membershipId: chosenMembership?.id,
        amountPaise: inputAmountPaise,
        mode,
        notes: note.trim() || undefined,
        reason: note.trim() || undefined,
        referenceNo: referenceNo.trim() || undefined,
        idempotencyKey: idempotencyKeyRef.current,
      };

      if (resolvedPastPaymentDate) {
        payload.paidDate = resolvedPastPaymentDate;
        payload.paymentDate = resolvedPastPaymentDate;
        payload.receivedAt = resolvedPastPaymentDate;
      }

      const res = await collectPaymentMutation.mutateAsync(payload);

      // Success! Play haptics
      safeNotificationAsync(NotificationFeedbackType.Success);

      const remaining = Math.max(0, duePaise - inputAmountPaise);
      setSuccessPayment({
        id: res?.id || res?.payment?.id || 'new',
        receiptNo: res?.receiptNumber || res?.receiptNo || 'REC-NEW',
        amountPaise: inputAmountPaise,
        remainingDuePaise: remaining,
        memberPhone: member?.phone,
        memberName: member?.name,
      });
    } catch (err: any) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code || err?.response?.data?.errorCode;
      let msg = err?.response?.data?.message;

      if (status === 402 || code === 'SUBSCRIPTION_EXPIRED') {
        msg = COLLECT.SUBSCRIPTION_EXPIRED_ERR;
      } else if (status === 409 || code === 'DUPLICATE' || code === 'PAYMENT_DUPLICATE') {
        msg = COLLECT.DUPLICATE_PAYMENT_ERR;
      } else if (err?.message?.includes('Network') || !err?.response) {
        msg = ERRORS.NETWORK;
      } else if (!msg) {
        msg = ERRORS.GENERIC;
      }
      setErrorMessage(msg);
      Toast.show({
        type: 'error',
        text1: 'Payment Failed',
        text2: msg,
      });
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // Silent update of promised date
  const updatePromisedDateSilently = async (membershipId: string, pDate: string) => {
    try {
      const response = await fetch(`/api/memberships/${membershipId}/promised-date`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promisedDate: pDate }),
      });
    } catch {}
  };

  // Retry with SAME idempotency key
  const handleRetrySubmit = () => {
    handleSubmitPayment();
  };

  // Reset for "Collect another"
  const handleCollectAnother = () => {
    idempotencyKeyRef.current = generateIdempotencyKey();
    setSuccessPayment(null);
    setRawAmountText('');
    setSelectedChip('custom');
    setReferenceNo('');
    setNote('');
    setShowUpiQr(false);
    setErrorMessage(null);
    setSelectedMemberId(undefined);
    setSelectedMembershipId(undefined);
    setShowMemberPicker(true);
  };

  // Apply Discount Handler (OWNER only)
  const handleApplyDiscountSubmit = async () => {
    const parsedPaise = parseInt(discountAmountStr.replace(/,/g, ''), 10) * 100;
    if (isNaN(parsedPaise) || parsedPaise <= 0) {
      Toast.show({ type: 'error', text1: 'Invalid amount', text2: 'Enter positive discount' });
      return;
    }
    if (parsedPaise > duePaise) {
      Toast.show({
        type: 'error',
        text1: 'Discount too high',
        text2: 'Discount cannot be more than current due',
      });
      return;
    }
    if (!discountReason.trim() || discountReason.trim().length < 5) {
      Toast.show({
        type: 'error',
        text1: 'Reason required',
        text2: 'Reason must be at least 5 characters',
      });
      return;
    }

    if (!chosenMembership?.id) return;

    try {
      await applyDiscountMutation.mutateAsync({
        membershipId: chosenMembership.id,
        discountPaise: parsedPaise,
        reason: discountReason.trim(),
      });
      setShowDiscountModal(false);
      setDiscountAmountStr('');
      setDiscountReason('');
      refetchMember();
      // Recalculate amount input if full due was chosen
      const newDue = Math.max(0, duePaise - parsedPaise);
      setRawAmountText(formatNumericTyping(Math.round(newDue / 100).toString()));
      setSelectedChip('full');
    } catch (e: any) {
      // Toast handled by mutation
    }
  };

  // Share Receipt PDF
  const handleShareReceipt = async () => {
    if (!successPayment) return;
    setIsSharingReceipt(true);
    try {
      await downloadAndShareReceipt(successPayment.id, successPayment.receiptNo);
    } finally {
      setIsSharingReceipt(false);
    }
  };

  // Send WhatsApp Receipt
  const handleSendWhatsApp = () => {
    if (!successPayment || !successPayment.memberPhone) return;
    const phone = successPayment.memberPhone;
    const amtStr = formatMoney(successPayment.amountPaise);
    const recNo = successPayment.receiptNo;
    const gymName = gymProfile?.name || 'our gym';
    const balStr =
      successPayment.remainingDuePaise === 0
        ? COLLECT.FULLY_PAID
        : COLLECT.BALANCE_DUE(formatMoney(successPayment.remainingDuePaise));
    const msg = `Hello ${successPayment.memberName || 'Member'}, thank you for your payment of ${amtStr} at ${gymName}. Receipt No: ${recNo}. ${balStr}.`;
    safeOpenURL(`https://wa.me/91${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`);
  };

  // Can user see member unmasked phone to show WhatsApp button?
  const canSendWhatsApp = useMemo(() => {
    if (!successPayment?.memberPhone) return false;
    if (isPhoneMasked(successPayment.memberPhone)) return false;
    if (isOwner) return true;
    if (isStaff && gymProfile?.staffCanSeeFullPhone) return true;
    return false;
  }, [successPayment, isOwner, isStaff, gymProfile]);

  // Sorted members for Picker (dues > 0 first)
  const sortedMembers = useMemo(() => {
    const list = searchMembersData?.pages.flatMap((p) => p.content) || [];
    return [...list].sort((a, b) => {
      const aDue = a.dueTotalPaise ?? a.currentDuePaise ?? a.currentMembership?.duePaise ?? 0;
      const bDue = b.dueTotalPaise ?? b.currentDuePaise ?? b.currentMembership?.duePaise ?? 0;
      if (aDue > 0 && bDue <= 0) return -1;
      if (bDue > 0 && aDue <= 0) return 1;
      return (bDue || 0) - (aDue || 0);
    });
  }, [searchMembersData]);

  // Build UPI Pay URL
  const upiPayLink = useMemo(() => {
    if (!collectionInfo?.upiId) return '';
    const pa = encodeURIComponent(collectionInfo.upiId);
    const pn = encodeURIComponent(collectionInfo.upiName || gymProfile?.name || 'Gym');
    const am = encodeURIComponent((inputAmountPaise / 100).toFixed(2));
    const code = member?.memberCode || 'MEMBER';
    const noteText = note.trim() ? `${code} - ${note.trim()}` : `Gym fee ${code}`;
    const tn = encodeURIComponent(noteText);
    return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
  }, [collectionInfo, gymProfile, inputAmountPaise, member, note]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: SUCCESS SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (successPayment) {
    return (
      <Screen style={styles.centerContainer}>
        <View style={styles.successCard}>
          <Animated.View
            style={[
              styles.successIconCircle,
              {
                transform: [{ scale: checkScale }],
                opacity: checkOpacity,
              },
            ]}
          >
            <CheckCircle color={colors.primary} size={64} strokeWidth={2.4} />
          </Animated.View>

          <Text style={styles.successTitle}>{COLLECT.SUCCESS_TITLE}</Text>
          <Text style={styles.successAmount}>{formatMoney(successPayment.amountPaise)}</Text>
          <Text style={styles.successReceipt}>{COLLECT.RECEIPT_NO(successPayment.receiptNo)}</Text>

          <View style={styles.successBalanceBadge}>
            <Text
              style={[
                styles.successBalanceText,
                successPayment.remainingDuePaise === 0 && { color: colors.primary },
              ]}
            >
              {successPayment.remainingDuePaise === 0
                ? COLLECT.FULLY_PAID
                : COLLECT.BALANCE_DUE(formatMoney(successPayment.remainingDuePaise))}
            </Text>
          </View>

          <View style={styles.successActionsColumn}>
            <Button
              title={COLLECT.SHARE_RECEIPT}
              icon={<Share2 size={18} color={colors.textOnPrimary} />}
              onPress={handleShareReceipt}
              loading={isSharingReceipt}
              variant="primary"
              size="md"
              style={styles.actionBtn}
            />

            {canSendWhatsApp && (
              <Button
                title={COLLECT.SEND_ON_WHATSAPP}
                icon={<Send size={18} color={colors.text} />}
                onPress={handleSendWhatsApp}
                variant="secondary"
                size="md"
                style={styles.actionBtn}
              />
            )}

            <View style={styles.successBottomRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Button
                  title={COLLECT.COLLECT_ANOTHER}
                  variant="ghost"
                  size="md"
                  onPress={handleCollectAnother}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={COLLECT.DONE}
                  variant="secondary"
                  size="md"
                  onPress={() => safeBack('/(tabs)/payments')}
                />
              </View>
            </View>
          </View>
        </View>
      </Screen>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: MEMBER SEARCH MODAL
  // ─────────────────────────────────────────────────────────────────────────────
  const renderMemberPickerModal = () => (
    <Modal
      visible={showMemberPicker}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (selectedMemberId) setShowMemberPicker(false);
        else safeBack('/(tabs)/payments');
      }}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => {
            if (selectedMemberId) setShowMemberPicker(false);
            else safeBack('/(tabs)/payments');
          }}
        />
        <View style={styles.modalContent}>
          {/* Drag Handle */}
          <View style={styles.dragHandleWrap}>
            <View style={styles.dragHandle} />
          </View>

          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{COLLECT.SEARCH_TITLE}</Text>
            <TouchableOpacity
              onPress={() => {
                if (selectedMemberId) setShowMemberPicker(false);
                else safeBack('/(tabs)/payments');
              }}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X color={colors.text} size={22} />
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={styles.searchBar}>
            <Search color={colors.primary} size={18} />
            <TextInput
              style={styles.searchInput}
              placeholder={COLLECT.SELECT_MEMBER_PLACEHOLDER}
              placeholderTextColor={colors.textSecondary}
              value={memberSearchTerm}
              onChangeText={setMemberSearchTerm}
              cursorColor={colors.primary}
              selectionColor={colors.primarySoft}
              autoFocus
            />
            {memberSearchTerm ? (
              <TouchableOpacity onPress={() => setMemberSearchTerm('')}>
                <X color={colors.textSecondary} size={16} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Member List */}
          {loadingSearch ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <FlatList
              data={sortedMembers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingVertical: 8 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const itemDue = item.dueTotalPaise ?? item.currentDuePaise ?? item.currentMembership?.duePaise ?? 0;
                return (
                  <TouchableOpacity
                    style={styles.memberRow}
                    onPress={() => {
                      setSelectedMemberId(item.id);
                      setSelectedMembershipId(undefined);
                      setShowMemberPicker(false);
                      idempotencyKeyRef.current = generateIdempotencyKey();
                      setErrorMessage(null);
                    }}
                    accessibilityRole="button"
                  >
                    <Avatar name={item.name} size="md" photoUrl={item.photoUrl} />
                    <View style={styles.memberInfoCol}>
                      <Text style={styles.memberRowName}>{item.name}</Text>
                      <Text style={styles.memberRowSub}>
                        {item.memberCode ? `${item.memberCode} • ` : ''}
                        {item.phone}
                      </Text>
                    </View>
                    <View style={styles.memberRowDueCol}>
                      {itemDue > 0 ? (
                        <View style={styles.dueBadgeCoral}>
                          <Text style={styles.dueBadgeCoralText}>{formatMoney(itemDue)} due</Text>
                        </View>
                      ) : (
                        <Text style={styles.noDueText}>No due</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No members found</Text>
                </View>
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: DISCOUNT MODAL (OWNER ONLY)
  // ─────────────────────────────────────────────────────────────────────────────
  const renderDiscountModal = () => (
    <Modal
      visible={showDiscountModal}
      animationType="fade"
      transparent
      onRequestClose={() => setShowDiscountModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContentSmall}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{COLLECT.DISCOUNT_MODAL_TITLE}</Text>
            <TouchableOpacity
              onPress={() => setShowDiscountModal(false)}
              style={styles.iconBtn}
              accessibilityRole="button"
            >
              <X color={colors.text} size={20} />
            </TouchableOpacity>
          </View>

          <View style={styles.discountAlertBanner}>
            <AlertTriangle size={16} color={colors.warning} style={{ marginRight: 8 }} />
            <Text style={styles.discountAlertText}>{COLLECT.DISCOUNT_CANNOT_BE_UNDONE}</Text>
          </View>

          <Text style={styles.label}>{COLLECT.DISCOUNT_AMOUNT_LABEL} (₹)</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputPrefix}>₹</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              value={discountAmountStr}
              onChangeText={(t) => setDiscountAmountStr(formatNumericTyping(t))}
            />
          </View>

          <Text style={[styles.label, { marginTop: 14 }]}>{COLLECT.DISCOUNT_REASON_LABEL}</Text>
          <TextInput
            style={[styles.textInputMulti, { minHeight: 64 }]}
            placeholder={COLLECT.DISCOUNT_REASON_PLACEHOLDER}
            placeholderTextColor={colors.textSecondary}
            value={discountReason}
            onChangeText={setDiscountReason}
            multiline
          />

          <View style={styles.modalFooterRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Button
                title={COMMON.CANCEL}
                variant="ghost"
                size="md"
                onPress={() => setShowDiscountModal(false)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={COMMON.CONFIRM}
                variant="primary"
                size="md"
                loading={applyDiscountMutation.isPending}
                onPress={handleApplyDiscountSubmit}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN FLOW
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Screen safeTop={true} safeBottom={false} contained={true}>
      <PageHeader
        title={COLLECT.SCREEN_TITLE}
        showBack
        onBack={() => safeBack('/(tabs)/payments')}
      />

      {renderMemberPickerModal()}
      {renderDiscountModal()}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: chosenMembership ? 140 + insets.bottom : 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Error Banner */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <AlertTriangle color={colors.danger} size={20} style={{ marginRight: 10 }} />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
              <TouchableOpacity
                onPress={handleRetrySubmit}
                style={styles.retryBtn}
                accessibilityRole="button"
              >
                <RefreshCw size={14} color={colors.text} style={{ marginRight: 4 }} />
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 1. Member Selector / Change Row */}
          {member ? (
            <GlassCard style={styles.card} contentStyle={styles.cardContent}>
              <View style={styles.memberHeaderRow}>
                <Avatar name={member.name} photoUrl={member.photoUrl} size="md" />
                <View style={styles.memberHeaderDetails}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberSub}>
                    {member.memberCode ? `${member.memberCode} • ` : ''}
                    {member.phone}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowMemberPicker(true)}
                  style={styles.changeMemberBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.changeMemberText}>Change</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          ) : (
            <GlassCard style={styles.card} contentStyle={styles.cardContent}>
              <TouchableOpacity
                style={styles.selectMemberPrompt}
                onPress={() => setShowMemberPicker(true)}
                accessibilityRole="button"
              >
                <Search color={colors.primary} size={22} style={{ marginRight: 10 }} />
                <Text style={styles.selectMemberPromptText}>Tap to search and select a member</Text>
              </TouchableOpacity>
            </GlassCard>
          )}

          {/* 2. Multiple Memberships Chooser (when > 1 due, or Show all selected) */}
          {showChooser && (
            <GlassCard style={styles.card} contentStyle={styles.cardContent}>
              <View style={styles.chooserHeaderRow}>
                <Text style={styles.sectionTitle}>{COLLECT.MULTIPLE_MEMBERSHIPS_TITLE}</Text>
                {allMemberships.length > membershipsWithDue.length && (
                  <TouchableOpacity
                    onPress={() => setShowAllMemberships((prev) => !prev)}
                    style={styles.showAllToggleBtn}
                    accessibilityRole="button"
                  >
                    <Text style={styles.showAllToggleText}>
                      {showAllMemberships ? 'Show only dues' : `Show all (${allMemberships.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.chooserList}>
                {visibleChooserMemberships.map((m) => {
                  const isSelected = m.id === selectedMembershipId;
                  const periodText =
                    m.startDate && m.expiryDate
                      ? `${formatDate(m.startDate)} – ${formatDate(m.expiryDate)}`
                      : m.expiryDate
                      ? `Valid till ${formatDate(m.expiryDate)}`
                      : 'Active plan';
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.chooserItem, isSelected && styles.chooserItemActive]}
                      onPress={() => setSelectedMembershipId(m.id)}
                      accessibilityRole="button"
                      activeOpacity={0.8}
                    >
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={styles.chooserPlan}>{m.planName || 'Plan'}</Text>
                          <Badge label={m.status} variant={getStatusBadgeVariant(m.status)} size="sm" />
                        </View>
                        <Text style={styles.chooserExpiry}>{periodText}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                        {m.duePaise > 0 ? (
                          <Text style={styles.chooserDue}>{formatMoney(m.duePaise)}</Text>
                        ) : (
                          <Text style={[styles.chooserDue, { color: colors.textSecondary, fontSize: 13 }]}>
                            No due
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </GlassCard>
          )}

          {/* 3. Summary Card with Live Balance */}
          {chosenMembership && (
            <GlassCard style={styles.card} contentStyle={styles.cardContent}>
              <View style={styles.summaryHeaderRow}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={styles.summaryPlanName}>{chosenMembership.planName}</Text>
                    <Badge label={chosenMembership.status} variant={getStatusBadgeVariant(chosenMembership.status)} size="sm" />
                  </View>
                  {chosenMembership.expiryDate && (
                    <Text style={styles.summaryExpiry}>Valid till {formatDate(chosenMembership.expiryDate)}</Text>
                  )}
                </View>
              {isOwner && duePaise > 0 && (
                <TouchableOpacity
                  style={styles.discountActionBtn}
                  onPress={() => setShowDiscountModal(true)}
                  accessibilityRole="button"
                >
                  <Tag size={13} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.discountActionText}>{COLLECT.APPLY_DISCOUNT}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>{COLLECT.TOTAL_FEE}</Text>
                <Text style={styles.breakdownValue}>
                  {formatMoney(chosenMembership.totalPaise)}
                </Text>
              </View>
              {chosenMembership.discountPaise > 0 && (
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>{COLLECT.DISCOUNT}</Text>
                  <Text style={[styles.breakdownValue, { color: colors.primary }]}>
                    -{formatMoney(chosenMembership.discountPaise)}
                  </Text>
                </View>
              )}
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>{COLLECT.PAID}</Text>
                <Text style={styles.breakdownValue}>{formatMoney(chosenMembership.paidPaise)}</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>{COLLECT.DUE}</Text>
                <Text
                  style={[
                    styles.breakdownValue,
                    {
                      color:
                        chosenMembership.duePaise > 0 ? colors.danger : colors.text,
                    },
                  ]}
                >
                  {formatMoney(chosenMembership.duePaise)}
                </Text>
              </View>
            </View>
          </GlassCard>
        )}

        {/* 4. Amount Input with Quick Chips & Live Balance */}
        {chosenMembership && (
          <GlassCard style={styles.card} contentStyle={styles.cardContent}>
            <Text style={styles.label}>{COLLECT.AMOUNT_LABEL}</Text>

            <View style={styles.amountInputRow}>
              <Text style={styles.amountPrefix}>₹</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                value={rawAmountText}
                onChangeText={handleAmountChange}
              />
            </View>

            {/* Quick Chips */}
            <View style={styles.chipsRow}>
              <TouchableOpacity
                style={[styles.amountChip, selectedChip === 'full' && styles.amountChipActive]}
                onPress={() => handleSelectChip('full')}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.amountChipText,
                    selectedChip === 'full' && styles.amountChipTextActive,
                  ]}
                >
                  {COLLECT.CHIP_FULL_DUE} ({formatMoney(duePaise)})
                </Text>
              </TouchableOpacity>

              {duePaise > 100 && (
                <TouchableOpacity
                  style={[styles.amountChip, selectedChip === 'half' && styles.amountChipActive]}
                  onPress={() => handleSelectChip('half')}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.amountChipText,
                      selectedChip === 'half' && styles.amountChipTextActive,
                    ]}
                  >
                    {COLLECT.CHIP_HALF} ({formatMoney(Math.round(duePaise / 2))})
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.amountChip, selectedChip === 'custom' && styles.amountChipActive]}
                onPress={() => handleSelectChip('custom')}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.amountChipText,
                    selectedChip === 'custom' && styles.amountChipTextActive,
                  ]}
                >
                  {COLLECT.CHIP_CUSTOM}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Live Balance Line */}
            <View style={styles.liveBalanceContainer}>
              <Text style={styles.liveBalanceText}>
                {COLLECT.BALANCE_AFTER(formatMoney(balanceAfterPaise))}
              </Text>
            </View>

            {validationError && <Text style={styles.inlineErrorText}>{validationError}</Text>}
          </GlassCard>
        )}

        {/* 5. Payment Mode Selector (3 Large Buttons) */}
        {chosenMembership && (
          <GlassCard style={styles.card} contentStyle={styles.cardContent}>
            <Text style={styles.label}>{COLLECT.PAYMENT_MODE}</Text>

            <View style={styles.modeButtonsRow}>
              {(['CASH', 'UPI', 'CARD'] as const).map((m) => {
                const isSelected = mode === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.largeModeBtn, isSelected && styles.largeModeBtnSelected]}
                    onPress={() => setMode(m)}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.largeModeBtnText,
                        isSelected && styles.largeModeBtnTextSelected,
                      ]}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── UPI Details & QR ───────────────────────────────────── */}
            {mode === 'UPI' && (
              <View style={styles.modeSubContainer}>
                {collectionInfo?.upiId ? (
                  <>
                    <TouchableOpacity
                      style={styles.showQrBtn}
                      onPress={() => setShowUpiQr(!showUpiQr)}
                      accessibilityRole="button"
                    >
                      <QrCode size={18} color={colors.primary} style={{ marginRight: 8 }} />
                      <Text style={styles.showQrBtnText}>
                        {showUpiQr ? COLLECT.HIDE_UPI_QR : COLLECT.SHOW_UPI_QR}
                      </Text>
                    </TouchableOpacity>

                    {showUpiQr && (
                      <View style={styles.qrFullCard}>
                        <Text style={styles.qrCardTitle}>{COLLECT.UPI_QR_TITLE}</Text>
                        <View style={styles.qrCodeBox}>
                          <QRCode
                            value={upiPayLink || 'upi://pay'}
                            size={160}
                            color={colors.qrForeground}
                            backgroundColor={colors.qrBackground}
                          />
                        </View>
                        <Text style={styles.qrAmountText}>{formatMoney(inputAmountPaise)}</Text>
                        <Text style={styles.qrUpiIdText}>{collectionInfo.upiId}</Text>
                        <Text style={styles.qrWarningText}>{COLLECT.UPI_QR_WARNING}</Text>
                        <Button
                          title={COLLECT.UPI_RECEIVED_BTN}
                          variant="primary"
                          size="md"
                          onPress={() => {
                            setShowUpiQr(false);
                            handleSubmitPayment();
                          }}
                          style={{ marginTop: 12 }}
                        />
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.noUpiBanner}>
                    <Text style={styles.noUpiText}>{COLLECT.NO_UPI_CONFIGURED}</Text>
                    {isOwner && (
                      <TouchableOpacity
                        onPress={() => router.push('/(tabs)/more/gym-profile')}
                        accessibilityRole="button"
                      >
                        <Text style={styles.settingsLinkText}>{COLLECT.GO_TO_GYM_SETTINGS}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <Text style={[styles.label, { marginTop: 14 }]}>{COLLECT.UPI_REF_LABEL}</Text>
                <TextInput
                  style={styles.textInputRegular}
                  placeholder={COLLECT.UPI_REF_PLACEHOLDER}
                  placeholderTextColor={colors.textSecondary}
                  value={referenceNo}
                  onChangeText={setReferenceNo}
                  maxLength={40}
                />
              </View>
            )}

            {/* ── Card Details ──────────────────────────────────────── */}
            {mode === 'CARD' && (
              <View style={styles.modeSubContainer}>
                <Text style={styles.label}>{COLLECT.CARD_REF_LABEL}</Text>
                <TextInput
                  style={styles.textInputRegular}
                  placeholder={COLLECT.CARD_REF_PLACEHOLDER}
                  placeholderTextColor={colors.textSecondary}
                  value={referenceNo}
                  onChangeText={setReferenceNo}
                  maxLength={40}
                />
              </View>
            )}
          </GlassCard>
        )}

        {/* 6. Optional Note & Owner Backdating / Promise Date */}
        {chosenMembership && (
          <GlassCard style={styles.card} contentStyle={styles.cardContent}>
            <Text style={styles.label}>{COLLECT.NOTE_LABEL}</Text>
            <TextInput
              style={styles.textInputRegular}
              placeholder={COLLECT.NOTE_PLACEHOLDER}
              placeholderTextColor={colors.textSecondary}
              value={note}
              onChangeText={setNote}
              maxLength={140}
            />

            {/* OWNER Only: Date row (default today; quick chips Today, Yesterday, Other up to 31 days back) */}
            {isOwner && (
              <View style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.label}>{COLLECT.PAYMENT_DATE_LABEL}</Text>
                  {dateChip === 'today' && (
                    <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: fonts.bodyRegular }}>
                      Today, {formatDate(getTodayISTDateString())}
                    </Text>
                  )}
                </View>
                <View style={styles.chipsRowSmall}>
                  <TouchableOpacity
                    style={[styles.smallChip, dateChip === 'today' && styles.smallChipActive]}
                    onPress={() => setDateChip('today')}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.smallChipText,
                        dateChip === 'today' && styles.smallChipTextActive,
                      ]}
                    >
                      Today
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallChip, dateChip === 'yesterday' && styles.smallChipActive]}
                    onPress={() => setDateChip('yesterday')}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.smallChipText,
                        dateChip === 'yesterday' && styles.smallChipTextActive,
                      ]}
                    >
                      Yesterday
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallChip, dateChip === 'other' && styles.smallChipActive]}
                    onPress={() => setDateChip('other')}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.smallChipText,
                        dateChip === 'other' && styles.smallChipTextActive,
                      ]}
                    >
                      Other
                    </Text>
                  </TouchableOpacity>
                </View>

                {dateChip === 'other' && (
                  <View style={{ marginTop: 8 }}>
                    <View style={styles.inputWithIcon}>
                      <Calendar size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
                      <TextInput
                        style={styles.dateInput}
                        value={customPastDate}
                        onChangeText={setCustomPastDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.textSecondary}
                        maxLength={10}
                      />
                    </View>
                    <Text style={styles.dateHelperText}>Allowed up to 31 days back</Text>
                  </View>
                )}

                {/* OWNER Promise Date if balance remaining */}
                {balanceAfterPaise > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <View style={styles.promiseHeaderRow}>
                      <Text style={styles.label}>{COLLECT.PROMISE_DATE_LABEL}</Text>
                      <Text style={styles.promiseRuleText}>{COLLECT.PROMISE_DATE_RULE}</Text>
                    </View>

                    <View style={styles.chipsRowSmall}>
                      <TouchableOpacity
                        style={[
                          styles.smallChip,
                          promiseDateChip === '7' && styles.smallChipActive,
                        ]}
                        onPress={() => {
                          setPromiseDateChip('7');
                          setPromiseDate(getFutureISTDateString(7));
                        }}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.smallChipText,
                            promiseDateChip === '7' && styles.smallChipTextActive,
                          ]}
                        >
                          +7 days
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.smallChip,
                          promiseDateChip === '15' && styles.smallChipActive,
                        ]}
                        onPress={() => {
                          setPromiseDateChip('15');
                          setPromiseDate(getFutureISTDateString(15));
                        }}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.smallChipText,
                            promiseDateChip === '15' && styles.smallChipTextActive,
                          ]}
                        >
                          +15 days
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.smallChip,
                          promiseDateChip === '30' && styles.smallChipActive,
                        ]}
                        onPress={() => {
                          setPromiseDateChip('30');
                          setPromiseDate(getFutureISTDateString(30));
                        }}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.smallChipText,
                            promiseDateChip === '30' && styles.smallChipTextActive,
                          ]}
                        >
                          +30 days
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.smallChip,
                          promiseDateChip === 'custom' && styles.smallChipActive,
                        ]}
                        onPress={() => setPromiseDateChip('custom')}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.smallChipText,
                            promiseDateChip === 'custom' && styles.smallChipTextActive,
                          ]}
                        >
                          Custom
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {(promiseDateChip === 'custom' || !promiseDateChip) && (
                      <View style={{ marginTop: 8 }}>
                        <View style={styles.inputWithIcon}>
                          <Clock size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
                          <TextInput
                            style={styles.dateInput}
                            value={promiseDate}
                            onChangeText={(t) => {
                              setPromiseDate(t);
                              setPromiseDateChip('custom');
                            }}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={colors.textSecondary}
                            maxLength={10}
                          />
                        </View>
                        <Text style={styles.dateHelperText}>Tomorrow to 90 days</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </GlassCard>
        )}

        </ScrollView>

        {/* 7. Sticky Bottom Bar outside scroll */}
        {chosenMembership && (
          <View
            style={[
              styles.stickyBottomBar,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <Button
              title={COLLECT.ACTION_COLLECT(formatMoney(inputAmountPaise))}
              variant="primary"
              size="lg"
              loading={collectPaymentMutation.isPending || isSubmittingRef.current}
              disabled={
                Boolean(validationError) ||
                inputAmountPaise <= 0 ||
                collectPaymentMutation.isPending ||
                isSubmittingRef.current
              }
              onPress={handleSubmitPayment}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function generateIdempotencyKey(): string {
  return 'idemp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

function formatNumericTyping(val: string): string {
  const digits = val.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10);
  return num.toLocaleString('en-IN');
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const makeStyles = (theme: ThemeValue) => {
  const { colors, fonts } = theme;
  return StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  cardContent: {
    padding: 16,
  },
  label: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.chipDangerBg,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.danger,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceRaised,
    borderRadius: theme.radius.sm,
    minHeight: 36,
  },
  retryBtnText: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 12,
    color: colors.text,
  },
  memberHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberHeaderDetails: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  memberSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  changeMemberBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeMemberText: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 13,
    color: colors.primary,
  },
  selectMemberPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    minHeight: 52,
  },
  selectMemberPromptText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 14,
    color: colors.primary,
  },
  sectionTitle: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 14,
    color: colors.text,
    marginBottom: 10,
  },
  chooserHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  showAllToggleBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  showAllToggleText: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 12,
    color: colors.primary,
  },
  chooserList: {
    gap: 8,
  },
  chooserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
    minHeight: 48,
  },
  chooserItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chooserPlan: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 14,
    color: colors.text,
  },
  chooserExpiry: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chooserDue: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 14,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  summaryPlanName: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 16,
    color: colors.text,
  },
  summaryExpiry: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  discountActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    minHeight: 36,
  },
  discountActionText: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 12,
    color: colors.primary,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 12,
  },
  breakdownItem: {
    alignItems: 'center',
  },
  breakdownLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  breakdownValue: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  amountPrefix: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 24,
    color: colors.textSecondary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontFamily: theme.fonts.headingBold,
    fontSize: 24,
    color: colors.text,
    paddingVertical: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  amountChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.full,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  amountChipText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: colors.text,
  },
  amountChipTextActive: {
    color: colors.textOnPrimary,
    fontFamily: theme.fonts.bodyBold,
  },
  liveBalanceContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  liveBalanceText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  inlineErrorText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.danger,
    marginTop: 6,
  },
  modeButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  largeModeBtn: {
    flex: 1,
    height: 52,
    borderRadius: theme.radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeModeBtnSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  largeModeBtnText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 14,
    color: colors.text,
  },
  largeModeBtnTextSelected: {
    color: colors.textOnPrimary,
    fontFamily: theme.fonts.headingBold,
  },
  modeSubContainer: {
    marginTop: 14,
  },
  showQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: colors.primarySoft,
    borderRadius: theme.radius.md,
    minHeight: 46,
    marginBottom: 8,
  },
  showQrBtnText: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 13,
    color: colors.primary,
  },
  qrFullCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.lg,
    padding: 16,
    alignItems: 'center',
    marginVertical: 10,
  },
  qrCardTitle: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
  },
  qrCodeBox: {
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: theme.radius.md,
    marginBottom: 10,
  },
  qrAmountText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 20,
    color: colors.text,
    marginTop: 4,
  },
  qrUpiIdText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  qrWarningText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    color: colors.warning,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  noUpiBanner: {
    padding: 12,
    backgroundColor: colors.surfaceRaised,
    borderRadius: theme.radius.md,
    marginBottom: 8,
  },
  noUpiText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  settingsLinkText: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 12,
    color: colors.primary,
    marginTop: 4,
  },
  textInputRegular: {
    height: 48,
    backgroundColor: colors.scrim,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    color: colors.text,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
  },
  ownerOptionRow: {
    flexDirection: 'row',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: colors.scrim,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
  },
  dateInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
  },
  submitContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '85%',
    minHeight: '55%',
    padding: 16,
  },
  modalContentSmall: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    margin: 20,
    alignSelf: 'center',
    width: '90%',
    maxWidth: 480,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  iconBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    backgroundColor: colors.scrim,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: colors.text,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: colors.border,
    minHeight: 56,
  },
  memberInfoCol: {
    flex: 1,
    marginLeft: 12,
  },
  memberRowName: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 15,
    color: colors.text,
  },
  memberRowSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  memberRowDueCol: {
    alignItems: 'flex-end',
  },
  dueBadge: {
    backgroundColor: colors.chipDangerBg,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.sm,
  },
  dueBadgeText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    color: colors.chipDangerText,
    fontVariant: ['tabular-nums'],
  },
  noDueText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: colors.scrim,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
  },
  inputPrefix: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
    color: colors.primary,
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    color: colors.text,
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 16,
  },
  textInputMulti: {
    backgroundColor: colors.scrim,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    padding: 10,
    color: colors.text,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
  },
  modalFooterRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  // Success Card Styles
  successCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
    maxWidth: 480,
    width: '100%',
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 20,
    color: colors.text,
    marginBottom: 8,
  },
  successAmount: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 32,
    color: colors.primary,
    marginBottom: 6,
  },
  successReceipt: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  successBalanceBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceRaised,
    borderRadius: theme.radius.full,
    marginBottom: 24,
  },
  successBalanceText: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 13,
    color: colors.text,
  },
  successActionsColumn: {
    width: '100%',
    gap: 10,
  },
  actionBtn: {
    width: '100%',
  },
  successBottomRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  discountAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.chipDangerBg,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: theme.radius.md,
    padding: 10,
    marginBottom: 16,
  },
  discountAlertText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: colors.danger,
  },
  chipsRowSmall: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  smallChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: theme.radius.full,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  smallChipText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: colors.text,
  },
  smallChipTextActive: {
    fontFamily: theme.fonts.bodyBold,
    color: colors.textOnPrimary,
  },
  promiseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  promiseRuleText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  dateHelperText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    marginLeft: 2,
  },
  stickyBottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceRaised,
  },
  dueBadgeCoral: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.chipDangerBg,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  dueBadgeCoralText: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 12,
    color: colors.chipDangerText,
    fontVariant: ['tabular-nums'],
  },
  });
};
