import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  User,
  Users,
  ClipboardList,
  Settings,
  CreditCard,
  Lock,
  LogOut,
  ChevronRight,
  Copy,
  Check,
  Share2,
  Dumbbell,
  History,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { theme } from '../../../src/theme/theme';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { useCurrentUser } from '../../../src/api/auth';
import { Screen } from '../../../src/components/Screen';
import { GlassCard } from '../../../src/components/GlassCard';
import { Badge } from '../../../src/components/Badge';
import { MORE, COMMON } from '../../../src/constants/strings';

export default function MoreScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role, logout, gymId, gymCode } = useAuthStore();
  const { data: currentUser } = useCurrentUser();
  const isOwner = (currentUser?.role || role) === 'OWNER';
  const effectiveGymCode = currentUser?.gymCode || gymCode;
  const [copiedCode, setCopiedCode] = useState(false);

  React.useEffect(() => {
    if (role === 'TRAINER') {
      router.replace('/(tabs)/members');
    }
  }, [role, router]);

  if (role === 'TRAINER') {
    return null;
  }

  const handleCopyGymCode = async () => {
    if (!effectiveGymCode) return;
    await Clipboard.setStringAsync(effectiveGymCode);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareGymCode = async () => {
    if (!effectiveGymCode) return;
    try {
      await Share.share({
        message: `Join ${currentUser?.gymName || 'our gym'} on Gymholik! Use Gym Code: ${effectiveGymCode}`,
      });
    } catch {
      // User cancelled
    }
  };

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

  const MenuItem = ({ icon: Icon, title, onPress, destructive = false }: any) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View
        style={[
          styles.iconBox,
          destructive && { backgroundColor: 'rgba(255, 107, 107, 0.15)' },
        ]}
      >
        <Icon color={destructive ? theme.colors.error : theme.colors.primary} size={20} />
      </View>
      <Text style={[styles.menuTitle, destructive && { color: theme.colors.error }]}>
        {title}
      </Text>
      <ChevronRight color={theme.colors.textMuted} size={18} />
    </TouchableOpacity>
  );

  return (
    <Screen scrollable contentContainerStyle={styles.scroll}>
      {/* ── Profile Card (Tappable to Edit Profile) ───────────────── */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => router.push('/(tabs)/more/profile')}
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
      >
        <GlassCard style={styles.profileCard} contentStyle={styles.profileContent}>
          <View style={styles.avatar}>
            <User color={theme.colors.primary} size={36} />
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.nameText} numberOfLines={1}>
                {currentUser?.name || 'User'}
              </Text>
              <ChevronRight color={theme.colors.textMuted} size={18} />
            </View>
            <View style={styles.badgeRow}>
              <Badge
                label={currentUser?.role || role || 'STAFF'}
                variant={isOwner ? 'success' : 'neutral'}
                size="sm"
              />
              {currentUser?.phone ? (
                <Text style={styles.phoneText}>•  {currentUser.phone}</Text>
              ) : null}
            </View>
            {isOwner && effectiveGymCode ? (
              <View style={styles.gymCodeRow}>
                <TouchableOpacity
                  style={styles.gymCodePill}
                  onPress={handleCopyGymCode}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel="Copy gym code"
                >
                  <Text style={styles.gymCodeLabel}>Gym Code:</Text>
                  <Text style={styles.gymCodeValue}>{effectiveGymCode}</Text>
                  {copiedCode ? (
                    <Check size={13} color={theme.colors.primary} />
                  ) : (
                    <Copy size={13} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={handleShareGymCode}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel="Share gym code"
                >
                  <Share2 size={15} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </GlassCard>
      </TouchableOpacity>

      {/* ── Account Section ───────────────────────────────────────── */}
      <Text style={styles.sectionHeader}>{MORE.SECTION_ACCOUNT}</Text>
      <GlassCard style={styles.sectionCard} contentStyle={styles.sectionContent}>
        <MenuItem
          icon={CreditCard}
          title={MORE.MENU_SUBSCRIPTION}
          onPress={() => router.push('/(tabs)/more/subscription')}
        />
        <View style={styles.divider} />
        <MenuItem
          icon={Lock}
          title={MORE.MENU_CHANGE_PASSWORD}
          onPress={() => router.push('/(tabs)/more/password')}
        />
      </GlassCard>

      {/* ── Manage Section ────────────────────────────────────────── */}
      {isOwner && (
        <>
          <Text style={styles.sectionHeader}>{MORE.SECTION_MANAGE}</Text>
          <GlassCard style={styles.sectionCard} contentStyle={styles.sectionContent}>
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
      <GlassCard style={[styles.sectionCard, { marginTop: theme.spacing.lg }]} contentStyle={styles.sectionContent}>
        <MenuItem
          icon={LogOut}
          title={MORE.MENU_LOGOUT}
          destructive
          onPress={handleLogout}
        />
      </GlassCard>

      <View style={{ height: 40 }} />
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
  gymCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  gymText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  gymCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.raised,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignSelf: 'flex-start',
  },
  shareBtn: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymCodeLabel: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.bodyRegular,
  },
  gymCodeValue: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 13,
    color: theme.colors.text,
    letterSpacing: 1,
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
  sectionContent: {
    paddingHorizontal: theme.spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56, // 44px+ tap target
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
  menuTitle: {
    flex: 1,
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    marginLeft: theme.spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
  },
});
