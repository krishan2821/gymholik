import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Plus } from 'lucide-react-native';
import { useMembers, Member } from '../../../src/api/members';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { MemberCard } from '../../../src/components/MemberCard';
import { FilterChips } from '../../../src/components/FilterChips';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorState } from '../../../src/components/ErrorState';
import { LoadingSkeleton } from '../../../src/components/LoadingSkeleton';
import { Screen } from '../../../src/components/Screen';
import { theme } from '../../../src/theme/theme';
import { MEMBERS } from '../../../src/constants/strings';

export default function MembersListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useAuthStore();
  const isTrainer = role === 'TRAINER';
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

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

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
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

  const members = data?.pages.flatMap((page) => page.content) || [];

  if (isLoading && !isRefetching && members.length === 0) {
    return (
      <Screen>
        <View style={styles.header}>
          <View style={styles.searchContainer}>
            <Search color={theme.colors.primary} size={20} />
            <TextInput
              style={styles.searchInput}
              placeholder={MEMBERS.SEARCH_PLACEHOLDER}
              placeholderTextColor={theme.colors.textMuted}
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
        <ErrorState
          message={error?.message || MEMBERS.LOAD_ERROR}
          onRetry={() => refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Search color={theme.colors.primary} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder={MEMBERS.SEARCH_PLACEHOLDER}
            placeholderTextColor={theme.colors.textMuted}
            value={searchTerm}
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
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <EmptyState
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
    minHeight: 48, // 44px+ tap target
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
});
