import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../theme/theme';
import { GlassCard } from './GlassCard';
import { Avatar } from './Avatar';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { formatMoney, formatDate, isPhoneMasked } from '../utils/formatters';
import { useDues, DueItem } from '../api/payments';
import { useAuthStore } from '../store/useAuthStore';
import { useGymProfile } from '../api/more';
import { safeOpenURL } from '../utils/safeLinking';
import { Calendar, AlertCircle, Clock, CheckCircle2, Send, Wallet } from 'lucide-react-native';

interface DuesTabProps {
  searchQuery?: string;
  onSelectMember: (memberId: string) => void;
  onCollectForMember?: (memberId: string, membershipId?: string) => void;
}

export const DuesTab: React.FC<DuesTabProps> = ({
  searchQuery,
  onSelectMember,
  onCollectForMember,
}) => {
  const router = useRouter();
  const [filter, setFilter] = useState<'ALL' | 'OVERDUE' | 'EXPIRING' | 'PARTIAL'>('ALL');
  const { data: duesData, isLoading, isError, refetch, isRefetching } = useDues(filter, searchQuery);

  const user = useAuthStore((s) => s.user);
  const role = user?.role || useAuthStore((s) => s.role);
  const isOwner = role === 'OWNER';
  const isStaff = role === 'STAFF';

  const { data: gymProfile } = useGymProfile({ enabled: isOwner || isStaff });

  // Sorted dues by due amount largest first
  const duesList = useMemo(() => {
    const items = duesData?.items || duesData?.content || [];
    return [...items].sort((a, b) => (b.duePaise || 0) - (a.duePaise || 0));
  }, [duesData]);

  const totalPendingPaise = duesData?.totalDuePaise ?? duesList.reduce((acc, cur) => acc + (cur.duePaise || 0), 0);
  const totalPendingCount = duesData?.count ?? duesList.length;

  const handleCollect = (item: DueItem) => {
    if (onCollectForMember) {
      onCollectForMember(item.memberId, item.membershipId);
    } else {
      router.push({
        pathname: '/(tabs)/payments/collect',
        params: {
          memberId: item.memberId,
          membershipId: item.membershipId,
        },
      });
    }
  };

  const handleRemindWhatsApp = (item: DueItem) => {
    if (!item.phone) return;
    const digits = item.phone.replace(/\D/g, '');
    const cleanPhone = digits.length === 10 ? `91${digits}` : digits;
    const memberName = item.name || item.memberName || 'Member';
    const dueFormatted = (item.duePaise / 100).toLocaleString('en-IN');
    const gymName = gymProfile?.name || 'our gym';
    const msg = `Hi ${memberName}, your fees of Rs ${dueFormatted} are pending at ${gymName}. Please pay at the gym. Thank you.`;
    safeOpenURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`);
  };

  const renderDueRow = ({ item }: { item: DueItem }) => {
    const isOverdue = (item.daysOverdue ?? 0) > 0;
    const isBroken = Boolean(item.promiseBroken);
    const memberName = item.name || item.memberName || 'Member';
    const isUpcoming = item.status === 'UPCOMING' || (Boolean(item.memberships?.length) && item.memberships!.every(m => m.status === 'UPCOMING'));
    const hasAdvance = isUpcoming || Boolean(item.memberships?.some(m => m.status === 'UPCOMING' && m.duePaise > 0));

    // Role check for full unmasked phone
    const canSeeFullPhone = isOwner || (isStaff && Boolean(gymProfile?.staffCanSeeFullPhone));
    const showRemind = canSeeFullPhone && item.phone && !isPhoneMasked(item.phone);

    return (
      <GlassCard
        style={styles.card}
        contentStyle={styles.cardInner}
        onPress={() => onSelectMember(item.memberId)}
      >
        <View style={styles.topRow}>
          <Avatar name={memberName} size="md" style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={styles.name} numberOfLines={1}>
                {memberName}
              </Text>
              {hasAdvance && (
                <View style={styles.upcomingBadge}>
                  <Text style={styles.upcomingBadgeText}>Advance</Text>
                </View>
              )}
            </View>
            <Text style={styles.planSub}>
              {item.planName || 'Membership'}
              {item.memberCode ? ` • ${item.memberCode}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
            <Text style={styles.dueAmount}>{formatMoney(item.duePaise)}</Text>
            {item.totalPaise > 0 && (
              <Text style={styles.totalSub}>of {formatMoney(item.totalPaise)}</Text>
            )}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.badgeCol}>
            {isBroken ? (
              <View style={styles.brokenBadge}>
                <AlertCircle size={13} color="#FF6B6B" />
                <Text style={styles.brokenBadgeText}>Promise broken</Text>
              </View>
            ) : item.promisedDate ? (
              <View style={styles.promisedBadge}>
                <Clock size={13} color={theme.colors.warning} />
                <Text style={styles.promisedBadgeText}>
                  Promised {formatDate(item.promisedDate)}
                </Text>
              </View>
            ) : isOverdue ? (
              <View style={styles.overdueBadge}>
                <AlertCircle size={13} color="#FF6B6B" />
                <Text style={styles.overdueBadgeText}>
                  {item.daysOverdue} days overdue
                </Text>
              </View>
            ) : isUpcoming ? (
              <View style={styles.upcomingBadge}>
                <Clock size={13} color={theme.colors.cyan || '#4ECDC4'} />
                <Text style={styles.upcomingBadgeText}>Upcoming</Text>
              </View>
            ) : item.expiryDate ? (
              <View style={styles.expiryBadge}>
                <Calendar size={13} color={theme.colors.textMuted} />
                <Text style={styles.expiryBadgeText}>
                  {item.daysToExpiry !== undefined && item.daysToExpiry <= 7
                    ? `Expires in ${item.daysToExpiry} days`
                    : `Exp: ${formatDate(item.expiryDate)}`}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.actionsRow}>
            {showRemind && (
              <TouchableOpacity
                style={styles.remindBtn}
                onPress={() => handleRemindWhatsApp(item)}
                accessibilityRole="button"
                accessibilityLabel="Remind member on WhatsApp"
              >
                <Send size={13} color={theme.colors.text} style={{ marginRight: 4 }} />
                <Text style={styles.remindBtnText}>Remind</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.collectBtn}
              onPress={() => handleCollect(item)}
              accessibilityRole="button"
              accessibilityLabel="Collect fee"
            >
              <Wallet size={13} color={theme.colors.textOnPrimary} style={{ marginRight: 4 }} />
              <Text style={styles.collectBtnText}>Collect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </GlassCard>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Summary Header ────────────────────────────────────────────── */}
      <View style={styles.headerSummaryRow}>
        <Text style={styles.headerSummaryText}>
          <Text style={styles.headerSummaryAmount}>{formatMoney(totalPendingPaise)}</Text>{' '}
          pending from {totalPendingCount} {totalPendingCount === 1 ? 'member' : 'members'}
        </Text>
      </View>

      {/* ── Sub Filter Chips ─────────────────────────────────────────── */}
      <View style={styles.chipsRow}>
        {[
          { key: 'ALL', label: 'All' },
          { key: 'OVERDUE', label: 'Overdue' },
          { key: 'EXPIRING', label: 'Expiring soon' },
          { key: 'PARTIAL', label: 'Partial' },
        ].map(({ key, label }) => {
          const isSelected = filter === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.chip, isSelected && styles.chipActive]}
              onPress={() => setFilter(key as any)}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── List ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={{ paddingHorizontal: 20 }}>
          {[1, 2, 3, 4].map((k) => (
            <GlassCard key={k} style={styles.card} contentStyle={styles.cardInner}>
              <Skeleton width="50%" height={16} style={{ marginBottom: 8 }} />
              <Skeleton width="30%" height={12} style={{ marginBottom: 12 }} />
              <Skeleton width="100%" height={14} />
            </GlassCard>
          ))}
        </View>
      ) : isError ? (
        <ErrorState message="Failed to load dues list" onRetry={refetch} />
      ) : duesList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.checkIconCircle}>
            <CheckCircle2 color={theme.colors.primary} size={48} strokeWidth={2.2} />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No matching dues' : 'No pending dues. All fees are collected.'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery ? 'Try another search term' : 'Every active membership is fully settled.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={duesList}
          keyExtractor={(item) => item.membershipId || item.memberId}
          renderItem={renderDueRow}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 110 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSummaryRow: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
  },
  headerSummaryText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  headerSummaryAmount: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 16,
    color: '#FF6B6B',
  },
  chipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(218, 241, 222, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.12)',
    minHeight: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.text,
  },
  chipTextActive: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.textOnPrimary,
  },
  card: {
    marginBottom: 10,
    borderRadius: theme.radius.md,
  },
  cardInner: {
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  name: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 15,
    color: theme.colors.text,
  },
  planSub: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  dueAmount: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 16,
    color: '#FF6B6B',
  },
  totalSub: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(218, 241, 222, 0.06)',
    paddingTop: 10,
  },
  badgeCol: {
    flex: 1,
    marginRight: 8,
  },
  brokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  brokenBadgeText: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 11,
    color: '#FF6B6B',
  },
  promisedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  promisedBadgeText: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 11,
    color: theme.colors.warning,
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  overdueBadgeText: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 11,
    color: '#FF6B6B',
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expiryBadgeText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  upcomingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.cyanBg || 'rgba(78, 205, 196, 0.15)',
    borderWidth: 1,
    borderColor: theme.colors.cyanBorder || 'rgba(78, 205, 196, 0.40)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
  },
  upcomingBadgeText: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 11,
    color: theme.colors.cyan || '#4ECDC4',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  remindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(218, 241, 222, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    minHeight: 36,
  },
  remindBtnText: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 12,
    color: theme.colors.text,
  },
  collectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    minHeight: 36,
  },
  collectBtnText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    color: theme.colors.textOnPrimary,
  },
  emptyContainer: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(142, 182, 155, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
