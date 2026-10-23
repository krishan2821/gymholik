import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { safeNotificationAsync, NotificationFeedbackType } from '../../../src/utils/safeHaptics';
import {
  Search,
  Users,
  AlertCircle,
  CheckCircle,
  QrCode,
  Calendar as CalendarIcon,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme, useStyles, ThemeValue } from '../../../src/theme/ThemeContext';
import { formatMoney, formatDate, formatTime } from '../../../src/utils/formatters';
import { useMembers, Member } from '../../../src/api/members';
import { useTodayAttendance, useCheckIn, AttendanceRecord } from '../../../src/api/attendance';
import { Screen, getScreenBottomPadding } from '../../../src/components/Screen';
import { PageHeader } from '../../../src/components/PageHeader';
import { GlassCard } from '../../../src/components/GlassCard';
import { Button } from '../../../src/components/Button';
import { Avatar } from '../../../src/components/Avatar';
import { Badge } from '../../../src/components/Badge';
import { LoadingSkeleton } from '../../../src/components/LoadingSkeleton';
import { EmptyState } from '../../../src/components/EmptyState';
import { CheckInSuccessModal } from '../../../src/components/CheckInSuccessModal';
import { MaskedPhone } from '../../../src/components/MaskedPhone';
import Toast from 'react-native-toast-message';
import { ATTENDANCE } from '../../../src/constants/strings';
import { useAuthStore } from '../../../src/store/useAuthStore';

export default function AttendanceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const rawInsets = useSafeAreaInsets();
  const insets = Platform.OS === 'web' ? { top: 0, right: 0, bottom: 0, left: 0 } : (rawInsets ?? { top: 0, right: 0, bottom: 0, left: 0 });
  const user = useAuthStore((state) => state.user);
  const role = user?.role || useAuthStore((state) => state.role);
  const isTrainer = role === 'TRAINER';
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');

  const [successBanner, setSuccessBanner] = useState<{ visible: boolean; member?: Member }>({
    visible: false,
  });
  const [expiredWarning, setExpiredWarning] = useState<{ visible: boolean; member?: Member }>({
    visible: false,
  });

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dateStr = selectedDate.toISOString().split('T')[0];
  const isToday = new Date().toISOString().split('T')[0] === dateStr;

  const { data: searchData, isFetching: isSearching } = useMembers({
    term: debouncedTerm,
    status: 'ALL',
  });
  const { data: todayList, isLoading, refetch, isRefetching } = useTodayAttendance(dateStr);
  const checkInMutation = useCheckIn();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const searchResults =
    debouncedTerm.length > 1 ? searchData?.pages.flatMap((p) => p.content) || [] : [];

  const sortedTodayList = todayList
    ? [...todayList].sort(
        (a, b) =>
          new Date(b.checkInTime as any).getTime() - new Date(a.checkInTime as any).getTime()
      )
    : [];

  const handleCheckIn = async (member: Member, force: boolean = false) => {
    const isExpired = member.currentMembership?.status === 'EXPIRED';
    const duePaise = member.currentMembership?.duePaise ?? member.currentDuePaise ?? 0;
    const hasDue = !isTrainer && duePaise > 0;

    if ((isExpired || hasDue) && !force) {
      safeNotificationAsync(NotificationFeedbackType.Warning).catch(() => {});
      setExpiredWarning({ visible: true, member });
      return;
    }

    try {
      const res = await checkInMutation.mutateAsync({ memberId: member.id, method: 'MANUAL' });

      if (res.data?.warning) {
        Toast.show({ type: 'info', text1: 'Warning', text2: 'Membership is expired.' });
      }

      setSearchTerm('');
      setDebouncedTerm('');
      setExpiredWarning({ visible: false });

      safeNotificationAsync(NotificationFeedbackType.Success).catch(() => {});
      setSuccessBanner({ visible: true, member });
      setTimeout(() => setSuccessBanner({ visible: false }), 2000);
    } catch (e: any) {
      safeNotificationAsync(NotificationFeedbackType.Error).catch(() => {});
      const msg = e.response?.data?.message || ATTENDANCE.LOAD_ERROR;
      if (msg.toLowerCase().includes('already checked in')) {
        Toast.show({
          type: 'info',
          text1: ATTENDANCE.ALREADY_CHECKED_IN_TITLE,
          text2: ATTENDANCE.ALREADY_CHECKED_IN(member.name),
        });
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: msg });
      }
    }
  };

  const renderSearchResult = ({ item }: { item: Member }) => {
    const due = item.currentMembership?.duePaise ?? item.currentDuePaise ?? 0;
    return (
      <TouchableOpacity
        style={styles.searchResultItem}
        onPress={() => handleCheckIn(item)}
        activeOpacity={0.8}
      >
        <Avatar photoUrl={item.photoUrl} name={item.name} size="sm" />
        <View style={styles.resultInfo}>
          <Text style={styles.resultName}>{item.name}</Text>
          <MaskedPhone phone={item.phone} textStyle={styles.resultPhone} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {item.currentMembership?.status === 'EXPIRED' && (
            <Badge label="Expired" variant="expired" size="sm" />
          )}
          {!isTrainer && due > 0 && (
            <Badge label={`Due ${formatMoney(due)}`} variant="due" size="sm" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderTodayItem = ({ item }: { item: AttendanceRecord }) => (
    <GlassCard style={styles.todayCard} contentStyle={styles.todayCardContent}>
      <View style={styles.todayItemLeft}>
        <View style={styles.checkIconWrapper}>
          <CheckCircle color={colors.primary} size={18} />
        </View>
        <View style={styles.todayTextWrapper}>
          <Text style={styles.todayName}>{item.memberName}</Text>
          <Text style={styles.todayMethod}>
            Member #{item.memberCode}
          </Text>
        </View>
      </View>
      <View style={styles.todayTimeBadge}>
        <Text style={styles.todayTime}>
          {formatTime(item.checkInTime)}
        </Text>
      </View>
    </GlassCard>
  );

  return (
    <Screen safeBottom={false}>
      <PageHeader title="Check-in" />
      {/* ── Top Header Actions ────────────────────────────────────── */}
      <View style={styles.headerLinks}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Button
            title="Absent"
            variant="secondary"
            icon={<Users color={colors.text} size={18} />}
            onPress={() => router.push('/(tabs)/attendance/absent')}
            size="sm"
            style={{ minHeight: 44 }}
          />
        </View>

        <View style={{ flex: 1, marginLeft: 8 }}>
          <Button
            title="Scan QR"
            icon={<QrCode color={colors.textOnPrimary} size={18} />}
            onPress={() => router.push('/(tabs)/attendance/scan')}
            size="sm"
            style={{ minHeight: 44 }}
          />
        </View>
      </View>

      {/* ── Search Section ────────────────────────────────────────── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Search color={colors.primary} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder={isTrainer ? 'Search assigned members...' : ATTENDANCE.SEARCH_PLACEHOLDER}
            placeholderTextColor={colors.textSecondary}
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCorrect={false}
          />
          {isSearching && <Text style={styles.searchingText}>{ATTENDANCE.SEARCHING}</Text>}
        </View>

        {debouncedTerm.length > 1 && (
          <GlassCard style={styles.searchResultsContainer} contentStyle={styles.searchResultsList}>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderSearchResult}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                !isSearching ? (
                  <Text style={styles.noResultText}>{ATTENDANCE.NO_RESULTS}</Text>
                ) : null
              }
            />
          </GlassCard>
        )}
      </View>

      {/* ── Check-In Success Full-Screen Sage Pulse ────────────────── */}
      <CheckInSuccessModal
        visible={successBanner.visible}
        memberName={successBanner.member?.name}
        onDismiss={() => setSuccessBanner({ visible: false })}
      />

      {/* ── Expired Warning Modal ──────────────────────────────────── */}
      <Modal visible={expiredWarning.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.warningCard} contentStyle={styles.warningCardContent}>
            <View style={styles.warningIconCircle}>
              <AlertCircle color={colors.danger} size={36} />
            </View>
            <Text style={styles.warningTitle}>
              {(() => {
                const member = expiredWarning.member;
                const isExp = member?.currentMembership?.status === 'EXPIRED';
                const due = member?.currentMembership?.duePaise ?? member?.currentDuePaise ?? 0;
                if (isExp && due > 0 && !isTrainer) return 'Expired & Outstanding Due';
                if (due > 0 && !isTrainer) return 'Outstanding Due';
                return ATTENDANCE.WARNING_TITLE;
              })()}
            </Text>
            <Text style={styles.warningDesc}>
              {(() => {
                const member = expiredWarning.member;
                const isExp = member?.currentMembership?.status === 'EXPIRED';
                const due = member?.currentMembership?.duePaise ?? member?.currentDuePaise ?? 0;
                if (isExp && due > 0 && !isTrainer) {
                  return `${member?.name}'s membership has expired and fees are pending.`;
                }
                if (due > 0 && !isTrainer) {
                  return `${member?.name} has unpaid membership fees.`;
                }
                return ATTENDANCE.WARNING_DESC(member?.name || '');
              })()}
            </Text>

            {!isTrainer &&
              (expiredWarning.member?.currentMembership?.duePaise ??
                expiredWarning.member?.currentDuePaise ??
                0) > 0 && (
                <View style={styles.warningDueBox}>
                  <Text style={styles.warningDueLabel}>Pending Due</Text>
                  <Text style={styles.warningDueAmount}>
                    {formatMoney(
                      expiredWarning.member?.currentMembership?.duePaise ??
                        expiredWarning.member?.currentDuePaise ??
                        0
                    )}
                  </Text>
                </View>
              )}

            <View style={styles.warningActionGroup}>
              {!isTrainer &&
                (expiredWarning.member?.currentMembership?.duePaise ??
                  expiredWarning.member?.currentDuePaise ??
                  0) > 0 && (
                  <View style={{ marginBottom: 10, width: '100%' }}>
                    <Button
                      title="Collect fee"
                      onPress={() => {
                        const m = expiredWarning.member;
                        setExpiredWarning({ visible: false });
                        if (m) {
                          router.push(
                            `/(tabs)/payments/collect?memberId=${m.id}&membershipId=${m.currentMembership?.id || ''}`
                          );
                        }
                      }}
                      size="md"
                    />
                  </View>
                )}

              <View style={{ marginBottom: 10, width: '100%' }}>
                <Button
                  title={ATTENDANCE.RENEW_NOW}
                  variant={
                    !isTrainer &&
                    (expiredWarning.member?.currentMembership?.duePaise ??
                      expiredWarning.member?.currentDuePaise ??
                      0) > 0
                      ? 'secondary'
                      : 'primary'
                  }
                  onPress={() => {
                    const m = expiredWarning.member;
                    setExpiredWarning({ visible: false });
                    if (m) {
                      router.push(`/(tabs)/members/${m.id}/renew`);
                    }
                  }}
                  size="md"
                />
              </View>
            </View>

            <View style={styles.warningButtons}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setExpiredWarning({ visible: false })}
                  size="sm"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Button
                  title={ATTENDANCE.ALLOW_ANYWAY}
                  variant="danger"
                  onPress={() => {
                    if (expiredWarning.member) {
                      handleCheckIn(expiredWarning.member, true);
                    }
                  }}
                  size="sm"
                />
              </View>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* ── Today's Check-ins List Header ─────────────────────────── */}
      <View style={styles.listHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.listTitle}>
            {isToday
              ? "Today's Check-ins"
              : formatDate(selectedDate)}
          </Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{sortedTodayList.length}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.datePickerBtn}
          onPress={() => setShowDatePicker(true)}
          accessibilityLabel="Select date"
        >
          <CalendarIcon color={colors.text} size={20} />
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) setSelectedDate(date);
          }}
        />
      )}

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <FlatList
          data={sortedTodayList}
          keyExtractor={(item) => item.id}
          renderItem={renderTodayItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: getScreenBottomPadding(insets.bottom, false) },
          ]}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={<EmptyState type="attendance" message={ATTENDANCE.EMPTY} />}
        />
      )}
    </Screen>
  );
}

const makeStyles = (theme: ThemeValue) => {
  const { colors } = theme;
  return StyleSheet.create({
    headerLinks: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: theme.spacing.md,
      backgroundColor: colors.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    searchSection: {
      padding: theme.spacing.md,
      backgroundColor: colors.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      zIndex: 10,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceRaised,
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 48, // 44px+ tap target
    },
    searchInput: {
      flex: 1,
      marginLeft: theme.spacing.sm,
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 15,
      color: colors.text,
    },
    searchingText: {
      ...theme.typography.small,
      color: colors.textSecondary,
    },
    searchResultsContainer: {
      position: 'absolute',
      top: 68,
      left: theme.spacing.md,
      right: theme.spacing.md,
      maxHeight: 280,
      zIndex: 20,
      ...theme.shadows.soft,
    },
    searchResultsList: {
      padding: theme.spacing.sm,
    },
    searchResultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      minHeight: 52, // 44px+ tap target
    },
    resultInfo: {
      flex: 1,
      marginLeft: theme.spacing.md,
    },
    resultName: {
      ...theme.typography.bodyMedium,
      color: colors.text,
    },
    resultPhone: {
      ...theme.typography.caption,
      color: colors.textSecondary,
    },
    noResultText: {
      padding: theme.spacing.md,
      textAlign: 'center',
      color: colors.textSecondary,
    },
    successBanner: {
      position: 'absolute',
      top: 140,
      left: theme.spacing.lg,
      right: theme.spacing.lg,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1.5,
      borderRadius: theme.radius.lg,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      zIndex: 30,
      ...theme.shadows.glow,
    },
    successBannerInfo: {
      marginLeft: 12,
    },
    successBannerTitle: {
      ...theme.typography.h3,
      color: colors.primary,
    },
    successBannerName: {
      ...theme.typography.body,
      color: colors.text,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.scrim,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    warningCard: {
      width: '100%',
      maxWidth: 360,
    },
    warningCardContent: {
      padding: theme.spacing.xl,
      alignItems: 'center',
    },
    warningIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.chipDangerBg,
      borderWidth: 1,
      borderColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.md,
    },
    warningTitle: {
      ...theme.typography.h2,
      color: colors.text,
      marginBottom: 6,
      textAlign: 'center',
    },
    warningDesc: {
      ...theme.typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing.lg,
    },
    warningButtons: {
      flexDirection: 'row',
      width: '100%',
    },
    warningDueBox: {
      width: '100%',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: colors.chipDangerBg,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: colors.danger,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    warningDueLabel: {
      ...theme.typography.caption,
      color: colors.textSecondary,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    warningDueAmount: {
      ...theme.typography.body,
      fontSize: 18,
      fontFamily: theme.fonts.headingBold,
      color: colors.danger,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    warningActionGroup: {
      width: '100%',
      marginBottom: 4,
    },
    listHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      backgroundColor: colors.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    listTitle: {
      ...theme.typography.h3,
      color: colors.text,
    },
    countBadge: {
      marginLeft: 8,
      backgroundColor: colors.surfaceRaised,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    countText: {
      ...theme.typography.small,
      fontFamily: theme.fonts.headingBold,
      color: colors.primary,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    datePickerBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      padding: theme.spacing.md,
      paddingBottom: 110,
      flexGrow: 1,
    },
    todayCard: {
      marginBottom: theme.spacing.sm,
    },
    todayCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.md,
    },
    todayItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    checkIconWrapper: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.md,
    },
    todayTextWrapper: {
      flex: 1,
    },
    todayName: {
      ...theme.typography.bodyMedium,
      color: colors.text,
    },
    todayMethod: {
      ...theme.typography.small,
      color: colors.textSecondary,
      marginTop: 2,
    },
    todayTimeBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: theme.radius.sm,
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
    },
    todayTime: {
      ...theme.typography.caption,
      color: colors.primary,
      fontFamily: theme.fonts.headingMedium,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
  });
};
