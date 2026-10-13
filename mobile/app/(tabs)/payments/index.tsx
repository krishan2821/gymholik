import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Download,
  FileText,
  Banknote,
  CreditCard,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  Plus,
  Search,
  X,
  RotateCcw,
  Receipt,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../../src/theme/theme';
import {
  usePayments,
  Payment,
  downloadAndShareReceipt,
  useReversePayment,
} from '../../../src/api/payments';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { Screen, getScreenBottomPadding } from '../../../src/components/Screen';
import { PageHeader } from '../../../src/components/PageHeader';
import { GlassCard } from '../../../src/components/GlassCard';
import { Button } from '../../../src/components/Button';
import { Badge } from '../../../src/components/Badge';
import { FilterChips } from '../../../src/components/FilterChips';
import { LoadingSkeleton } from '../../../src/components/LoadingSkeleton';
import { CollectPaymentModal } from '../../../src/components/CollectPaymentModal';
import { useBreakpoint } from '../../../src/hooks/useBreakpoint';
import { formatMoney } from '../../../src/utils/formatters';
import Toast from 'react-native-toast-message';
import { showConfirmDialog } from '../../../src/components/ConfirmDialog';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorState } from '../../../src/components/ErrorState';
import { PAYMENTS, ERRORS, COMMON } from '../../../src/constants/strings';

const PAGE_SIZE = 10;

export default function PaymentsHistoryScreen() {
  const router = useRouter();
  const rawInsets = useSafeAreaInsets();
  const insets = Platform.OS === 'web' ? { top: 0, right: 0, bottom: 0, left: 0 } : (rawInsets ?? { top: 0, right: 0, bottom: 0, left: 0 });
  const user = useAuthStore((state) => state.user);
  const role = user?.role || useAuthStore((state) => state.role);
  const isOwner = role === 'OWNER';
  const isAllowed = isOwner || role === 'STAFF';
  const { isDesktop } = useBreakpoint();

  const [dateFilter, setDateFilter] = useState('MONTH');
  const [modeFilter, setModeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [showCollectModal, setShowCollectModal] = useState(false);

  const searchInputRef = useRef<any>(null);

  // Keyboard shortcut: '/' focuses search input on web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !(
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA'
        )
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getDates = () => {
    const today = new Date();
    let fromDate = new Date();
    if (dateFilter === 'TODAY') {
      // already today
    } else if (dateFilter === 'WEEK') {
      fromDate.setDate(today.getDate() - 7);
    } else if (dateFilter === 'MONTH') {
      fromDate.setDate(today.getDate() - 30);
    }
    return {
      fromDate: fromDate.toISOString().split('T')[0],
      toDate: today.toISOString().split('T')[0],
    };
  };

  const { fromDate, toDate } = getDates();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = usePayments({
    fromDate: dateFilter !== 'ALL' ? fromDate : undefined,
    toDate: dateFilter !== 'ALL' ? toDate : undefined,
    mode: modeFilter === 'ALL' ? undefined : modeFilter,
  });

  const reversePayment = useReversePayment();
  const rawPayments: Payment[] = (
    data?.pages.flatMap((page: any) => {
      const paged = page?.payments || page;
      if (Array.isArray(paged?.content)) return paged.content;
      if (Array.isArray(paged)) return paged;
      return [];
    }) || []
  ).filter((item): item is Payment => Boolean(item && item.id));

  // Client-side search filter by member name or receipt
  const filteredPayments = searchQuery.trim()
    ? rawPayments.filter(
        (p) =>
          p.memberName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.receiptNo?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rawPayments;

  // Select first payment on desktop by default
  useEffect(() => {
    if (isDesktop && filteredPayments.length > 0 && !selectedPaymentId) {
      setSelectedPaymentId(filteredPayments[0].id);
    }
  }, [isDesktop, filteredPayments, selectedPaymentId]);

  const selectedPayment =
    filteredPayments.find((p) => p.id === selectedPaymentId) || null;

  // Pagination for desktop
  const totalItems = filteredPayments.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const paginatedPayments = isDesktop
    ? filteredPayments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    : filteredPayments;

  const handleReversePayment = (payment: Payment) => {
    if (!isOwner) return;

    showConfirmDialog({
      title: PAYMENTS.REVERSE_TITLE,
      message: PAYMENTS.REVERSE_PROMPT,
      confirmText: PAYMENTS.REVERSE_BTN,
      cancelText: COMMON.CANCEL,
      isDestructive: true,
      onConfirm: () => {
        reversePayment.mutate({ id: payment.id, notes: 'Reversal requested' });
      },
    });
  };

  if (!isAllowed) {
    return (
      <Screen style={styles.center}>
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  // ── DESKTOP VIEW: Data Table + Detail Panel ─────────────────────────
  if (isDesktop) {
    return (
      <Screen scrollable={false} safeTop={false}>
        {/* Top Header Bar */}
        <View style={styles.desktopTopBar}>
          <View style={styles.desktopTopLeft}>
            <Text style={styles.desktopScreenTitle}>Payments</Text>
            <View style={styles.desktopSearchWrap}>
              <Search color={theme.colors.primary} size={18} />
              <TextInput
                ref={searchInputRef}
                style={styles.desktopSearchInput}
                placeholder="Search member or receipt... (Press / to focus)"
                placeholderTextColor={theme.colors.textMuted}
                value={searchQuery}
                onChangeText={(t) => {
                  setSearchQuery(t);
                  setCurrentPage(1);
                }}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.desktopTopRight}>
            <TouchableOpacity
              style={styles.desktopPendingDuesBtn}
              onPress={() => router.push('/(tabs)/payments/dues')}
            >
              <FileText color={theme.colors.primary} size={16} />
              <Text style={styles.desktopPendingDuesText}>Pending Dues</Text>
            </TouchableOpacity>

            <Button
              title="Collect Payment"
              icon={<Plus size={18} color="#051F20" />}
              variant="primary"
              size="md"
              onPress={() => setShowCollectModal(true)}
            />
          </View>
        </View>

        {/* Filter Chips Bar */}
        <View style={styles.desktopFiltersBar}>
          <FilterChips
            options={[
              { label: PAYMENTS.FILTER_TODAY, value: 'TODAY' },
              { label: PAYMENTS.FILTER_WEEK, value: 'WEEK' },
              { label: PAYMENTS.FILTER_MONTH, value: 'MONTH' },
              { label: 'All time', value: 'ALL' },
            ]}
            selectedValue={dateFilter}
            onSelect={(val) => {
              setDateFilter(val);
              setCurrentPage(1);
            }}
          />
          <View style={{ width: 16 }} />
          <FilterChips
            options={[
              { label: PAYMENTS.FILTER_ALL_MODE, value: 'ALL' },
              { label: PAYMENTS.FILTER_CASH, value: 'CASH' },
              { label: PAYMENTS.FILTER_UPI, value: 'UPI' },
              { label: PAYMENTS.FILTER_CARD, value: 'CARD' },
            ]}
            selectedValue={modeFilter}
            onSelect={(val) => {
              setModeFilter(val);
              setCurrentPage(1);
            }}
          />
        </View>

        {/* Content: Table on Left + Detail Panel on Right */}
        <View style={styles.desktopContentRow}>
          {/* Table Container */}
          <View style={styles.desktopTableCard}>
            <ScrollView style={styles.desktopTableScroll} showsVerticalScrollIndicator={true}>
              {/* Sticky Header */}
              <View style={styles.desktopTableHeaderRow}>
                <Text style={[styles.tableTh, { flex: 2.2 }]}>MEMBER NAME</Text>
                <Text style={[styles.tableTh, { flex: 1.8 }]}>RECEIPT NO</Text>
                <Text style={[styles.tableTh, { flex: 1.4 }]}>MODE</Text>
                <Text style={[styles.tableTh, { flex: 1.8 }]}>DATE & TIME</Text>
                <Text style={[styles.tableTh, { flex: 1.5, textAlign: 'right' }]}>AMOUNT</Text>
                <Text style={[styles.tableTh, { flex: 1.3, textAlign: 'center' }]}>STATUS</Text>
              </View>

              {/* Rows */}
              {paginatedPayments.length === 0 ? (
                <View style={styles.desktopEmptyTable}>
                  <EmptyState type="payments" message={PAYMENTS.EMPTY} />
                </View>
              ) : (
                paginatedPayments.map((payment) => {
                  const isSelected = selectedPaymentId === payment.id;
                  const isReversal = payment.type === 'REVERSAL';
                  const formattedDate = new Date(payment.paidAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <TouchableOpacity
                      key={payment.id}
                      style={[
                        styles.desktopTableRow,
                        isSelected && styles.desktopTableRowSelected,
                        isReversal && styles.desktopTableRowReversal,
                      ]}
                      onPress={() => setSelectedPaymentId(payment.id)}
                      activeOpacity={0.8}
                      {...({ tabIndex: 0 } as any)}
                    >
                      {/* Member Name */}
                      <Text
                        style={[
                          styles.tableTd,
                          styles.tableMemberName,
                          { flex: 2.2 },
                          isReversal && styles.textReversal,
                        ]}
                        numberOfLines={1}
                      >
                        {payment.memberName}
                      </Text>

                      {/* Receipt */}
                      <Text style={[styles.tableTd, styles.tableText, { flex: 1.8 }]} numberOfLines={1}>
                        {payment.receiptNo}
                      </Text>

                      {/* Mode */}
                      <View style={[styles.tableTd, { flex: 1.4, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                        {payment.mode === 'CASH' && <Banknote color={theme.colors.primary} size={15} />}
                        {payment.mode === 'UPI' && <Smartphone color={theme.colors.primary} size={15} />}
                        {payment.mode === 'CARD' && <CreditCard color={theme.colors.warning} size={15} />}
                        <Text style={styles.tableText}>{payment.mode}</Text>
                      </View>

                      {/* Date & Time */}
                      <Text style={[styles.tableTd, styles.tableText, { flex: 1.8 }]} numberOfLines={1}>
                        {formattedDate}
                      </Text>

                      {/* Amount */}
                      <Text
                        style={[
                          styles.tableTd,
                          styles.tableAmountText,
                          { flex: 1.5, textAlign: 'right' },
                          isReversal && styles.textReversal,
                        ]}
                      >
                        {formatMoney(payment.amountPaise)}
                      </Text>

                      {/* Status */}
                      <View style={[styles.tableTd, { flex: 1.3, alignItems: 'center' }]}>
                        {isReversal ? (
                          <Badge label="REVERSAL" variant="error" size="sm" />
                        ) : (
                          <Badge label="PAID" variant="success" size="sm" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Pagination Controls */}
            {totalItems > PAGE_SIZE && (
              <View style={styles.desktopPagination}>
                <Text style={styles.paginationText}>
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(currentPage * PAGE_SIZE, totalItems)} of {totalItems} receipts
                </Text>
                <View style={styles.paginationButtons}>
                  <TouchableOpacity
                    style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                    disabled={currentPage === 1}
                    onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={16} color={currentPage === 1 ? 'rgba(218, 241, 222, 0.3)' : '#DAF1DE'} />
                    <Text style={[styles.pageBtnText, currentPage === 1 && styles.pageBtnTextDisabled]}>Prev</Text>
                  </TouchableOpacity>

                  <Text style={styles.pageNumberText}>
                    {currentPage} / {totalPages}
                  </Text>

                  <TouchableOpacity
                    style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                    disabled={currentPage === totalPages}
                    onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <Text style={[styles.pageBtnText, currentPage === totalPages && styles.pageBtnTextDisabled]}>Next</Text>
                    <ChevronRight size={16} color={currentPage === totalPages ? 'rgba(218, 241, 222, 0.3)' : '#DAF1DE'} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Right Detail Panel */}
          <View style={styles.desktopDetailPanel}>
            {selectedPayment ? (
              <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.detailReceiptTop}>
                  <View style={styles.receiptIconCircle}>
                    <Receipt size={24} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.receiptTitle}>Payment Receipt</Text>
                  <Text style={styles.receiptNumberText}>{selectedPayment.receiptNo}</Text>
                  <Text style={styles.receiptBigAmount}>{formatMoney(selectedPayment.amountPaise)}</Text>
                  <View style={{ marginTop: 8 }}>
                    <Badge
                      label={selectedPayment.type === 'REVERSAL' ? 'REVERSED' : 'PAID'}
                      variant={selectedPayment.type === 'REVERSAL' ? 'error' : 'success'}
                      size="sm"
                    />
                  </View>
                </View>

                {/* Details Card */}
                <View style={styles.detailCard}>
                  <Text style={styles.detailSectionTitle}>TRANSACTION DETAILS</Text>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailLabel}>Member</Text>
                    <Text style={styles.detailValue}>{selectedPayment.memberName}</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailLabel}>Payment Mode</Text>
                    <Text style={styles.detailValue}>{selectedPayment.mode}</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailLabel}>Date & Time</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedPayment.paidAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.detailActionsCol}>
                  {selectedPayment.type !== 'REVERSAL' ? (
                    <>
                      <Button
                        title="Download Receipt"
                        icon={<Download size={16} color="#051F20" />}
                        variant="primary"
                        size="md"
                        onPress={() =>
                          downloadAndShareReceipt(selectedPayment.id, selectedPayment.receiptNo)
                        }
                      />
                      {isOwner && (
                        <Button
                          title="Reverse Payment"
                          icon={<RotateCcw size={16} color="#FF7A7A" />}
                          variant="secondary"
                          size="md"
                          onPress={() => handleReversePayment(selectedPayment)}
                        />
                      )}
                    </>
                  ) : (
                    <Text style={styles.reversedNoticeText}>
                      This payment has been reversed and cancelled.
                    </Text>
                  )}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.emptyDetailPanel}>
                <Receipt size={40} color="rgba(218, 241, 222, 0.3)" />
                <Text style={styles.emptyDetailText}>Select a payment record to view details</Text>
              </View>
            )}
          </View>
        </View>

        {/* Collect Payment Modal (560px centered) */}
        <CollectPaymentModal
          visible={showCollectModal}
          onClose={() => setShowCollectModal(false)}
          onSuccess={() => refetch()}
        />
      </Screen>
    );
  }

  // ── MOBILE VIEW: Standard Stack Cards ────────────────────────────────
  const renderItem = ({ item }: { item: Payment }) => {
    if (!item?.id) return null;
    return (
      <GlassCard
        style={[styles.card, item.type === 'REVERSAL' && styles.cardReversed]}
        contentStyle={styles.cardInner}
        onPress={() => handleReversePayment(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.name, item.type === 'REVERSAL' && styles.textReversed]}>
            {item.memberName}
          </Text>
          <Text style={[styles.amount, item.type === 'REVERSAL' && styles.textReversed]}>
            {formatMoney(item.amountPaise)}
          </Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.modeRow}>
            {item.mode === 'CASH' && <Banknote color={theme.colors.primary} size={16} />}
            {item.mode === 'UPI' && <Smartphone color={theme.colors.primary} size={16} />}
            {item.mode === 'CARD' && <CreditCard color={theme.colors.warning} size={16} />}
            <Text style={styles.modeText}>{item.mode}</Text>
          </View>
          <Text style={styles.dateText}>
            {new Date(item.paidAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.receiptText}>Receipt: {item.receiptNo}</Text>
          {item.type !== 'REVERSAL' ? (
            <TouchableOpacity
              style={styles.downloadBtn}
              onPress={() => downloadAndShareReceipt(item.id, item.receiptNo)}
              accessibilityRole="button"
              accessibilityLabel={`Download receipt ${item.receiptNo}`}
            >
              <Download color={theme.colors.primary} size={16} />
              <Text style={styles.downloadText}>Receipt</Text>
            </TouchableOpacity>
          ) : (
            <Badge label="REVERSAL" variant="error" size="sm" />
          )}
        </View>
      </GlassCard>
    );
  };

  return (
    <Screen>
      <PageHeader title="Payments" />
      {/* ── Top Navigation & Collect ──────────────────────────────── */}
      <View style={styles.headerLinks}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/(tabs)/payments/dues')}
          accessibilityRole="button"
        >
          <FileText color={theme.colors.primary} size={20} />
          <Text style={styles.navButtonText}>View Pending Dues</Text>
          <ChevronRight color={theme.colors.primary} size={18} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        <Button
          title="Collect Payment"
          onPress={() => router.push('/(tabs)/payments/collect')}
          size="md"
        />
      </View>

      {/* ── Filters Section ───────────────────────────────────────── */}
      <View style={styles.filtersSection}>
        <FilterChips
          options={[
            { label: PAYMENTS.FILTER_TODAY, value: 'TODAY' },
            { label: PAYMENTS.FILTER_WEEK, value: 'WEEK' },
            { label: PAYMENTS.FILTER_MONTH, value: 'MONTH' },
            { label: 'All time', value: 'ALL' },
          ]}
          selectedValue={dateFilter}
          onSelect={setDateFilter}
        />
        <View style={{ height: theme.spacing.xs }} />
        <FilterChips
          options={[
            { label: PAYMENTS.FILTER_ALL_MODE, value: 'ALL' },
            { label: PAYMENTS.FILTER_CASH, value: 'CASH' },
            { label: PAYMENTS.FILTER_UPI, value: 'UPI' },
            { label: PAYMENTS.FILTER_CARD, value: 'CARD' },
          ]}
          selectedValue={modeFilter}
          onSelect={setModeFilter}
        />
      </View>

      {isLoading && !isRefetching && rawPayments.length === 0 ? (
        <LoadingSkeleton />
      ) : isError ? (
        <ErrorState message={PAYMENTS.LOAD_ERROR} onRetry={() => refetch()} />
      ) : (
        <FlatList
          data={rawPayments}
          keyExtractor={(item, index) => item?.id || `payment-${index}`}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: getScreenBottomPadding(insets.bottom) },
          ]}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={<EmptyState type="payments" message={PAYMENTS.EMPTY} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLinks: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  navButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.raised,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 48,
    marginBottom: theme.spacing.sm,
  },
  navButtonText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    marginLeft: theme.spacing.md,
  },
  filtersSection: {
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 110,
    flexGrow: 1,
  },
  card: {
    marginBottom: theme.spacing.sm,
  },
  cardInner: {
    padding: theme.spacing.md,
  },
  cardReversed: {
    opacity: 0.65,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  amount: {
    ...theme.typography.h3,
    color: theme.colors.primary,
  },
  textReversed: {
    color: theme.colors.error,
    textDecorationLine: 'line-through',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  dateText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: 8,
  },
  receiptText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  downloadText: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontWeight: '600',
  },

  // Desktop Specific Styles
  desktopTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 16,
  },
  desktopTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    flex: 1,
  },
  desktopScreenTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 22,
    color: '#DAF1DE',
    fontWeight: '700',
  },
  desktopSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(11, 43, 38, 0.8)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.14)',
    paddingHorizontal: 12,
    width: 320,
    height: 42,
  },
  desktopSearchInput: {
    flex: 1,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    color: '#DAF1DE',
  },
  desktopTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  desktopPendingDuesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(11, 43, 38, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(142, 182, 155, 0.3)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  desktopPendingDuesText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 13,
    color: '#DAF1DE',
  },
  desktopFiltersBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  desktopContentRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 20,
    minHeight: 560,
  },
  desktopTableCard: {
    flex: 1,
    backgroundColor: '#072728',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.1)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  desktopTableScroll: {
    flex: 1,
  },
  desktopTableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0B2B26',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.12)',
    ...(Platform.OS === 'web'
      ? ({
          position: 'sticky',
          top: 0,
          zIndex: 10,
        } as any)
      : {}),
  },
  tableTh: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 11,
    color: 'rgba(218, 241, 222, 0.65)',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  desktopTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.05)',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'background 0.15s ease',
        } as any)
      : {}),
  },
  desktopTableRowSelected: {
    backgroundColor: 'rgba(142, 182, 155, 0.14)',
    borderLeftWidth: 3,
    borderLeftColor: '#8EB69B',
  },
  desktopTableRowReversal: {
    opacity: 0.6,
  },
  tableTd: {
    paddingRight: 8,
  },
  tableMemberName: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 13,
    color: '#DAF1DE',
    fontWeight: '600',
  },
  tableText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    color: 'rgba(218, 241, 222, 0.75)',
  },
  tableAmountText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 13,
    color: '#8EB69B',
  },
  textReversal: {
    color: theme.colors.error,
    textDecorationLine: 'line-through',
  },
  desktopEmptyTable: {
    padding: 32,
    alignItems: 'center',
  },
  desktopPagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(218, 241, 222, 0.08)',
    backgroundColor: 'rgba(5, 31, 32, 0.5)',
  },
  paginationText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  paginationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(218, 241, 222, 0.08)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  pageBtnDisabled: {
    opacity: 0.4,
    ...(Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as any) : {}),
  },
  pageBtnText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: '#DAF1DE',
  },
  pageBtnTextDisabled: {
    color: 'rgba(218, 241, 222, 0.4)',
  },
  pageNumberText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.primary,
  },

  // Detail Panel
  desktopDetailPanel: {
    width: 380,
    backgroundColor: '#072728',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.1)',
    overflow: 'hidden',
  },
  detailScroll: {
    padding: 20,
  },
  detailReceiptTop: {
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.08)',
  },
  receiptIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(142, 182, 155, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  receiptTitle: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 13,
    color: theme.colors.textMuted,
    letterSpacing: 0.8,
  },
  receiptNumberText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: 'rgba(218, 241, 222, 0.6)',
    marginTop: 2,
  },
  receiptBigAmount: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 26,
    color: '#DAF1DE',
    marginTop: 8,
  },
  detailCard: {
    backgroundColor: 'rgba(11, 43, 38, 0.6)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.08)',
    padding: 14,
    marginTop: 16,
  },
  detailSectionTitle: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 11,
    color: theme.colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  detailInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.04)',
  },
  detailLabel: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  detailValue: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: '#DAF1DE',
    fontWeight: '500',
  },
  detailActionsCol: {
    gap: 10,
    marginTop: 20,
  },
  reversedNoticeText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: theme.colors.error,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  emptyDetailPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyDetailText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
