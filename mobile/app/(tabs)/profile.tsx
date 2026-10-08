import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { User, Lock, LogOut, ChevronRight, Building2, Dumbbell } from 'lucide-react-native';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useCurrentUser } from '../../src/api/auth';
import { queryClient } from '../../src/api/queryClient';
import { theme } from '../../src/theme/theme';
import { Screen } from '../../src/components/Screen';
import { GlassCard } from '../../src/components/GlassCard';
import { Badge } from '../../src/components/Badge';
import { MORE, COMMON } from '../../src/constants/strings';

export default function TrainerProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const role = user?.role || useAuthStore((state) => state.role);
  const { logout } = useAuthStore();
  const { data: currentUser, isLoading } = useCurrentUser();

  React.useEffect(() => {
    if (role && role !== 'TRAINER') {
      router.replace('/(tabs)');
    }
  }, [role, router]);

  if (role && role !== 'TRAINER') {
    return null;
  }

  const handleLogout = async () => {
    Alert.alert(MORE.LOGOUT_CONFIRM_TITLE, MORE.LOGOUT_CONFIRM_MSG, [
      { text: COMMON.CANCEL, style: 'cancel' },
      {
        text: MORE.LOGOUT_BTN,
        style: 'destructive',
        onPress: async () => {
          await logout();
          queryClient.clear();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const displayName = currentUser?.name || 'Trainer';
  const displayRole = currentUser?.role || role || 'TRAINER';
  const gymName = currentUser?.gymName || 'Gymholik Fitness';
  const trainerTypes = currentUser?.trainerTypes || [];

  return (
    <Screen scrollable contentContainerStyle={styles.scroll}>
      {/* ── Profile Card ─────────────────────────────────────────── */}
      <GlassCard style={styles.profileCard} contentStyle={styles.profileContent}>
        <View style={styles.avatar}>
          <User color={theme.colors.primary} size={36} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.nameText}>{displayName}</Text>
          <View style={styles.metaRow}>
            <Badge label={displayRole} variant="success" size="sm" />
            {currentUser?.phone ? (
              <Text style={styles.phoneText}>•  {currentUser.phone}</Text>
            ) : null}
          </View>

          {/* Gym Name Display */}
          <View style={styles.gymRow}>
            <Building2 size={14} color={theme.colors.textMuted} style={{ marginRight: 5 }} />
            <Text style={styles.gymNameText} numberOfLines={1}>
              {gymName}
            </Text>
          </View>
        </View>
      </GlassCard>

      {/* ── Specializations (Trainer Types Chips) ────────────────── */}
      {trainerTypes.length > 0 && (
        <View style={styles.chipsSection}>
          <Text style={styles.sectionHeader}>Specializations</Text>
          <View style={styles.chipRow}>
            {trainerTypes.map((type) => (
              <View key={type.id} style={styles.chip}>
                <Dumbbell size={12} color={theme.colors.primary} style={{ marginRight: 5 }} />
                <Text style={styles.chipText}>{type.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Account Section ───────────────────────────────────────── */}
      <Text style={styles.sectionHeader}>{MORE.SECTION_ACCOUNT}</Text>
      <GlassCard style={styles.sectionCard} contentStyle={styles.sectionContent}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(tabs)/more/password')}
          accessibilityRole="button"
          accessibilityLabel="Change password"
        >
          <View style={styles.iconBox}>
            <Lock color={theme.colors.primary} size={20} />
          </View>
          <Text style={styles.menuTitle}>{MORE.MENU_CHANGE_PASSWORD}</Text>
          <ChevronRight color={theme.colors.textMuted} size={18} />
        </TouchableOpacity>
      </GlassCard>

      {/* ── Logout Section ────────────────────────────────────────── */}
      <GlassCard style={[styles.sectionCard, { marginTop: theme.spacing.lg }]} contentStyle={styles.sectionContent}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <View style={[styles.iconBox, { backgroundColor: 'rgba(255, 107, 107, 0.15)' }]}>
            <LogOut color={theme.colors.error} size={20} />
          </View>
          <Text style={[styles.menuTitle, { color: theme.colors.error }]}>
            {MORE.MENU_LOGOUT}
          </Text>
          <ChevronRight color={theme.colors.textMuted} size={18} />
        </TouchableOpacity>
      </GlassCard>

      <View style={{ height: 120 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: theme.spacing.md,
    paddingBottom: 130,
  },
  profileCard: {
    marginBottom: theme.spacing.lg,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(142, 182, 155, 0.15)',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  nameText: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  phoneText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  gymRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  gymNameText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.headingMedium,
  },
  chipsSection: {
    marginBottom: theme.spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(142, 182, 155, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(142, 182, 155, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
  },
  chipText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 12,
    color: theme.colors.primary,
  },
  sectionHeader: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  },
  sectionCard: {
    marginBottom: theme.spacing.sm,
  },
  sectionContent: {
    padding: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    minHeight: 56,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(142, 182, 155, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  menuTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
  },
});
