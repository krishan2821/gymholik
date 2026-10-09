import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Download, FileText, Banknote, CreditCard, Smartphone, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../../src/theme/theme';
import { usePayments, Payment, downloadAndShareReceipt, useReversePayment } from '../../../src/api/payments';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { Screen, getScreenBottomPadding } from '../../../src/components/Screen';
import { GlassCard } from '../../../src/components/GlassCard';
import { Button } from '../../../src/components/Button';
import { Badge } from '../../../src/components/Badge';
import { FilterChips } from '../../../src/components/FilterChips';
import { LoadingSkeleton } from '../../../src/components/LoadingSkeleton';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorState } from '../../../src/components/ErrorState';
import { PAYMENTS, ERRORS, COMMON } from '../../../src/constants/strings';

export default function PaymentsHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const role = user?.role || useAuthStore((state) => state.role);
  const isOwner = role === 'OWNER';
  const isAllowed = isOwner || role === 'STAFF';

  if (!isAllowed) {
    return (
      <Screen style={styles.center}>
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  const [dateFilter, setDateFilter] = useState('MONTH');
  const [modeFilter, setModeFilter] = useState('ALL');

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
  const payments: Payment[] = (
    data?.pages.flatMap((page: any) => {
      const paged = page?.payments || page;
      if (Array.isArray(paged?.content)) return paged.content;
      if (Array.isArray(paged)) return paged;
      return [];
    }) || []
  ).filter((item): item is Payment => Boolean(item && item.id));

  const handleLongPress = (payment: Payment) => {
    if (!isOwner) return;

    Alert.prompt(
      PAYMENTS.REVERSE_TITLE,
      PAYMENTS.REVERSE_PROMPT,
      [
        { text: COMMON.CANCEL, style: 'cancel' },
        {
          text: PAYMENTS.REVERSE_BTN,
          style: 'destructive',
          onPress: (reason?: string) => {
            if (!reason) {
              Alert.alert('Error', ERRORS.REASON_REQUIRED);
              return;
            }
            reversePayment.mutate({ id: payment.id, notes: reason });
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Payment }) => {
    if (!item?.id) return null;
    return (
      <GlassCard
        style={[styles.card, item.type === 'REVERSAL' && styles.cardReversed]}
        contentStyle={styles.cardInner}
        onPress={() => handleLongPress(item)}
      >
      <View style={styles.cardHeader}>
        <Text style={[styles.name, item.type === 'REVERSAL' && styles.textReversed]}>
          {item.memberName}
        </Text>
        <Text style={[styles.amount, item.type === 'REVERSAL' && styles.textReversed]}>
          ₹{item.amountPaise / 100}
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

      {isLoading && !isRefetching && payments.length === 0 ? (
        <LoadingSkeleton />
      ) : isError ? (
        <ErrorState message={PAYMENTS.LOAD_ERROR} onRetry={() => refetch()} />
      ) : (
        <FlatList
          data={payments}
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
          ListEmptyComponent={<EmptyState message={PAYMENTS.EMPTY} />}
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
    minHeight: 44, // 44px tap target
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  downloadText: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
