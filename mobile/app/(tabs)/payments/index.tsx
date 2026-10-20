import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Modal,
  Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

import {
  Search,
  X,
  Plus,
  Receipt,
  RotateCcw,
  Banknote,
  Smartphone,
  CreditCard,
  ChevronDown,
  FileText,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../../src/theme/theme';
import { Screen, getScreenBottomPadding } from '../../../src/components/Screen';
import { PageHeader } from '../../../src/components/PageHeader';
import { GlassCard } from '../../../src/components/GlassCard';
import { Avatar } from '../../../src/components/Avatar';
import { Badge } from '../../../src/components/Badge';
import { Skeleton } from '../../../src/components/Skeleton';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorState } from '../../../src/components/ErrorState';
import { CollectPaymentModal } from '../../../src/components/CollectPaymentModal';
import { PaymentsSummaryCard, StaffSummaryCard } from '../../../src/components/PaymentsSummaryCard';
import { PaymentDetailSheet } from '../../../src/components/PaymentDetailSheet';
import { FilterBottomSheet, FilterOption } from '../../../src/components/FilterBottomSheet';
import { DuesTab } from '../../../src/components/DuesTab';
import { formatMoney, formatDate, formatTime, truncateMiddle } from '../../../src/utils/formatters';
import { useAuthStore } from '../../../src/store/useAuthStore';
import {
  usePayments,
  usePaymentSummary,
  useDues,
  PaymentItem,
  DayTotal,
} from '../../../src/api/payments';

// Period Options
const PERIOD_OPTIONS: FilterOption[] = [
  { label: 'Today', value: 'TODAY' },
  { label: 'This week', value: 'WEEK' },
  { label: 'This month', value: 'MONTH' },
  { label: 'All time', value: 'ALL' },
  { label: 'Custom', value: 'CUSTOM' },
];

// Mode Options
const MODE_OPTIONS: FilterOption[] = [
  { label: 'All methods', value: 'ALL' },
  { label: 'Cash', value: 'CASH' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Card', value: 'CARD' },
];

// In-session tab persistence
let sessionSelectedTab: 'HISTORY' | 'DUES' = 'HISTORY';

export default function PaymentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: 'HISTORY' | 'DUES'; period?: string }>();
  const rawInsets = useSafeAreaInsets();
  const insets = Platform.OS === 'web' ? { top: 0, right: 0, bottom: 0, left: 0 } : (rawInsets ?? { top: 0, right: 0, bottom: 0, left: 0 });
  const user = useAuthStore((state) => state.user);
  const role = user?.role || useAuthStore((state) => state.role);
  const isOwner = role === 'OWNER';
  const isAllowed = isOwner || role === 'STAFF';

  // State
  const initialTab = params.tab === 'DUES' || params.tab === 'HISTORY' ? params.tab : sessionSelectedTab;
  const [selectedTab, setSelectedTab] = useState<'HISTORY' | 'DUES'>(initialTab);
  const [showSearch, setShowSearch] = useState(false);
  const [rawSearchQuery, setRawSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  // Filters
  const [periodFilter, setPeriodFilter] = useState<string>(params.period || 'MONTH');
  const [modeFilter, setModeFilter] = useState<string>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showCustomDateModal, setShowCustomDateModal] = useState<boolean>(false);
  const [tempStartDate, setTempStartDate] = useState<string>('');
  const [tempEndDate, setTempEndDate] = useState<string>('');

  useEffect(() => {
    if (params.tab) {
      setSelectedTab(params.tab);
      sessionSelectedTab = params.tab;
    }
    if (params.period) {
      setPeriodFilter(params.period);
    }
  }, [params.tab, params.period]);

  const [showPeriodSheet, setShowPeriodSheet] = useState(false);
  const [showModeSheet, setShowModeSheet] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Modals & Sheets
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  const shouldHideFab =
    isKeyboardVisible ||
    Boolean(selectedPaymentId) ||
    showPeriodSheet ||
    showModeSheet ||
    showCollectModal ||
    showCustomDateModal;

  // Debounce search query 400ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(rawSearchQuery.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [rawSearchQuery]);

  // Sync session tab
  const handleSelectTab = (tab: 'HISTORY' | 'DUES') => {
    sessionSelectedTab = tab;
    setSelectedTab(tab);
  };

  // Queries
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = usePaymentSummary('MONTH', undefined, undefined, isOwner);

  const {
    data: duesData,
    isLoading: isDuesLoading,
    refetch: refetchDues,
  } = useDues('ALL', undefined);

  const {
    data: paymentsPages,
    isLoading: isPaymentsLoading,
    isError: isPaymentsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchPayments,
    isRefetching: isPaymentsRefetching,
  } = usePayments({
    period: periodFilter === 'CUSTOM' ? undefined : periodFilter,
    startDate: periodFilter === 'CUSTOM' && customStartDate ? customStartDate : undefined,
    endDate: periodFilter === 'CUSTOM' && customEndDate ? customEndDate : undefined,
    mode: modeFilter,
    search: debouncedSearch,
  });

  const duesCount = duesData?.count ?? (duesData?.items?.length || 0);

  // Flatten payments and extract day totals
  const { sections, allPayments, dayTotalsMap } = useMemo(() => {
    const pages = paymentsPages?.pages || [];
    const paymentsList: PaymentItem[] = [];
    const dayTotals: Record<string, number> = {};

    pages.forEach((page) => {
      const items = page?.payments?.content || [];
      paymentsList.push(...items);

      if (page?.dayTotals) {
        page.dayTotals.forEach((dt: DayTotal) => {
          dayTotals[dt.date] = dt.totalPaise;
        });
      }
    });

    // Helper to format date header title
    const formatHeaderDate = (isoStr?: string) => {
      if (!isoStr) return 'Past Payments';
      const d = new Date(isoStr);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const dStr = d.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];
      const yestStr = yesterday.toISOString().split('T')[0];

      if (dStr === todayStr) return 'Today';
      if (dStr === yestStr) return 'Yesterday';

      return formatDate(isoStr);
    };

    // Group items by local date YYYY-MM-DD
    const groups: Record<string, { dateKey: string; title: string; data: PaymentItem[] }> = {};

    paymentsList.forEach((item) => {
      const datePart = item.paidAt ? item.paidAt.split('T')[0] : (item.createdAt ? item.createdAt.split('T')[0] : 'undated');
      if (!groups[datePart]) {
        groups[datePart] = {
          dateKey: datePart,
          title: formatHeaderDate(item.paidAt || item.createdAt),
          data: [],
        };
      }
      groups[datePart].data.push(item);
    });

    const sortedSections = Object.values(groups).map((group) => {
      const dayTotalPaise = dayTotals[group.dateKey] ?? group.data.reduce((sum, p) => {
        const amt = p.type === 'REVERSAL' ? -p.amountPaise : p.amountPaise;
        return sum + amt;
      }, 0);

      return {
        dateKey: group.dateKey,
        title: group.title,
        dayTotalPaise,
        data: group.data,
      };
    });

    return {
      sections: sortedSections,
      allPayments: paymentsList,
      dayTotalsMap: dayTotals,
    };
  }, [paymentsPages]);

  // For Staff: compute today's collected cash
  const staffCollectedToday = useMemo(() => {
    if (isOwner) return 0;
    const todayStr = new Date().toISOString().split('T')[0];
    return allPayments
      .filter((p) => {
        const d = p.paidAt ? p.paidAt.split('T')[0] : '';
        return d === todayStr;
      })
      .reduce((sum, p) => sum + (p.type === 'REVERSAL' ? -p.amountPaise : p.amountPaise), 0);
  }, [allPayments, isOwner]);

  const isDefaultFilters =
    periodFilter === 'MONTH' &&
    modeFilter === 'ALL' &&
    !debouncedSearch &&
    !customStartDate &&
    !customEndDate;

  const handleClearFilters = () => {
    setPeriodFilter('MONTH');
    setModeFilter('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setRawSearchQuery('');
    setDebouncedSearch('');
    setShowSearch(false);
  };

  const periodChipLabel = useMemo(() => {
    if (periodFilter === 'CUSTOM' && customStartDate && customEndDate) {
      return `${customStartDate} – ${customEndDate}`;
    }
    return PERIOD_OPTIONS.find((p) => p.value === periodFilter)?.label || 'Period';
  }, [periodFilter, customStartDate, customEndDate]);

  const handleSelectPeriod = (val: string) => {
    setShowPeriodSheet(false);
    if (val === 'CUSTOM') {
      const todayStr = new Date().toISOString().split('T')[0];
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthAgoStr = monthAgo.toISOString().split('T')[0];
      setTempStartDate(customStartDate || monthAgoStr);
      setTempEndDate(customEndDate || todayStr);
      setShowCustomDateModal(true);
    } else {
      setPeriodFilter(val);
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  const handleApplyCustomDates = (start: string, end: string) => {
    if (start && end) {
      setPeriodFilter('CUSTOM');
      setCustomStartDate(start);
      setCustomEndDate(end);
      setShowCustomDateModal(false);
    }
  };

  const handleRefreshAll = async () => {
    await Promise.all([
      refetchPayments(),
      refetchDues(),
      isOwner ? refetchSummary() : Promise.resolve(),
    ]);
  };

  if (!isAllowed) {
    return (
      <Screen style={styles.center}>
        <ErrorState message="You do not have permission to view payments" onRetry={() => {}} />
      </Screen>
    );
  }

  // Render a Payment Row
  const renderPaymentRow = ({ item }: { item: PaymentItem }) => {
    const isReversal = item.type === 'REVERSAL' || item.status === 'REVERSED';
    const amountSign = isReversal ? '-' : '+';
    const formattedAmount = formatMoney(item.amountPaise);

    const isMidnight = Boolean(
      item.paidAt &&
      (item.paidAt.endsWith('T00:00:00') || item.paidAt.endsWith('T00:00') || !item.paidAt.includes('T'))
    );
    const timeStr = formatTime(isMidnight && item.createdAt ? item.createdAt : (item.paidAt || item.createdAt));

    return (
      <TouchableOpacity
        style={styles.paymentRow}
        onPress={() => setSelectedPaymentId(item.id)}
        activeOpacity={0.7}
        {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
      >
        <Avatar
          name={item.memberName || 'Member'}
          size="sm"
          style={styles.rowAvatar}
        />

        <View style={styles.rowDetails}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.rowMemberName} numberOfLines={1}>
              {item.memberName || 'Member'}
            </Text>
            {isReversal && (
              <Badge label="Reversed" variant="expired" size="sm" />
            )}
          </View>
          <Text style={styles.rowSubText} numberOfLines={1}>
            {item.planName || 'Plan'} • {item.memberCode || '—'}
          </Text>
        </View>

        <View style={styles.rowRight}>
          <View style={styles.rowAmountWrap}>
            {item.mode === 'CASH' && <Banknote size={14} color={theme.colors.textMuted} style={styles.modeIcon} />}
            {item.mode === 'UPI' && <Smartphone size={14} color={theme.colors.textMuted} style={styles.modeIcon} />}
            {item.mode === 'CARD' && <CreditCard size={14} color={theme.colors.textMuted} style={styles.modeIcon} />}
            <Text
              style={[
                styles.rowAmount,
                isReversal ? styles.amountCoral : styles.amountSage,
              ]}
            >
              {amountSign}{formattedAmount}
            </Text>
          </View>
          {Boolean(timeStr) && (
            <Text style={styles.rowTimeText}>{timeStr}</Text>
          )}
          {Boolean(item.receiptNo) && (
            <Text style={styles.rowReceiptText} numberOfLines={1}>
              #{truncateMiddle(item.receiptNo, 14)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render Section Header
  const renderSectionHeader = ({ section }: { section: any }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionTotal}>{formatMoney(section.dayTotalPaise)}</Text>
    </View>
  );

  return (
    <Screen safeTop={true} safeBottom={false} contained={true}>
      {/* ── 1. Page Header with inline Search ────────────────────────── */}
      <PageHeader
        title="Payments"
        rightAction={
          <TouchableOpacity
            style={styles.headerSearchBtn}
            onPress={() => {
              setShowSearch((prev) => !prev);
              if (!showSearch) {
                setTimeout(() => searchInputRef.current?.focus(), 100);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Search Payments"
            {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
          >
            {showSearch ? (
              <X size={20} color={theme.colors.text} />
            ) : (
              <Search size={20} color={theme.colors.text} />
            )}
          </TouchableOpacity>
        }
      />

      {/* Inline Search Bar */}
      {showSearch && (
        <View style={styles.searchBarWrap}>
          <View style={styles.searchBar}>
            <Search size={16} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search member name, code or receipt #..."
              placeholderTextColor={theme.colors.textMuted}
              value={rawSearchQuery}
              onChangeText={setRawSearchQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {Boolean(rawSearchQuery) && (
              <TouchableOpacity onPress={() => setRawSearchQuery('')}>
                <X size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── 2. Summary Card ──────────────────────────────────────────── */}
      {isOwner ? (
        <PaymentsSummaryCard
          summary={summaryData}
          isLoading={isSummaryLoading}
          onViewDues={() => handleSelectTab('DUES')}
        />
      ) : (
        <StaffSummaryCard
          collectedPaise={staffCollectedToday}
          isLoading={isPaymentsLoading}
        />
      )}

      {/* ── 3. Segmented Control: History | Dues ─────────────────────── */}
      <View style={styles.segmentedControlWrap}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              selectedTab === 'HISTORY' && styles.segmentBtnActive,
            ]}
            onPress={() => handleSelectTab('HISTORY')}
            activeOpacity={0.8}
            {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
          >
            <Text
              style={[
                styles.segmentText,
                selectedTab === 'HISTORY' && styles.segmentTextActive,
              ]}
            >
              History
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              selectedTab === 'DUES' && styles.segmentBtnActive,
            ]}
            onPress={() => handleSelectTab('DUES')}
            activeOpacity={0.8}
            {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
          >
            <Text
              style={[
                styles.segmentText,
                selectedTab === 'DUES' && styles.segmentTextActive,
              ]}
            >
              Dues
            </Text>
            {duesCount > 0 && (
              <View style={styles.badgeWrap}>
                <Text style={styles.badgeCount}>{duesCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 4 & 5. History Tab View OR Dues Tab View ──────────────────── */}
      {selectedTab === 'DUES' ? (
        <DuesTab
          searchQuery={debouncedSearch}
          onSelectMember={(memberId) => router.push(`/(tabs)/members/${memberId}` as any)}
          onCollectForMember={(memberId, membershipId) => {
            router.push({
              pathname: '/(tabs)/payments/collect',
              params: {
                memberId,
                membershipId,
              },
            } as any);
          }}
        />
      ) : (
        <View style={styles.historyContainer}>
          {/* History Filters in ONE row */}
          <View style={styles.filtersRow}>
            {/* Period Chip */}
            <TouchableOpacity
              style={styles.filterChip}
              onPress={() => setShowPeriodSheet(true)}
              {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
            >
              <Text style={styles.filterChipText}>
                {periodChipLabel}
              </Text>
              <ChevronDown size={14} color={theme.colors.textMuted} style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            {/* Mode Chip */}
            <TouchableOpacity
              style={styles.filterChip}
              onPress={() => setShowModeSheet(true)}
              {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
            >
              <Text style={styles.filterChipText}>
                {MODE_OPTIONS.find((m) => m.value === modeFilter)?.label || 'All methods'}
              </Text>
              <ChevronDown size={14} color={theme.colors.textMuted} style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            {/* Clear Button when filters are active */}
            {!isDefaultFilters && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={handleClearFilters}
                {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
              >
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* List States */}
          {isPaymentsLoading ? (
            <View style={styles.skeletonList}>
              {[1, 2, 3, 4, 5].map((k) => (
                <View key={k} style={styles.skeletonRow}>
                  <Skeleton width={36} height={36} borderRadius={18} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Skeleton width="45%" height={15} style={{ marginBottom: 6 }} />
                    <Skeleton width="30%" height={12} />
                  </View>
                  <Skeleton width={60} height={18} />
                </View>
              ))}
            </View>
          ) : isPaymentsError ? (
            <ErrorState
              message="Failed to load payment history"
              onRetry={refetchPayments}
            />
          ) : sections.length === 0 ? (
            <EmptyState
              type={debouncedSearch ? 'search' : 'payments'}
              title={debouncedSearch ? 'No matching payments' : 'No payments yet'}
              message={
                debouncedSearch
                  ? 'Try searching by member name, member code or receipt number'
                  : 'No payments recorded for this selected period'
              }
              onAction={
                (summaryData?.pendingDuePaise ?? 0) > 0
                  ? () => handleSelectTab('DUES')
                  : undefined
              }
              actionLabel={
                (summaryData?.pendingDuePaise ?? 0) > 0
                  ? `View pending dues ${formatMoney(summaryData?.pendingDuePaise)}`
                  : undefined
              }
            />
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              renderItem={renderPaymentRow}
              renderSectionHeader={renderSectionHeader}
              stickySectionHeadersEnabled={true}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                  fetchNextPage();
                }
              }}
              onEndReachedThreshold={0.4}
              refreshControl={
                <RefreshControl
                  refreshing={isPaymentsRefetching}
                  onRefresh={handleRefreshAll}
                  tintColor={theme.colors.primary}
                />
              }
              ListFooterComponent={
                isFetchingNextPage ? (
                  <View style={{ paddingVertical: 16 }}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      )}

      {/* ── 8. Floating "Collect fee" Button (Bottom Right) ───────────── */}
      {!shouldHideFab && (
        <TouchableOpacity
          style={[
            styles.fabBtn,
            {
              bottom: getScreenBottomPadding(insets.bottom) - 16,
            },
          ]}
          onPress={() => router.push('/(tabs)/payments/collect' as any)}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Collect fee"
          {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
        >
          <Plus size={20} color="#051F20" strokeWidth={2.5} style={{ marginRight: 6 }} />
          <Text style={styles.fabText}>Collect fee</Text>
        </TouchableOpacity>
      )}

      {/* ── 6. Payment Detail Sheet ──────────────────────────────────── */}
      <PaymentDetailSheet
        paymentId={selectedPaymentId}
        isOwner={isOwner}
        onClose={() => setSelectedPaymentId(null)}
        onViewMember={(memberId) => router.push(`/(tabs)/members/${memberId}` as any)}
      />

      {/* ── Filter Bottom Sheets ─────────────────────────────────────── */}
      <FilterBottomSheet
        visible={showPeriodSheet}
        title="Select Period"
        options={PERIOD_OPTIONS}
        selectedValue={periodFilter}
        onSelect={handleSelectPeriod}
        onClose={() => setShowPeriodSheet(false)}
      />

      <FilterBottomSheet
        visible={showModeSheet}
        title="Select Payment Method"
        options={MODE_OPTIONS}
        selectedValue={modeFilter}
        onSelect={setModeFilter}
        onClose={() => setShowModeSheet(false)}
      />

      {/* Custom Date Range Modal */}
      {showCustomDateModal && (
        <Modal
          visible={showCustomDateModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCustomDateModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.customDateCard}>
              <View style={styles.customDateHeader}>
                <Text style={styles.customDateTitle}>Custom Date Range</Text>
                <TouchableOpacity onPress={() => setShowCustomDateModal(false)}>
                  <X size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.customDateSubtitle}>
                Enter start and end dates (YYYY-MM-DD) or pick a preset:
              </Text>

              {/* Quick Presets */}
              <View style={styles.presetsRow}>
                {[
                  { label: 'Last 7 days', days: 7 },
                  { label: 'Last 30 days', days: 30 },
                  { label: 'Last 90 days', days: 90 },
                ].map((p) => (
                  <TouchableOpacity
                    key={p.label}
                    style={styles.presetChip}
                    onPress={() => {
                      const today = new Date();
                      const start = new Date();
                      start.setDate(today.getDate() - p.days);
                      const sStr = start.toISOString().split('T')[0];
                      const eStr = today.toISOString().split('T')[0];
                      setTempStartDate(sStr);
                      setTempEndDate(eStr);
                    }}
                  >
                    <Text style={styles.presetChipText}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.dateInputsRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.dateInputLabel}>Start Date</Text>
                  <TextInput
                    style={styles.dateTextInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={theme.colors.textMuted}
                    value={tempStartDate}
                    onChangeText={setTempStartDate}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.dateInputLabel}>End Date</Text>
                  <TextInput
                    style={styles.dateTextInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={theme.colors.textMuted}
                    value={tempEndDate}
                    onChangeText={setTempEndDate}
                  />
                </View>
              </View>

              <View style={styles.customDateActions}>
                <TouchableOpacity
                  style={styles.cancelCustomBtn}
                  onPress={() => setShowCustomDateModal(false)}
                >
                  <Text style={styles.cancelCustomText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.applyCustomBtn}
                  onPress={() => handleApplyCustomDates(tempStartDate.trim(), tempEndDate.trim())}
                >
                  <Text style={styles.applyCustomText}>Apply Filter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Collect Payment Modal (Fallback modal) */}
      <CollectPaymentModal
        visible={showCollectModal}
        onClose={() => setShowCollectModal(false)}
        onSuccess={handleRefreshAll}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSearchBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(218, 241, 222, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarWrap: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 43, 38, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.16)',
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 14,
    color: theme.colors.text,
    paddingVertical: 0,
  },
  segmentedControlWrap: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(11, 43, 38, 0.8)',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.12)',
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(142, 182, 155, 0.16)',
  },
  segmentText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  segmentTextActive: {
    fontFamily: theme.fonts.headingBold,
    color: theme.colors.text,
  },
  badgeWrap: {
    marginLeft: 6,
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  badgeCount: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
    color: '#051F20',
  },
  historyContainer: {
    flex: 1,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(218, 241, 222, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
  },
  filterChipText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.text,
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  clearBtnText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  skeletonList: {
    paddingHorizontal: 20,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.04)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#051F20',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.06)',
  },
  sectionTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 13,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTotal: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 13,
    color: theme.colors.primary,
  },
  listContent: {
    paddingBottom: 110,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.05)',
  },
  rowAvatar: {
    marginRight: 12,
  },
  rowDetails: {
    flex: 1,
    marginRight: 10,
  },
  rowMemberName: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: 2,
  },
  rowSubText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  rowAmountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  modeIcon: {
    marginRight: 4,
  },
  rowAmount: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 15,
  },
  amountSage: {
    color: '#8EB69B',
  },
  amountCoral: {
    color: '#FF6B6B',
  },
  rowTimeText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  rowReceiptText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 10,
    color: theme.colors.textMuted,
    opacity: 0.85,
    marginTop: 2,
  },
  fabBtn: {
    position: 'absolute',
    right: 20,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 90,
  },
  fabText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 14,
    color: '#051F20',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.85)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: 'center',
    padding: Platform.OS === 'web' ? 16 : 0,
  },
  customDateCard: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 420 : '100%',
    backgroundColor: '#0B2B26',
    borderTopLeftRadius: Platform.OS === 'web' ? theme.radius.lg : theme.radius.xl,
    borderTopRightRadius: Platform.OS === 'web' ? theme.radius.lg : theme.radius.xl,
    borderRadius: Platform.OS === 'web' ? theme.radius.lg : undefined,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.16)',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  customDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  customDateTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 16,
    color: theme.colors.text,
  },
  customDateSubtitle: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: 14,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(218, 241, 222, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.14)',
  },
  presetChipText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.text,
  },
  dateInputsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  dateInputLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  dateTextInput: {
    backgroundColor: 'rgba(5, 31, 32, 0.7)',
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 14,
    color: theme.colors.text,
  },
  customDateActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelCustomBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
  },
  cancelCustomText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  applyCustomBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
  },
  applyCustomText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 14,
    color: '#051F20',
  },
});
