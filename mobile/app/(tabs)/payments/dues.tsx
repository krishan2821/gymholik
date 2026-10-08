import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { MessageCircle, Wallet } from 'lucide-react-native';
import { theme } from '../../../src/theme/theme';
import { useDues, DueRecord } from '../../../src/api/payments';
import { Screen } from '../../../src/components/Screen';
import { GlassCard } from '../../../src/components/GlassCard';
import { Button } from '../../../src/components/Button';
import { ErrorState } from '../../../src/components/ErrorState';
import { EmptyState } from '../../../src/components/EmptyState';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { MaskedPhone, isPhoneMasked } from '../../../src/components/MaskedPhone';
import { DUES, ERRORS } from '../../../src/constants/strings';

export default function DuesListScreen() {
  const router = useRouter();
  const { data: dues, isLoading, isError, refetch } = useDues();
  const { role } = useAuthStore();

  if (role !== 'OWNER') {
    return (
      <Screen style={styles.center}>
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen style={styles.center}>
        <ErrorState message={DUES.LOAD_ERROR} onRetry={() => refetch()} />
      </Screen>
    );
  }

  const duesList: DueRecord[] = Array.isArray(dues)
    ? dues
    : (dues as any)?.content && Array.isArray((dues as any).content)
    ? (dues as any).content
    : [];

  const sortedDues = [...duesList].sort((a, b) => (b.totalDuePaise || 0) - (a.totalDuePaise || 0));
  const totalDue = sortedDues.reduce((sum, item) => sum + (item.totalDuePaise || 0), 0);

  const openWhatsApp = (record: DueRecord) => {
    const dueFormatted = record.totalDuePaise / 100;
    const message = DUES.WHATSAPP_MSG(record.memberName, String(dueFormatted));
    Linking.openURL(`https://wa.me/91${record.phone}?text=${encodeURIComponent(message)}`);
  };

  const renderItem = ({ item }: { item: DueRecord }) => {
    const masked = isPhoneMasked(item.phone);
    return (
      <GlassCard style={styles.card} contentStyle={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.memberInfo}>
            <Text style={styles.name}>{item.memberName}</Text>
            <MaskedPhone phone={item.phone} textStyle={styles.phone} />
          </View>
          <View style={styles.dueBox}>
            <Text style={styles.dueLabel}>Due</Text>
            <Text style={styles.dueAmount}>₹{item.totalDuePaise / 100}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <View style={{ flex: 1, marginRight: masked ? 0 : 10 }}>
            <Button
              title={DUES.COLLECT_BTN}
              icon={<Wallet color={theme.colors.textOnPrimary} size={16} />}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/payments/collect',
                  params: { memberId: item.memberId },
                })
              }
              size="sm"
            />
          </View>

          {!masked && (
            <TouchableOpacity
              style={styles.waBtn}
              onPress={() => openWhatsApp(item)}
              accessibilityRole="button"
              accessibilityLabel={`WhatsApp ${item.memberName}`}
            >
              <MessageCircle color={theme.colors.primary} size={22} />
            </TouchableOpacity>
          )}
        </View>
      </GlassCard>
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{DUES.HEADER_TOTAL}</Text>
        <Text style={styles.totalAmount}>₹{totalDue / 100}</Text>
      </View>

      <FlatList
        data={sortedDues}
        keyExtractor={(item, index) => item?.memberId || `due-${index}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState message={DUES.EMPTY} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  headerTitle: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  totalAmount: {
    ...theme.typography.display,
    color: theme.colors.error,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 40,
    flexGrow: 1,
  },
  card: {
    marginBottom: theme.spacing.md,
  },
  cardContent: {
    padding: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  memberInfo: {
    flex: 1,
  },
  name: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  phone: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  dueBox: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.35)',
  },
  dueLabel: {
    ...theme.typography.small,
    color: theme.colors.error,
  },
  dueAmount: {
    ...theme.typography.h3,
    color: theme.colors.error,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waBtn: {
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
