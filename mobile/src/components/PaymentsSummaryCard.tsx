import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { theme } from '../theme/theme';
import { GlassCard } from './GlassCard';
import { Skeleton } from './Skeleton';
import { formatMoney } from '../utils/formatters';
import { PaymentSummaryResponse } from '../api/payments';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { ArrowUpRight, ArrowDownRight, ChevronRight, Banknote, Smartphone, CreditCard } from 'lucide-react-native';

interface SummaryCardProps {
  summary?: PaymentSummaryResponse;
  isLoading: boolean;
  onViewDues?: () => void;
}

export const PaymentsSummaryCard: React.FC<SummaryCardProps> = ({
  summary,
  isLoading,
  onViewDues,
}) => {
  const reducedMotion = usePrefersReducedMotion();
  const targetCollected = summary?.collectedPaise ?? 0;
  const [displayCollected, setDisplayCollected] = useState(targetCollected);
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLoading) return;

    if (reducedMotion) {
      setDisplayCollected(targetCollected);
      return;
    }

    animValue.setValue(0);
    const anim = Animated.timing(animValue, {
      toValue: targetCollected,
      duration: 650,
      useNativeDriver: false,
    });

    const listenerId = animValue.addListener(({ value }) => {
      setDisplayCollected(Math.round(value));
    });

    anim.start();

    return () => {
      animValue.removeListener(listenerId);
    };
  }, [targetCollected, isLoading, reducedMotion, animValue]);

  if (isLoading) {
    return (
      <GlassCard style={styles.card} contentStyle={styles.cardInner}>
        <Skeleton width={140} height={14} style={{ marginBottom: 12 }} />
        <Skeleton width={200} height={34} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={10} borderRadius={5} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={24} />
      </GlassCard>
    );
  }

  const collectedPaise = targetCollected;
  const percentChange = summary?.percentChange;
  const hasChange = percentChange !== null && percentChange !== undefined;
  const isUp = hasChange && percentChange >= 0;

  const cashPaise = summary?.byMode?.CASH?.paise ?? 0;
  const upiPaise = summary?.byMode?.UPI?.paise ?? 0;
  const cardPaise = summary?.byMode?.CARD?.paise ?? 0;
  const totalModePaise = Math.max(0, cashPaise) + Math.max(0, upiPaise) + Math.max(0, cardPaise);

  const cashPct = totalModePaise > 0 ? (Math.max(0, cashPaise) / totalModePaise) * 100 : 0;
  const upiPct = totalModePaise > 0 ? (Math.max(0, upiPaise) / totalModePaise) * 100 : 0;
  const cardPct = totalModePaise > 0 ? (Math.max(0, cardPaise) / totalModePaise) * 100 : 0;

  const pendingDuePaise = summary?.pendingDuePaise ?? 0;
  const pendingMembersCount = summary?.pendingMembersCount ?? 0;

  return (
    <GlassCard style={styles.card} contentStyle={styles.cardInner}>
      {/* Top Header Label */}
      <View style={styles.topRow}>
        <Text style={styles.label}>Collected this month</Text>
        {hasChange && (
          <View style={[styles.chip, isUp ? styles.chipUp : styles.chipDown]}>
            {isUp ? (
              <ArrowUpRight size={13} color={theme.colors.primary} />
            ) : (
              <ArrowDownRight size={13} color={theme.colors.error} />
            )}
            <Text style={[styles.chipText, isUp ? styles.chipTextUp : styles.chipTextDown]}>
              {Math.abs(percentChange)}%
            </Text>
          </View>
        )}
      </View>

      {/* Main Count-Up Amount */}
      <Text style={styles.bigAmount}>{formatMoney(displayCollected)}</Text>

      {/* Horizontal Bar Split for Cash, UPI, Card */}
      <View style={styles.splitBar}>
        {totalModePaise > 0 ? (
          <>
            {cashPct > 0 && (
              <View
                style={[
                  styles.barSegment,
                  { width: `${cashPct}%`, backgroundColor: theme.colors.primary },
                  cashPct === 100 && styles.barSingle,
                ]}
              />
            )}
            {upiPct > 0 && (
              <View
                style={[
                  styles.barSegment,
                  { width: `${upiPct}%`, backgroundColor: '#38A169' },
                  upiPct === 100 && styles.barSingle,
                ]}
              />
            )}
            {cardPct > 0 && (
              <View
                style={[
                  styles.barSegment,
                  { width: `${cardPct}%`, backgroundColor: theme.colors.warning },
                  cardPct === 100 && styles.barSingle,
                ]}
              />
            )}
          </>
        ) : (
          <View style={[styles.barSegment, { width: '100%', backgroundColor: 'rgba(218, 241, 222, 0.12)' }]} />
        )}
      </View>

      {/* Legend with percentages */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
          <Text style={styles.legendLabel}>Cash ({Math.round(cashPct)}%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#38A169' }]} />
          <Text style={styles.legendLabel}>UPI ({Math.round(upiPct)}%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.warning }]} />
          <Text style={styles.legendLabel}>Card ({Math.round(cardPct)}%)</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Coral line: Pending dues + button */}
      <View style={styles.duesRow}>
        <Text style={styles.duesText} numberOfLines={1}>
          Pending <Text style={styles.coralText}>{formatMoney(pendingDuePaise)}</Text> from {pendingMembersCount} {pendingMembersCount === 1 ? 'member' : 'members'}
        </Text>
        <TouchableOpacity
          style={styles.duesBtn}
          onPress={onViewDues}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="View Dues"
          {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
        >
          <Text style={styles.duesBtnText}>Dues</Text>
          <ChevronRight size={14} color="#DAF1DE" />
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
};

interface StaffSummaryCardProps {
  collectedPaise: number;
  isLoading: boolean;
}

export const StaffSummaryCard: React.FC<StaffSummaryCardProps> = ({
  collectedPaise,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <GlassCard style={styles.card} contentStyle={styles.cardInner}>
        <Skeleton width={140} height={14} style={{ marginBottom: 8 }} />
        <Skeleton width={160} height={28} />
      </GlassCard>
    );
  }

  return (
    <GlassCard style={styles.card} contentStyle={styles.cardInner}>
      <Text style={styles.label}>You collected today</Text>
      <Text style={styles.bigAmount}>{formatMoney(collectedPaise)}</Text>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: theme.radius.lg,
  },
  cardInner: {
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  chipUp: {
    backgroundColor: 'rgba(142, 182, 155, 0.16)',
  },
  chipDown: {
    backgroundColor: 'rgba(255, 107, 107, 0.16)',
  },
  chipText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
    marginLeft: 2,
  },
  chipTextUp: {
    color: theme.colors.primary,
  },
  chipTextDown: {
    color: theme.colors.error,
  },
  bigAmount: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 30,
    lineHeight: 36,
    color: theme.colors.text,
    marginBottom: 14,
  },
  splitBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(218, 241, 222, 0.08)',
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 10,
  },
  barSegment: {
    height: '100%',
  },
  barSingle: {
    borderRadius: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  legendLabel: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(218, 241, 222, 0.08)',
    marginBottom: 12,
  },
  duesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  duesText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.textMuted,
    flex: 1,
    marginRight: 8,
  },
  coralText: {
    color: '#FF6B6B',
    fontFamily: theme.fonts.bodyBold,
  },
  duesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(218, 241, 222, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.14)',
  },
  duesBtnText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.text,
    marginRight: 2,
  },
});
