import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { Phone, MessageCircle } from 'lucide-react-native';
import { theme } from '../../../src/theme/theme';
import { useAbsentMembers, AbsentRecord } from '../../../src/api/attendance';
import { Screen } from '../../../src/components/Screen';
import { GlassCard } from '../../../src/components/GlassCard';
import { Avatar } from '../../../src/components/Avatar';
import { Chip } from '../../../src/components/Chip';
import { ErrorState } from '../../../src/components/ErrorState';
import { EmptyState } from '../../../src/components/EmptyState';
import { isPhoneMasked } from '../../../src/components/MaskedPhone';
import { ABSENT } from '../../../src/constants/strings';

export default function AbsentMembersScreen() {
  const [daysFilter, setDaysFilter] = useState<number>(7);

  const { data: absentMembers, isLoading, isError, refetch } = useAbsentMembers(daysFilter);

  const openWhatsApp = (record: AbsentRecord) => {
    const message = ABSENT.WHATSAPP_MSG(record.memberName);
    Linking.openURL(`https://wa.me/91${record.phone}?text=${encodeURIComponent(message)}`);
  };

  const openPhone = (record: AbsentRecord) => {
    Linking.openURL(`tel:${record.phone}`);
  };

  const renderItem = ({ item }: { item: AbsentRecord }) => {
    let lastVisitText: string = ABSENT.NEVER_VISITED;
    if (item.lastAttendanceDate) {
      const diffTime = Math.abs(new Date().getTime() - new Date(item.lastAttendanceDate).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      lastVisitText = ABSENT.DAYS_AGO(diffDays);
    }

    const masked = isPhoneMasked(item.phone);

    return (
      <GlassCard style={styles.card} contentStyle={styles.cardContent}>
        <Avatar name={item.memberName} size="md" status="expiring" />

        <View style={styles.info}>
          <Text style={styles.name}>{item.memberName}</Text>
          <Text style={styles.lastVisit}>{ABSENT.LAST_VISIT(lastVisitText)}</Text>
        </View>

        {!masked && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => openPhone(item)}
              accessibilityRole="button"
              accessibilityLabel={`Call ${item.memberName}`}
            >
              <Phone color={theme.colors.primary} size={18} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { marginLeft: 8 }]}
              onPress={() => openWhatsApp(item)}
              accessibilityRole="button"
              accessibilityLabel={`WhatsApp ${item.memberName}`}
            >
              <MessageCircle color={theme.colors.primary} size={20} />
            </TouchableOpacity>
          </View>
        )}
      </GlassCard>
    );
  };

  return (
    <Screen>
      {/* ── Segment Filter Chips ───────────────────────────────────── */}
      <View style={styles.segments}>
        {[3, 7, 15, 30].map((d) => (
          <Chip
            key={d}
            label={`${d} days`}
            selected={daysFilter === d}
            onPress={() => setDaysFilter(d)}
            style={{ marginRight: 8 }}
          />
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : isError ? (
        <ErrorState message={ABSENT.LOAD_ERROR} onRetry={() => refetch()} />
      ) : (
        <FlatList
          data={absentMembers}
          keyExtractor={(item) => item.memberId}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<EmptyState message={ABSENT.EMPTY} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segments: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 40,
    flexGrow: 1,
  },
  card: {
    marginBottom: theme.spacing.sm,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  info: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  name: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  lastVisit: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    width: 44, // 44px tap target
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
