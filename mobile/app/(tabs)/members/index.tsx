import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  Plus,
  X,
  Phone,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  RefreshCw,
  User,
  Calendar,
} from 'lucide-react-native';
import { useMembers, Member } from '../../../src/api/members';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { MemberCard } from '../../../src/components/MemberCard';
import { FilterChips } from '../../../src/components/FilterChips';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorState } from '../../../src/components/ErrorState';
import { LoadingSkeleton } from '../../../src/components/LoadingSkeleton';
import { Screen, getScreenBottomPadding } from '../../../src/components/Screen';
import { PageHeader } from '../../../src/components/PageHeader';
import { Avatar } from '../../../src/components/Avatar';
import { Badge, getStatusBadgeVariant } from '../../../src/components/Badge';
import { Button } from '../../../src/components/Button';
import { GlassCard } from '../../../src/components/GlassCard';
import { AddMemberModal } from '../../../src/components/AddMemberModal';
import { CollectPaymentModal } from '../../../src/components/CollectPaymentModal';
import { isPhoneMasked } from '../../../src/components/MaskedPhone';
import { useBreakpoint } from '../../../src/hooks/useBreakpoint';
import { theme } from '../../../src/theme/theme';
import { formatMoney } from '../../../src/utils/formatters';
import { openPhone, openWhatsApp } from '../../../src/utils/safeLinking';
import { MEMBERS } from '../../../src/constants/strings';

const PAGE_SIZE = 10;

export default function MembersListScreen() {
  const router = useRouter();
  const rawInsets = useSafeAreaInsets();
  const insets = Platform.OS === 'web' ? { top: 0, right: 0, bottom: 0, left: 0 } : (rawInsets ?? { top: 0, right: 0, bottom: 0, left: 0 });
  const { role } = useAuthStore();
  const isTrainer = role === 'TRAINER';
  const { isDesktop } = useBreakpoint();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectMemberId, setCollectMemberId] = useState<string | undefined>(undefined);

  const searchInputRef = useRef<any>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Keyboard shortcut: '/' focuses search input on web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !(
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA'
        )
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useMembers({ term: debouncedTerm, status: statusFilter === 'ALL' ? '' : statusFilter });

  const filterOptions = [
    { label: MEMBERS.FILTER_ALL, value: 'ALL' },
    { label: MEMBERS.FILTER_ACTIVE, value: 'ACTIVE' },
    { label: MEMBERS.FILTER_EXPIRED, value: 'EXPIRED' },
    ...(!isTrainer ? [{ label: 'Due', value: 'DUE' }] : []),
  ];

  const members = data?.pages.flatMap((page) => page.content) || [];

  // Automatically select first member on desktop if none selected or invalid
  useEffect(() => {
    if (isDesktop && members.length > 0 && !selectedMemberId) {
      setSelectedMemberId(members[0].id);
    }
  }, [isDesktop, members, selectedMemberId]);

  const selectedMember = members.find((m) => m.id === selectedMemberId) || null;

  // Pagination on desktop
  const totalItems = members.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const paginatedMembers = isDesktop
    ? members.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    : members;

  const handleLoadMore = () => {
    if (!isDesktop && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: Member }) => (
      <MemberCard
        member={item}
        onPress={() => router.push(`/(tabs)/members/${item.id}`)}
      />
    ),
    [router]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({ length: 110, offset: 110 * index, index }),
    []
  );

  if (isLoading && !isRefetching && members.length === 0) {
    return (
      <Screen>
        <PageHeader title={MEMBERS.SCREEN_TITLE} />
        <View style={styles.header}>
          <View style={styles.searchContainer}>
            <Search color={theme.colors.primary} size={20} />
            <TextInput
              style={styles.searchInput}
              placeholder={MEMBERS.SEARCH_PLACEHOLDER}
              placeholderTextColor={theme.colors.textMuted}
              value={searchTerm ?? ''}
              editable={false}
            />
          </View>
        </View>
        <LoadingSkeleton />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen style={styles.centered}>
        <PageHeader title={MEMBERS.SCREEN_TITLE} />
        <ErrorState
          message={error?.message || MEMBERS.LOAD_ERROR}
          onRetry={() => refetch()}
        />
      </Screen>
    );
  }

  // ── DESKTOP VIEW: Data Table + Detail Panel ─────────────────────────
  if (isDesktop) {
    return (
      <Screen scrollable={false} safeTop={false}>
        {/* Top Header Bar with Search, Filters and Add Member Button */}
        <View style={styles.desktopTopBar}>
          <View style={styles.desktopTopLeft}>
            <Text style={styles.desktopScreenTitle}>{MEMBERS.SCREEN_TITLE}</Text>
            <View style={styles.desktopSearchWrap}>
              <Search color={theme.colors.primary} size={18} />
              <TextInput
                ref={searchInputRef}
                style={styles.desktopSearchInput}
                placeholder="Search name or mobile... (Press / to focus)"
                placeholderTextColor={theme.colors.textMuted}
                value={searchTerm ?? ''}
                onChangeText={setSearchTerm}
              />
              {searchTerm ? (
                <TouchableOpacity onPress={() => setSearchTerm('')}>
                  <X size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.desktopTopRight}>
            <FilterChips
              options={filterOptions}
              selectedValue={statusFilter}
              onSelect={(val) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
            />
            {!isTrainer && (
              <Button
                title="Add Member"
                icon={<Plus size={18} color="#051F20" />}
                variant="primary"
                size="md"
                onPress={() => setShowAddModal(true)}
              />
            )}
          </View>
        </View>

        {/* Main Content: Table on Left + Detail Panel on Right */}
        <View style={styles.desktopContentRow}>
          {/* Data Table Container */}
          <View style={styles.desktopTableCard}>
            <ScrollView style={styles.desktopTableScroll} showsVerticalScrollIndicator={true}>
              {/* Sticky Header */}
              <View style={styles.desktopTableHeaderRow}>
                <Text style={[styles.tableTh, { flex: 2.2 }]}>NAME</Text>
                <Text style={[styles.tableTh, { flex: 1.6 }]}>MOBILE</Text>
                <Text style={[styles.tableTh, { flex: 1.8 }]}>PLAN</Text>
                <Text style={[styles.tableTh, { flex: 1.5 }]}>EXPIRY</Text>
                <Text style={[styles.tableTh, { flex: 1.2 }]}>STATUS</Text>
                <Text style={[styles.tableTh, { flex: 1.2, textAlign: 'right' }]}>DUE</Text>
              </View>

              {/* Rows */}
              {paginatedMembers.length === 0 ? (
                <View style={styles.desktopEmptyTable}>
                  <EmptyState
                    type={debouncedTerm.trim() ? 'search' : 'members'}
                    message={
                      debouncedTerm
                        ? 'No members match your search.'
                        : isTrainer
                        ? 'No members assigned yet.'
                        : MEMBERS.EMPTY
                    }
                    actionLabel={debouncedTerm || isTrainer ? undefined : MEMBERS.ADD_MEMBER}
                    onAction={debouncedTerm || isTrainer ? undefined : () => setShowAddModal(true)}
                  />
                </View>
              ) : (
                paginatedMembers.map((member) => {
                  const isSelected = selectedMemberId === member.id;
                  const currentPlan = member.currentMembership?.planName || 'No Plan';
                  const expiryDate = member.currentMembership?.expiryDate
                    ? new Date(member.currentMembership.expiryDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—';
                  const status = member.currentMembership?.status || 'INACTIVE';
                  const duePaise = member.currentMembership?.duePaise || 0;
                  const displayPhone = isTrainer && isPhoneMasked(member.phone)
                    ? member.phone
                    : member.phone;

                  return (
                    <TouchableOpacity
                      key={member.id}
                      style={[
                        styles.desktopTableRow,
                        isSelected && styles.desktopTableRowSelected,
                      ]}
                      onPress={() => setSelectedMemberId(member.id)}
                      activeOpacity={0.8}
                      {...({ tabIndex: 0 } as any)}
                    >
                      {/* Name */}
                      <View style={[styles.tableTd, { flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                        <Avatar name={member.name} size="sm" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tableMemberName} numberOfLines={1}>
                            {member.name}
                          </Text>
                          {member.memberCode && (
                            <Text style={styles.tableMemberCode}>{member.memberCode}</Text>
                          )}
                        </View>
                      </View>

                      {/* Mobile */}
                      <Text style={[styles.tableTd, styles.tableText, { flex: 1.6 }]} numberOfLines={1}>
                        {displayPhone}
                      </Text>

                      {/* Plan */}
                      <Text style={[styles.tableTd, styles.tableText, { flex: 1.8 }]} numberOfLines={1}>
                        {currentPlan}
                      </Text>

                      {/* Expiry */}
                      <Text style={[styles.tableTd, styles.tableText, { flex: 1.5 }]} numberOfLines={1}>
                        {expiryDate}
                      </Text>

                      {/* Status */}
                      <View style={[styles.tableTd, { flex: 1.2 }]}>
                        <Badge
                          label={status}
                          variant={getStatusBadgeVariant(status)}
                          size="sm"
                        />
                      </View>

                      {/* Due */}
                      <Text
                        style={[
                          styles.tableTd,
                          styles.tableDueText,
                          { flex: 1.2, textAlign: 'right' },
                          duePaise > 0 && { color: theme.colors.error },
                        ]}
                      >
                        {isTrainer ? '—' : duePaise > 0 ? formatMoney(duePaise) : '₹0'}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Pagination Controls */}
            {totalItems > PAGE_SIZE && (
              <View style={styles.desktopPagination}>
                <Text style={styles.paginationText}>
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(currentPage * PAGE_SIZE, totalItems)} of {totalItems} members
                </Text>
                <View style={styles.paginationButtons}>
                  <TouchableOpacity
                    style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                    disabled={currentPage === 1}
                    onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={16} color={currentPage === 1 ? 'rgba(218, 241, 222, 0.3)' : '#DAF1DE'} />
                    <Text style={[styles.pageBtnText, currentPage === 1 && styles.pageBtnTextDisabled]}>Prev</Text>
                  </TouchableOpacity>

                  <Text style={styles.pageNumberText}>
                    {currentPage} / {totalPages}
                  </Text>

                  <TouchableOpacity
                    style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                    disabled={currentPage === totalPages}
                    onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <Text style={[styles.pageBtnText, currentPage === totalPages && styles.pageBtnTextDisabled]}>Next</Text>
                    <ChevronRight size={16} color={currentPage === totalPages ? 'rgba(218, 241, 222, 0.3)' : '#DAF1DE'} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Right Detail Panel */}
          <View style={styles.desktopDetailPanel}>
            {selectedMember ? (
              <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.detailHeader}>
                  <Avatar name={selectedMember.name} size="lg" />
                  <View style={styles.detailHeaderInfo}>
                    <Text style={styles.detailMemberName}>{selectedMember.name}</Text>
                    {selectedMember.memberCode && (
                      <Text style={styles.detailMemberCode}>Code: {selectedMember.memberCode}</Text>
                    )}
                    <View style={{ marginTop: 6 }}>
                      <Badge
                        label={selectedMember.currentMembership?.status || 'INACTIVE'}
                        variant={getStatusBadgeVariant(selectedMember.currentMembership?.status)}
                        size="sm"
                      />
                    </View>
                  </View>
                </View>

                {/* Contact Actions (if not masked) */}
                {!isPhoneMasked(selectedMember.phone) && (
                  <View style={styles.detailContactRow}>
                    <TouchableOpacity
                      style={styles.detailContactBtn}
                      onPress={() => openPhone(selectedMember.phone)}
                    >
                      <Phone size={15} color="#DAF1DE" />
                      <Text style={styles.detailContactText}>Call</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.detailContactBtn, { backgroundColor: '#8EB69B' }]}
                      onPress={() =>
                        openWhatsApp(
                          selectedMember.phone,
                          `Hi ${selectedMember.name}, greeting from gym!`
                        )
                      }
                    >
                      <MessageCircle size={15} color="#051F20" />
                      <Text style={[styles.detailContactText, { color: '#051F20' }]}>WhatsApp</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Membership Details */}
                <View style={styles.detailCard}>
                  <Text style={styles.detailSectionTitle}>MEMBERSHIP</Text>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailLabel}>Plan</Text>
                    <Text style={styles.detailValue}>
                      {selectedMember.currentMembership?.planName || 'None'}
                    </Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailLabel}>Mobile</Text>
                    <Text style={styles.detailValue}>{selectedMember.phone}</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailLabel}>Gender</Text>
                    <Text style={styles.detailValue}>{selectedMember.gender || '—'}</Text>
                  </View>
                  {selectedMember.currentMembership?.expiryDate && (
                    <View style={styles.detailInfoRow}>
                      <Text style={styles.detailLabel}>Expires</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedMember.currentMembership.expiryDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Payment and Dues Section (Owner/Staff only) */}
                {!isTrainer && (
                  <View style={styles.detailCard}>
                    <Text style={styles.detailSectionTitle}>PAYMENTS & DUES</Text>
                    <View style={styles.detailInfoRow}>
                      <Text style={styles.detailLabel}>Total Plan Fee</Text>
                      <Text style={styles.detailValue}>
                        {formatMoney(selectedMember.currentMembership?.totalPaise || 0)}
                      </Text>
                    </View>
                    <View style={styles.detailInfoRow}>
                      <Text style={styles.detailLabel}>Paid Amount</Text>
                      <Text style={styles.detailValue}>
                        {formatMoney(selectedMember.currentMembership?.paidPaise || 0)}
                      </Text>
                    </View>
                    <View style={styles.detailInfoRow}>
                      <Text style={styles.detailLabel}>Pending Due</Text>
                      <Text
                        style={[
                          styles.detailValue,
                          (selectedMember.currentMembership?.duePaise || 0) > 0 && {
                            color: theme.colors.error,
                            fontWeight: '700',
                          },
                        ]}
                      >
                        {formatMoney(selectedMember.currentMembership?.duePaise || 0)}
                      </Text>
                    </View>

                    <View style={styles.detailActionsCol}>
                      {(selectedMember.currentMembership?.duePaise || 0) > 0 && (
                        <Button
                          title="Collect Due Fee"
                          icon={<CreditCard size={16} color="#051F20" />}
                          variant="primary"
                          size="md"
                          onPress={() => {
                            setCollectMemberId(selectedMember.id);
                            setShowCollectModal(true);
                          }}
                        />
                      )}
                      <Button
                        title="Renew Membership"
                        variant="secondary"
                        size="md"
                        onPress={() => router.push(`/(tabs)/members/${selectedMember.id}/renew`)}
                      />
                    </View>
                  </View>
                )}
              </ScrollView>
            ) : (
              <View style={styles.emptyDetailPanel}>
                <User size={40} color="rgba(218, 241, 222, 0.3)" />
                <Text style={styles.emptyDetailText}>Select a member to view details</Text>
              </View>
            )}
          </View>
        </View>

        {/* Centered Modals */}
        <AddMemberModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => refetch()}
        />
        <CollectPaymentModal
          visible={showCollectModal}
          memberId={collectMemberId}
          onClose={() => {
            setShowCollectModal(false);
            setCollectMemberId(undefined);
          }}
          onSuccess={() => refetch()}
        />
      </Screen>
    );
  }

  // ── MOBILE VIEW: FlatList of Cards ───────────────────────────────────
  return (
    <Screen>
      <PageHeader title={MEMBERS.SCREEN_TITLE} />
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Search color={theme.colors.primary} size={20} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder={MEMBERS.SEARCH_PLACEHOLDER}
            placeholderTextColor={theme.colors.textMuted}
            value={searchTerm ?? ''}
            onChangeText={setSearchTerm}
          />
        </View>
      </View>

      <View style={styles.filtersContainer}>
        <FilterChips
          options={filterOptions}
          selectedValue={statusFilter}
          onSelect={setStatusFilter}
        />
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: getScreenBottomPadding(insets.bottom) },
        ]}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <EmptyState
            type={debouncedTerm.trim() ? 'search' : 'members'}
            message={
              debouncedTerm
                ? 'No members match your search.'
                : isTrainer
                ? 'No members assigned yet. Your gym owner will assign members to you.'
                : MEMBERS.EMPTY
            }
            actionLabel={debouncedTerm || isTrainer ? undefined : MEMBERS.ADD_MEMBER}
            onAction={debouncedTerm || isTrainer ? undefined : () => router.push('/(tabs)/members/add')}
          />
        }
      />

      {!isTrainer && (
        <TouchableOpacity
          style={[
            styles.fab,
            {
              bottom:
                Platform.OS === 'ios'
                  ? insets.bottom > 0
                    ? insets.bottom + 76
                    : 96
                  : 88,
            },
          ]}
          onPress={() => router.push('/(tabs)/members/add')}
          accessibilityLabel={MEMBERS.ADD_MEMBER}
          activeOpacity={0.85}
        >
          <Plus color={theme.colors.textOnPrimary} size={26} />
        </TouchableOpacity>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.raised,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 15,
    color: theme.colors.text,
  },
  filtersContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 130,
    flexGrow: 1,
  },
  fab: {
    position: 'absolute',
    right: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.glow,
    zIndex: 10,
  },

  // Desktop Specific Styles
  desktopTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 16,
  },
  desktopTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    flex: 1,
  },
  desktopScreenTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 22,
    color: '#DAF1DE',
    fontWeight: '700',
  },
  desktopSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(11, 43, 38, 0.8)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.14)',
    paddingHorizontal: 12,
    width: 320,
    height: 42,
  },
  desktopSearchInput: {
    flex: 1,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    color: '#DAF1DE',
  },
  desktopTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  desktopContentRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 20,
    minHeight: 560,
  },
  desktopTableCard: {
    flex: 1,
    backgroundColor: '#072728',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.1)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  desktopTableScroll: {
    flex: 1,
  },
  desktopTableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0B2B26',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.12)',
    ...(Platform.OS === 'web'
      ? ({
          position: 'sticky',
          top: 0,
          zIndex: 10,
        } as any)
      : {}),
  },
  tableTh: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 11,
    color: 'rgba(218, 241, 222, 0.65)',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  desktopTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.05)',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'background 0.15s ease',
        } as any)
      : {}),
  },
  desktopTableRowSelected: {
    backgroundColor: 'rgba(142, 182, 155, 0.14)',
    borderLeftWidth: 3,
    borderLeftColor: '#8EB69B',
  },
  tableTd: {
    paddingRight: 8,
  },
  tableMemberName: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 13,
    color: '#DAF1DE',
    fontWeight: '600',
  },
  tableMemberCode: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  tableText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    color: 'rgba(218, 241, 222, 0.75)',
  },
  tableDueText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 13,
    color: '#DAF1DE',
  },
  desktopEmptyTable: {
    padding: 32,
    alignItems: 'center',
  },
  desktopPagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(218, 241, 222, 0.08)',
    backgroundColor: 'rgba(5, 31, 32, 0.5)',
  },
  paginationText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  paginationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(218, 241, 222, 0.08)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  pageBtnDisabled: {
    opacity: 0.4,
    ...(Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as any) : {}),
  },
  pageBtnText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: '#DAF1DE',
  },
  pageBtnTextDisabled: {
    color: 'rgba(218, 241, 222, 0.4)',
  },
  pageNumberText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.primary,
  },

  // Detail Panel
  desktopDetailPanel: {
    width: 380,
    backgroundColor: '#072728',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.1)',
    overflow: 'hidden',
  },
  detailScroll: {
    padding: 20,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.08)',
  },
  detailHeaderInfo: {
    flex: 1,
  },
  detailMemberName: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 17,
    color: '#DAF1DE',
  },
  detailMemberCode: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  detailContactRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  detailContactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(218, 241, 222, 0.1)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  detailContactText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 12,
    color: '#DAF1DE',
    fontWeight: '600',
  },
  detailCard: {
    backgroundColor: 'rgba(11, 43, 38, 0.6)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.08)',
    padding: 14,
    marginTop: 14,
  },
  detailSectionTitle: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 11,
    color: theme.colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  detailInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.04)',
  },
  detailLabel: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  detailValue: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: '#DAF1DE',
    fontWeight: '500',
  },
  detailActionsCol: {
    gap: 8,
    marginTop: 12,
  },
  emptyDetailPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyDetailText: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
