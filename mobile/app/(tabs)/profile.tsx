import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { User, LogOut, ChevronRight, Building2, Dumbbell } from 'lucide-react-native';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useCurrentUser } from '../../src/api/auth';
import { queryClient } from '../../src/api/queryClient';
import { useTheme, useStyles, ThemeValue } from '../../src/theme/ThemeContext';
import { Screen } from '../../src/components/Screen';
import { GlassCard } from '../../src/components/GlassCard';
import { Badge } from '../../src/components/Badge';
import { showConfirmDialog } from '../../src/components/ConfirmDialog';
import { MORE, COMMON } from '../../src/constants/strings';

export default function TrainerProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const user = useAuthStore((state) => state.user);
  const role = user?.role || useAuthStore((state) => state.role);
  const { logout } = useAuthStore();
  const { data: currentUser } = useCurrentUser();

  React.useEffect(() => {
    if (role && role !== 'TRAINER') {
      router.replace('/(tabs)');
    }
  }, [role, router]);

  if (role && role !== 'TRAINER') {
    return null;
  }

  const handleLogout = async () => {
    showConfirmDialog({
      title: MORE.LOGOUT_CONFIRM_TITLE,
      message: MORE.LOGOUT_CONFIRM_MSG,
      confirmText: MORE.LOGOUT_BTN,
      cancelText: COMMON.CANCEL,
      isDestructive: true,
      onConfirm: async () => {
        await logout();
        queryClient.clear();
        router.replace('/(auth)/login');
      },
    });
  };

  const displayName = currentUser?.name || user?.name || 'Trainer';
  const displayRole = currentUser?.role || role || 'TRAINER';
  const gymName = currentUser?.gymName || user?.gymName || 'Gymholik Fitness';
  const trainerTypes = currentUser?.trainerTypes || [];

  return (
    <Screen scrollable contentContainerStyle={styles.scroll}>
      {/* ── Profile Card (Name, Role, Gym Name) ──────────────────── */}
      <GlassCard style={styles.profileCard} contentStyle={styles.profileContent}>
        <View style={styles.avatar}>
          <User color={colors.primary} size={36} />
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
            <Building2 size={14} color={colors.textSecondary} style={styles.gymIcon} />
            <Text style={styles.gymNameText} numberOfLines={1}>
              {gymName}
            </Text>
          </View>
        </View>
      </GlassCard>

      {/* ── Trainer Type Chips ───────────────────────────────────── */}
      <View style={styles.chipsSection}>
        <Text style={styles.sectionHeader}>Specializations</Text>
        <View style={styles.chipRow}>
          {trainerTypes.length > 0 ? (
            trainerTypes.map((type) => (
              <View key={type.id} style={styles.chip}>
                <Dumbbell size={12} color={colors.primary} style={styles.chipIcon} />
                <Text style={styles.chipText}>{type.name}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyChipsText}>No specializations assigned yet.</Text>
          )}
        </View>
      </View>

      {/* ── Sign Out Section ──────────────────────────────────────── */}
      <GlassCard
        style={[styles.sectionCard, styles.logoutCard]}
        contentStyle={styles.sectionContent}
      >
        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel={MORE.MENU_LOGOUT}
        >
          <View style={styles.iconBox}>
            <LogOut color={colors.danger} size={20} />
          </View>
          <Text style={styles.menuTitle}>{MORE.MENU_LOGOUT}</Text>
          <ChevronRight color={colors.textSecondary} size={18} />
        </TouchableOpacity>
      </GlassCard>

      <View style={styles.bottomSpacer} />
    </Screen>
  );
}

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
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
      backgroundColor: theme.colors.surfaceRaised,
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
      color: theme.colors.textSecondary,
    },
    gymRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
    },
    gymIcon: {
      marginRight: 5,
    },
    gymNameText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
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
      backgroundColor: theme.colors.surfaceRaised,
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: theme.radius.full,
    },
    chipIcon: {
      marginRight: 5,
    },
    chipText: {
      fontFamily: theme.fonts.headingMedium,
      fontSize: 12,
      color: theme.colors.primary,
    },
    emptyChipsText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      marginLeft: theme.spacing.xs,
    },
    sectionHeader: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: theme.spacing.sm,
      marginLeft: theme.spacing.xs,
    },
    sectionCard: {
      marginBottom: theme.spacing.sm,
    },
    logoutCard: {
      marginTop: theme.spacing.sm,
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
      backgroundColor: theme.colors.surfaceRaised,
      borderWidth: 1,
      borderColor: theme.colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.md,
    },
    menuTitle: {
      ...theme.typography.body,
      color: theme.colors.danger,
      flex: 1,
    },
    bottomSpacer: {
      height: 120,
    },
  });
