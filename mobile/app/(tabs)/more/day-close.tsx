import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Coins,
  FileText,
} from 'lucide-react-native';
import { useTheme, useStyles, ThemeValue } from '../../../src/theme/ThemeContext';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { useCurrentUser } from '../../../src/api/auth';
import {
  useDayCloseReport,
  useSubmitDayClose,
  DayCloseReport,
} from '../../../src/api/payments';
import { Screen } from '../../../src/components/Screen';
import { PageHeader } from '../../../src/components/PageHeader';
import { GlassCard } from '../../../src/components/GlassCard';
import { Button } from '../../../src/components/Button';
import { Badge } from '../../../src/components/Badge';
import { formatMoney } from '../../../src/utils/formatters';
import { safeBack } from '../../../src/utils/navigation';
import { ERRORS, COMMON } from '../../../src/constants/strings';

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function DayCloseScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { role } = useAuthStore();
  const { data: currentUser } = useCurrentUser();
  const isOwner = (currentUser?.role || role) === 'OWNER';

  const todayStr = useMemo(() => formatDateISO(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [countedCash, setCountedCash] = useState<string>('');
  const [note, setNote] = useState<string>('');

  // Guard: OWNER only
  useEffect(() => {
    if (role && !isOwner) {
      router.replace('/(tabs)/more');
    }
  }, [role, isOwner, router]);

  const {
    data: report,
    isLoading,
    isError,
    refetch,
  } = useDayCloseReport(selectedDate, isOwner);

  const submitMutation = useSubmitDayClose();

  // Populate when report loads with existing day-close data
  useEffect(() => {
    if (report?.dayClose) {
      const rupees = Math.round((report.dayClose.countedCashPaise || 0) / 100);
      setCountedCash(String(rupees));
      setNote(report.dayClose.note || '');
    } else {
      setCountedCash('');
      setNote('');
    }
  }, [report, selectedDate]);

  if (!isOwner) {
    return null;
  }

  const changeDateByDays = (delta: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + delta);
    setSelectedDate(formatDateISO(date));
  };

  const expectedPaise = report?.expectedCashPaise || 0;
  const countedPaise = Math.round((parseFloat(countedCash) || 0) * 100);
  const isCountedEntered = countedCash.trim().length > 0 && !isNaN(Number(countedCash));
  const differencePaise = isCountedEntered ? countedPaise - expectedPaise : 0;

  const handleSubmit = async () => {
    if (!isCountedEntered) {
      Toast.show({
        type: 'error',
        text1: 'Enter counted cash',
        text2: 'Please count the physical cash in drawer and enter the amount.',
      });
      return;
    }

    try {
      await submitMutation.mutateAsync({
        date: selectedDate,
        countedCashPaise: countedPaise,
        note: note.trim() || undefined,
      });
    } catch {
      // Error handled by mutation toast
    }
  };

  const isToday = selectedDate === todayStr;

  return (
    <Screen safeTop={false} scrollable keyboardAvoiding contentContainerStyle={styles.container}>
      {/* ── Date Navigator ────────────────────────────────────────── */}
      <GlassCard style={styles.dateCard} contentStyle={styles.dateCardContent}>
        <View style={styles.dateNavRow}>
          <TouchableOpacity
            style={styles.dateNavBtn}
            onPress={() => changeDateByDays(-1)}
            accessibilityRole="button"
            accessibilityLabel="Previous day"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft size={20} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.dateDisplay}>
            <Calendar size={18} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.dateText}>{formatDisplayDate(selectedDate)}</Text>
            {isToday ? (
              <Badge label="Today" variant="neutral" style={styles.todayBadge} />
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.dateNavBtn, isToday && styles.dateNavBtnDisabled]}
            disabled={isToday}
            onPress={() => changeDateByDays(1)}
            accessibilityRole="button"
            accessibilityLabel="Next day"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronRight
              size={20}
              color={isToday ? colors.textSecondary : colors.text}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.quickDateRow}>
          <TouchableOpacity
            style={[
              styles.quickDateChip,
              selectedDate === todayStr && styles.quickDateChipActive,
            ]}
            onPress={() => setSelectedDate(todayStr)}
          >
            <Text
              style={[
                styles.quickDateText,
                selectedDate === todayStr && styles.quickDateTextActive,
              ]}
            >
              Today
            </Text>
          </TouchableOpacity>

          {(() => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = formatDateISO(yesterday);
            const isYesterday = selectedDate === yesterdayStr;
            return (
              <TouchableOpacity
                style={[styles.quickDateChip, isYesterday && styles.quickDateChipActive]}
                onPress={() => setSelectedDate(yesterdayStr)}
              >
                <Text
                  style={[
                    styles.quickDateText,
                    isYesterday && styles.quickDateTextActive,
                  ]}
                >
                  Yesterday
                </Text>
              </TouchableOpacity>
            );
          })()}
        </View>
      </GlassCard>

      {/* ── Loading / Error State ─────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching cash register details...</Text>
        </View>
      ) : isError ? (
        <GlassCard style={styles.sectionCard}>
          <Text style={styles.errorText}>Failed to load day close report.</Text>
          <Button title="Retry" variant="secondary" size="sm" onPress={() => refetch()} />
        </GlassCard>
      ) : (
        <>
          {/* ── Status Banner if Closed ───────────────────────────── */}
          {report?.isClosed ? (
            <View style={styles.closedBanner}>
              <CheckCircle2 size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.closedBannerText}>
                Day close completed for this date
              </Text>
            </View>
          ) : null}

          {/* ── Expected Cash Summary Card ─────────────────────────── */}
          <GlassCard style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <Coins size={20} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Drawer Reconciliation</Text>
            </View>

            <View style={styles.expectedBox}>
              <Text style={styles.expectedLabel}>EXPECTED CASH IN DRAWER</Text>
              <Text style={styles.expectedAmount}>{formatMoney(expectedPaise)}</Text>
              <Text style={styles.expectedSub}>
                Calculated from cash collections minus reversals for the day
              </Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Total Collected</Text>
                <Text style={styles.statValue}>
                  {formatMoney(report?.totalCollectedPaise || 0)}
                </Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Payments Count</Text>
                <Text style={styles.statValue}>{report?.count || 0}</Text>
              </View>
            </View>

            {report?.byMode ? (
              <View style={styles.modeBreakdown}>
                <Text style={styles.breakdownTitle}>Collections by Mode</Text>
                <View style={styles.modeRow}>
                  <Text style={styles.modeName}>Cash</Text>
                  <Text style={styles.modeAmount}>
                    {formatMoney(report.byMode.CASH || 0)}
                  </Text>
                </View>
                <View style={styles.modeRow}>
                  <Text style={styles.modeName}>UPI</Text>
                  <Text style={styles.modeAmount}>
                    {formatMoney(report.byMode.UPI || 0)}
                  </Text>
                </View>
                <View style={styles.modeRow}>
                  <Text style={styles.modeName}>Card</Text>
                  <Text style={styles.modeAmount}>
                    {formatMoney(report.byMode.CARD || 0)}
                  </Text>
                </View>
              </View>
            ) : null}
          </GlassCard>

          {/* ── Counted Cash Input & Difference ────────────────────── */}
          <GlassCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Physical Cash Count</Text>
            <Text style={styles.sectionDesc}>
              Enter the total cash counted in the drawer at close.
            </Text>

            <View style={styles.inputRow}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.cashInput}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={countedCash}
                onChangeText={setCountedCash}
              />
              <TouchableOpacity
                style={styles.matchBtn}
                onPress={() => setCountedCash(String(Math.round(expectedPaise / 100)))}
                accessibilityRole="button"
                accessibilityLabel="Match expected cash"
              >
                <Text style={styles.matchBtnText}>Match</Text>
              </TouchableOpacity>
            </View>

            {/* Live Difference Box */}
            {isCountedEntered ? (
              <View
                style={[
                  styles.diffBox,
                  differencePaise === 0
                    ? styles.diffBalanced
                    : differencePaise < 0
                    ? styles.diffShortfall
                    : styles.diffExcess,
                ]}
              >
                <View style={styles.diffHeader}>
                  {differencePaise === 0 ? (
                    <CheckCircle2 size={18} color={colors.primary} />
                  ) : (
                    <AlertTriangle
                      size={18}
                      color={
                        differencePaise < 0
                          ? colors.danger
                          : colors.warning
                      }
                    />
                  )}
                  <Text
                    style={[
                      styles.diffTitle,
                      differencePaise === 0
                        ? styles.diffBalancedText
                        : differencePaise < 0
                        ? styles.diffShortfallText
                        : styles.diffExcessText,
                    ]}
                  >
                    {differencePaise === 0
                      ? 'Balanced (₹0 difference)'
                      : differencePaise < 0
                      ? `Shortfall of ${formatMoney(Math.abs(differencePaise))}`
                      : `Excess of +${formatMoney(differencePaise)}`}
                  </Text>
                </View>
                <Text style={styles.diffExplanation}>
                  {differencePaise === 0
                    ? 'Counted cash exactly matches payments recorded in Gymholik.'
                    : differencePaise < 0
                    ? 'Drawer is missing cash compared to recorded payments.'
                    : 'Drawer has surplus cash above recorded payments.'}
                </Text>
              </View>
            ) : null}

            {/* Optional Note */}
            <Text style={[styles.label, { marginTop: 16 }]}>Notes / Remarks (Optional)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="e.g. ₹50 change deficit due to rounding"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              value={note}
              onChangeText={setNote}
            />

            <View style={{ marginTop: 24 }}>
              <Button
                title={report?.isClosed ? 'Update Day Close' : 'Save & Close Day'}
                variant="primary"
                size="lg"
                loading={submitMutation.isPending}
                disabled={submitMutation.isPending || !isCountedEntered}
                onPress={handleSubmit}
              />
            </View>
          </GlassCard>

          {/* ── Staff Collection Breakdown ─────────────────────────── */}
          {report?.staffBreakdown && report.staffBreakdown.length > 0 ? (
            <GlassCard style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <User size={18} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>Staff Collections</Text>
              </View>
              {report.staffBreakdown.map((item, idx) => (
                <View key={item.userId || idx} style={styles.staffRow}>
                  <View>
                    <Text style={styles.staffName}>{item.name || 'Staff'}</Text>
                    <Text style={styles.staffRole}>{item.role}</Text>
                  </View>
                  <Text style={styles.staffAmount}>
                    {formatMoney(item.amountPaise)}
                  </Text>
                </View>
              ))}
            </GlassCard>
          ) : null}
        </>
      )}

      <View style={{ height: 40 }} />
    </Screen>
  );
}

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  centered: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 12,
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.danger,
    marginBottom: 12,
  },
  dateCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
  },
  dateCardContent: {
    gap: 12,
  },
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateNavBtnDisabled: {
    opacity: 0.35,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 17,
    color: theme.colors.text,
  },
  todayBadge: {
    marginLeft: 8,
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  quickDateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 32,
    justifyContent: 'center',
  },
  quickDateChipActive: {
    backgroundColor: theme.colors.surfaceRaised,
    borderColor: theme.colors.primary,
  },
  quickDateText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  quickDateTextActive: {
    color: theme.colors.primary,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: 12,
    marginBottom: theme.spacing.lg,
  },
  closedBannerText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 14,
    color: theme.colors.primary,
  },
  sectionCard: {
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 17,
    color: theme.colors.text,
  },
  sectionDesc: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 4,
    marginBottom: theme.spacing.md,
  },
  expectedBox: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  expectedLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    letterSpacing: 0.8,
  },
  expectedAmount: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 32,
    color: theme.colors.primary,
    marginVertical: 4,
  },
  expectedSub: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
    gap: 12,
  },
  statCol: {
    flex: 1,
    backgroundColor: theme.colors.surfaceRaised,
    padding: 12,
    borderRadius: theme.radius.md,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  statValue: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 16,
    color: theme.colors.text,
    marginTop: 2,
  },
  modeBreakdown: {
    marginTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
  },
  breakdownTitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  modeName: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  modeAmount: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    minHeight: 56,
    marginBottom: theme.spacing.md,
  },
  currencyPrefix: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 22,
    color: theme.colors.textSecondary,
    marginRight: 8,
  },
  cashInput: {
    flex: 1,
    fontFamily: theme.fonts.headingBold,
    fontSize: 24,
    color: theme.colors.text,
    paddingVertical: 8,
    fontVariant: ['tabular-nums'],
  },
  matchBtn: {
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  matchBtnText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.primary,
  },
  diffBox: {
    borderRadius: theme.radius.md,
    padding: 12,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
  },
  diffBalanced: {
    backgroundColor: theme.colors.surfaceRaised,
    borderColor: theme.colors.border,
  },
  diffShortfall: {
    backgroundColor: theme.colors.chipDangerBg,
    borderColor: theme.colors.danger,
  },
  diffExcess: {
    backgroundColor: theme.colors.chipWarningBg,
    borderColor: theme.colors.warning,
  },
  diffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diffTitle: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  diffBalancedText: {
    color: theme.colors.primary,
  },
  diffShortfallText: {
    color: theme.colors.chipDangerText,
  },
  diffExcessText: {
    color: theme.colors.chipWarningText,
  },
  diffExplanation: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 4,
    marginLeft: 26,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  noteInput: {
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingTop: 12,
    minHeight: 80,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 14,
    color: theme.colors.text,
    textAlignVertical: 'top',
  },
  staffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  staffName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 14,
    color: theme.colors.text,
  },
  staffRole: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  staffAmount: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 15,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
});
