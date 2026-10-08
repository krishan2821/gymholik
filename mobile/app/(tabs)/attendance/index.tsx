import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Search,
  Users,
  AlertCircle,
  CheckCircle,
  QrCode,
  Calendar as CalendarIcon,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../../../src/theme/theme';
import { useMembers, Member } from '../../../src/api/members';
import { useTodayAttendance, useCheckIn, AttendanceRecord } from '../../../src/api/attendance';
import { Screen } from '../../../src/components/Screen';
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
    if (member.currentMembership?.status === 'EXPIRED' && !force) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
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

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      setSuccessBanner({ visible: true, member });
      setTimeout(() => setSuccessBanner({ visible: false }), 2000);
    } catch (e: any) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
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

  const renderSearchResult = ({ item }: { item: Member }) => (
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
      {item.currentMembership?.status === 'EXPIRED' && (
        <Badge label="EXPIRED" variant="error" size="sm" />
      )}
    </TouchableOpacity>
  );

  const renderTodayItem = ({ item }: { item: AttendanceRecord }) => (
    <GlassCard style={styles.todayCard} contentStyle={styles.todayCardContent}>
      <View style={styles.todayItemLeft}>
        <View style={styles.checkIconWrapper}>
          <CheckCircle color={theme.colors.primary} size={18} />
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
          {new Date(item.checkInTime as any).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </GlassCard>
  );

  return (
    <Screen>
      {/* ── Top Header Actions ────────────────────────────────────── */}
      <View style={styles.headerLinks}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Button
            title={ATTENDANCE.ABSENT_BTN}
            variant="secondary"
            icon={<Users color={theme.colors.text} size={18} />}
            onPress={() => router.push('/(tabs)/attendance/absent')}
            size="sm"
          />
        </View>

        <View style={{ flex: 1, marginLeft: 8 }}>
          <Button
            title={ATTENDANCE.SCAN_BTN}
            icon={<QrCode color={theme.colors.textOnPrimary} size={18} />}
            onPress={() => router.push('/(tabs)/attendance/scan')}
            size="sm"
          />
        </View>
      </View>

      {/* ── Search Section ────────────────────────────────────────── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Search color={theme.colors.primary} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder={isTrainer ? 'Search assigned members...' : ATTENDANCE.SEARCH_PLACEHOLDER}
            placeholderTextColor={theme.colors.textMuted}
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
              <AlertCircle color={theme.colors.error} size={36} />
            </View>
            <Text style={styles.warningTitle}>{ATTENDANCE.WARNING_TITLE}</Text>
            <Text style={styles.warningDesc}>
              {ATTENDANCE.WARNING_DESC(expiredWarning.member?.name || '')}
            </Text>

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

            <View style={{ marginTop: 12, width: '100%' }}>
              <Button
                title={ATTENDANCE.RENEW_NOW}
                onPress={() => {
                  setExpiredWarning({ visible: false });
                  router.push(`/(tabs)/members/${expiredWarning.member?.id}/renew`);
                }}
                size="md"
              />
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
              : selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
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
          <CalendarIcon color={theme.colors.primary} size={20} />
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
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListEmptyComponent={<EmptyState message={ATTENDANCE.EMPTY} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchSection: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    zIndex: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.raised,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 48, // 44px+ tap target
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 15,
    color: theme.colors.text,
  },
  searchingText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
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
    borderBottomColor: theme.colors.borderLight,
    minHeight: 52, // 44px+ tap target
  },
  resultInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  resultName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  resultPhone: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  noResultText: {
    padding: theme.spacing.md,
    textAlign: 'center',
    color: theme.colors.textMuted,
  },
  successBanner: {
    position: 'absolute',
    top: 140,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderColor: 'rgba(142, 182, 155, 0.5)',
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
    color: theme.colors.primary,
  },
  successBannerName: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.85)',
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
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  warningTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  warningDesc: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  warningButtons: {
    flexDirection: 'row',
    width: '100%',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  listTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  countBadge: {
    marginLeft: 8,
    backgroundColor: theme.colors.raised,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  countText: {
    ...theme.typography.small,
    fontFamily: theme.fonts.headingBold,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  datePickerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    backgroundColor: 'rgba(142, 182, 155, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  todayTextWrapper: {
    flex: 1,
  },
  todayName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
  },
  todayMethod: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  todayTimeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  todayTime: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingMedium,
    fontWeight: '600',
  },
});
