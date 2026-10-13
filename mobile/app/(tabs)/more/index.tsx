import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { safeSetClipboardString } from '../../../src/utils/safeClipboard';
import Toast from 'react-native-toast-message';
import { showConfirmDialog } from '../../../src/components/ConfirmDialog';
import {
  User,
  Users,
  ClipboardList,
  Settings,
  CreditCard,
  LogOut,
  ChevronRight,
  Dumbbell,
  History,
  Building2,
  Copy,
  Share2,
  Coins,
} from 'lucide-react-native';
import { theme } from '../../../src/theme/theme';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { useCurrentUser } from '../../../src/api/auth';
import { Screen } from '../../../src/components/Screen';
import { PageHeader } from '../../../src/components/PageHeader';
import { GlassCard } from '../../../src/components/GlassCard';
import { Badge } from '../../../src/components/Badge';
import { MORE, COMMON } from '../../../src/constants/strings';
import { formatGymCode } from '../../../src/utils/registrationValidation';

export default function MoreScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role, user, logout } = useAuthStore();
  const { data: currentUser } = useCurrentUser();
  const isOwner = (currentUser?.role || role) === 'OWNER';

  React.useEffect(() => {
    if (role === 'TRAINER') {
      router.replace('/(tabs)/members');
    }
  }, [role, router]);

  if (role === 'TRAINER') {
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

  const MenuItem = ({ icon: Icon, title, onPress, destructive = false }: any) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View
        style={[
          styles.iconBox,
          destructive && styles.destructiveIconBox,
        ]}
      >
        <Icon color={destructive ? theme.colors.error : theme.colors.primary} size={20} />
      </View>
      <Text style={[styles.menuTitle, destructive && styles.destructiveMenuTitle]}>
        {title}
      </Text>
      <ChevronRight color={theme.colors.textMuted} size={18} />
    </TouchableOpacity>
  );

  const gymName = currentUser?.gymName || user?.gymName;
  const gymCode = currentUser?.gymCode || user?.gymCode;
  const formattedGymCode = formatGymCode(gymCode);

  const handleCopyGymCode = async () => {
    if (!formattedGymCode) return;
    await safeSetClipboardString(formattedGymCode);
    Toast.show({
      type: 'success',
      text1: MORE.GYM_CODE_COPIED,
    });
  };

  const handleShareGymCode = async () => {
    if (!formattedGymCode) return;
    const msg = MORE.GYM_CODE_SHARE_TEXT(gymName || 'Gym', formattedGymCode);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
      await safeSetClipboardString(msg);
      Toast.show({
        type: 'success',
        text1: 'Gym code details copied to clipboard',
      });
      return;
    }
    try {
      await Share.share({
        message: msg,
      });
    } catch {
      // dismissed
    }
  };

  return (
    <Screen scrollable contentContainerStyle={styles.scroll}>
      <PageHeader title="More" />
      {/* ── Profile Card (Tappable to Edit Profile) ───────────────── */}
      <GlassCard style={styles.profileCard}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push('/(tabs)/more/profile')}
          style={styles.profileContent}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
        >
          <View style={styles.avatar}>
            <User color={theme.colors.primary} size={36} />
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.nameText} numberOfLines={1}>
                {currentUser?.name || user?.name || (isOwner ? 'Owner' : 'Staff')}
              </Text>
              <ChevronRight color={theme.colors.textMuted} size={18} />
            </View>
            <View style={styles.badgeRow}>
              <Badge
                label={currentUser?.role || role || 'STAFF'}
                variant={isOwner ? 'success' : 'neutral'}
                size="sm"
              />
              {currentUser?.phone || user?.phone ? (
                <Text style={styles.phoneText}>
                  •  {currentUser?.phone || user?.phone}
                </Text>
              ) : null}
            </View>
            {gymName ? (
              <View style={styles.gymRow}>
                <Building2 size={14} color={theme.colors.textMuted} style={styles.gymIcon} />
                <Text style={styles.gymText} numberOfLines={1}>
                  {gymName}
                </Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>

        {isOwner && !!gymCode && (
          <>
            <View style={styles.profileDivider} />
            <View style={styles.codeRow}>
              <View style={styles.codeInfo}>
                <Text style={styles.codeLabel}>{MORE.GYM_CODE_LABEL.toUpperCase()}</Text>
                <Text style={styles.codeValue}>{formattedGymCode}</Text>
              </View>
              <View style={styles.codeActions}>
                <TouchableOpacity
                  style={styles.codeBtn}
                  onPress={handleCopyGymCode}
                  accessibilityRole="button"
                  accessibilityLabel="Copy gym code"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Copy size={16} color={theme.colors.primary} />
                  <Text style={styles.codeBtnText}>{MORE.COPY_CODE}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.codeBtn}
                  onPress={handleShareGymCode}
                  accessibilityRole="button"
                  accessibilityLabel="Share gym code"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Share2 size={16} color={theme.colors.primary} />
                  <Text style={styles.codeBtnText}>{MORE.SHARE_CODE}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </GlassCard>

      {/* ── Account Section ───────────────────────────────────────── */}
      <Text style={styles.sectionHeader}>{MORE.SECTION_ACCOUNT}</Text>
      <GlassCard style={styles.sectionCard} contentStyle={styles.sectionContent}>
        <MenuItem
          icon={CreditCard}
          title={MORE.MENU_SUBSCRIPTION}
          onPress={() => router.push('/(tabs)/more/subscription')}
        />
      </GlassCard>

      {/* ── Manage Section ────────────────────────────────────────── */}
      {isOwner && (
        <>
          <Text style={styles.sectionHeader}>{MORE.SECTION_MANAGE}</Text>
          <GlassCard style={styles.sectionCard} contentStyle={styles.sectionContent}>
            <MenuItem
              icon={Building2}
              title={MORE.MENU_GYM_PROFILE}
              onPress={() => router.push('/(tabs)/more/gym-profile')}
            />
            <View style={styles.divider} />
            <MenuItem
              icon={Users}
              title={MORE.MENU_STAFF}
              onPress={() => router.push('/(tabs)/more/staff')}
            />
            <View style={styles.divider} />
            <MenuItem
              icon={Dumbbell}
              title={MORE.MENU_TRAINERS}
              onPress={() => router.push('/(tabs)/more/trainers')}
            />
            <View style={styles.divider} />
            <MenuItem
              icon={ClipboardList}
              title={MORE.MENU_PLANS}
              onPress={() => router.push('/(tabs)/more/plans')}
            />
            <View style={styles.divider} />
            <MenuItem
              icon={Coins}
              title="Day Close"
              onPress={() => router.push('/(tabs)/more/day-close')}
            />
            <View style={styles.divider} />
            <MenuItem
              icon={Settings}
              title={MORE.MENU_SETTINGS}
              onPress={() => router.push('/(tabs)/more/settings')}
            />
            <View style={styles.divider} />
            <MenuItem
              icon={History}
              title={MORE.MENU_AUDIT}
              onPress={() => router.push('/(tabs)/more/audit')}
            />
          </GlassCard>
        </>
      )}

      {/* ── Logout Section ────────────────────────────────────────── */}
      <GlassCard
        style={[styles.sectionCard, styles.logoutCard]}
        contentStyle={styles.sectionContent}
      >
        <MenuItem
          icon={LogOut}
          title={MORE.MENU_LOGOUT}
          destructive
          onPress={handleLogout}
        />
      </GlassCard>

      <View style={styles.bottomSpacer} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: theme.spacing.md,
    paddingBottom: 110,
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
    backgroundColor: theme.colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  profileInfo: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nameText: {
    ...theme.typography.h2,
    color: theme.colors.text,
    flex: 1,
    marginRight: 6,
  },
  badgeRow: {
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
  gymIcon: {
    marginRight: 5,
  },
  gymText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  sectionHeader: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.headingMedium,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
    marginLeft: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    marginBottom: theme.spacing.lg,
  },
  logoutCard: {
    marginTop: theme.spacing.lg,
  },
  sectionContent: {
    paddingHorizontal: theme.spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  destructiveIconBox: {
    borderColor: theme.colors.error,
  },
  menuTitle: {
    flex: 1,
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    marginLeft: theme.spacing.md,
  },
  destructiveMenuTitle: {
    color: theme.colors.error,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
  },
  bottomSpacer: {
    height: 40,
  },
  profileDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginHorizontal: theme.spacing.lg,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  codeInfo: {
    flex: 1,
  },
  codeLabel: {
    ...theme.typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  codeValue: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 16,
    color: theme.colors.primary,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  codeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.raised,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  codeBtnText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    fontWeight: '600',
  },
});
