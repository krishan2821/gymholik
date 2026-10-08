import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { History, Shield, User, Clock, ArrowRight } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import { theme } from '../../../src/theme/theme';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { useAuditLogs, AuditLogItem } from '../../../src/api/audit';
import { Screen } from '../../../src/components/Screen';
import { GlassCard } from '../../../src/components/GlassCard';
import { Badge } from '../../../src/components/Badge';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorState } from '../../../src/components/ErrorState';
import { AUDIT_LOGS, ERRORS } from '../../../src/constants/strings';

export default function AuditLogScreen() {
  const { role } = useAuthStore();
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, refetch, isRefetching } = useAuditLogs({
    page,
    size: 20,
  });

  if (role !== 'OWNER') {
    return (
      <Screen safeTop={false}>
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  if (isLoading && !isRefetching) {
    return (
      <Screen safeTop={false} style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen safeTop={false}>
        <ErrorState message={AUDIT_LOGS.LOAD_ERROR} onRetry={() => refetch()} />
      </Screen>
    );
  }

  const logs = data?.content || [];

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('DEACTIVATE') || action.includes('REJECT') || action.includes('END')) {
      return 'error';
    }
    if (action.includes('APPROVE') || action.includes('ASSIGN') || action.includes('CREATE')) {
      return 'success';
    }
    return 'neutral';
  };

  const renderLogItem = ({ item }: { item: AuditLogItem }) => {
    let formattedDate = item.timestamp;
    try {
      formattedDate = format(parseISO(item.timestamp), 'dd MMM yyyy, hh:mm a');
    } catch {
      // keep fallback
    }

    return (
      <GlassCard style={styles.logCard} contentStyle={styles.cardContent}>
        <View style={styles.topRow}>
          <Badge
            label={item.action.replace(/_/g, ' ')}
            variant={getActionBadgeVariant(item.action)}
            size="sm"
          />
          <View style={styles.timeRow}>
            <Clock size={12} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={styles.timeText}>{formattedDate}</Text>
          </View>
        </View>

        {item.details ? (
          <Text style={styles.detailsText}>{item.details}</Text>
        ) : null}

        <View style={styles.footerRow}>
          <View style={styles.actorChip}>
            <Shield size={12} color={theme.colors.primary} style={{ marginRight: 4 }} />
            <Text style={styles.actorText}>
              {item.actorRole || 'OWNER'}
            </Text>
          </View>
          {item.targetId ? (
            <Text style={styles.targetText} numberOfLines={1}>
              Target: {item.targetId.substring(0, 10)}
            </Text>
          ) : null}
        </View>
      </GlassCard>
    );
  };

  return (
    <Screen safeTop={false} contentContainerStyle={styles.container}>
      {logs.length === 0 ? (
        <EmptyState
          icon={<History size={48} color={theme.colors.primary} />}
          title={AUDIT_LOGS.EMPTY}
        />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={renderLogItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary}
            />
          }
          onEndReachedThreshold={0.5}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  logCard: {
    marginBottom: theme.spacing.md,
  },
  cardContent: {
    padding: theme.spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
  },
  detailsText: {
    ...theme.typography.body,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  actorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.raised,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  actorText: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingSemiBold,
  },
  targetText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
  },
});
