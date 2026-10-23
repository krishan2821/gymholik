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
  Sun,
  Moon,
  Monitor,
  Sparkles,
} from 'lucide-react-native';
import { useTheme, useStyles, ThemeValue } from '../../../src/theme/ThemeContext';
import {
  useAppearanceStore,
  AppearanceSetting,
} from '../../../src/theme/useAppearance';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { useCurrentUser } from '../../../src/api/auth';
import { Screen } from '../../../src/components/Screen';
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
  const { colors, fonts, spacing, radius } = useTheme();
  const styles = useStyles(makeStyles);
  const appearanceSetting = useAppearanceStore((s) => s.setting);
  const setAppearanceSetting = useAppearanceStore((s) => s.setSetting);

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
          {
            borderColor: destructive ? colors.danger : colors.border,
          },
        ]}
      >
        <Icon color={destructive ? colors.danger : colors.primary} size={20} />
      </View>
      <Text style={[styles.menuTitle, destructive && styles.destructiveMenuTitle]}>
        {title}
      </Text>
      <ChevronRight color={colors.textSecondary} size={18} />
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
            <User color={colors.primary} size={36} />
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.nameText} numberOfLines={1}>
                {currentUser?.name || user?.name || (isOwner ? 'Owner' : 'Staff')}
              </Text>
              <ChevronRight color={colors.textSecondary} size={18} />
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
                <Building2 size={14} color={colors.textSecondary} style={styles.gymIcon} />
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
                  <Copy size={16} color={colors.primary} />
                  <Text style={styles.codeBtnText}>{MORE.COPY_CODE}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.codeBtn}
                  onPress={handleShareGymCode}
                  accessibilityRole="button"
                  accessibilityLabel="Share gym code"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Share2 size={16} color={colors.primary} />
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

      {/* ── Appearance Section ────────────────────────────────────── */}
      <Text style={styles.sectionHeader}>
        APPEARANCE
      </Text>
      <GlassCard style={styles.sectionCard}>
        <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textSecondary, marginBottom: 10 }}>
            Theme
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([
              { value: 'system', label: 'System', Icon: Monitor },
              { value: 'light', label: 'Light', Icon: Sun },
              { value: 'dark', label: 'Dark', Icon: Moon },
            ] as { value: AppearanceSetting; label: string; Icon: any }[]).map(({ value, label, Icon }) => {
              const isSelected = appearanceSetting === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setAppearanceSetting(value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  style={{
                    flex: 1,
                    flexDirection: 'column',
                    alignItems: 'center',
                    paddingVertical: 10,
                    paddingHorizontal: 8,
                    borderRadius: radius.chip,
                    backgroundColor: isSelected ? colors.primarySoft : colors.surfaceRaised,
                    borderWidth: 1.5,
                    borderColor: isSelected ? colors.primary : colors.border,
                    gap: 4,
                  }}
                >
                  <Icon size={18} color={isSelected ? colors.primary : colors.textSecondary} strokeWidth={2} />
                  <Text style={{
                    fontFamily: isSelected ? fonts.headingMedium : fonts.bodyRegular,
                    fontSize: 12,
                    color: isSelected ? colors.primary : colors.textSecondary,
                  }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </GlassCard>

      {/* ── Developer Tools ───────────────────────────────────────── */}
      {__DEV__ && (
        <>
          <Text style={styles.sectionHeader}>
            DEVELOPER TOOLS
          </Text>
          <GlassCard style={styles.sectionCard} contentStyle={styles.sectionContent}>
            <MenuItem
              icon={Sparkles}
              title="Component Gallery"
              onPress={() => router.push('/(tabs)/more/gallery' as any)}
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
          title={MORE.LOGOUT_BTN}
          destructive
          onPress={handleLogout}
        />
      </GlassCard>

      <View style={styles.bottomSpacer} />
    </Screen>
  );
}

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
    scroll: {
      paddingBottom: 24,
    },
    profileCard: {
      marginBottom: 24,
    },
    profileContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 24,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    profileInfo: {
      marginLeft: 16,
      flex: 1,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    nameText: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 20,
      lineHeight: 26,
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
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 13,
      lineHeight: 18,
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
    gymText: {
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
    },
    sectionHeader: {
      fontFamily: theme.fonts.headingMedium,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
      marginBottom: 4,
      marginLeft: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionCard: {
      marginBottom: 24,
    },
    logoutCard: {
      marginTop: 24,
    },
    sectionContent: {
      paddingHorizontal: 16,
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
      backgroundColor: theme.colors.surfaceRaised,
      borderColor: theme.colors.border,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuTitle: {
      flex: 1,
      fontFamily: theme.fonts.bodyMedium,
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.text,
      marginLeft: 16,
    },
    destructiveMenuTitle: {
      color: theme.colors.danger,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
    },
    bottomSpacer: {
      height: 40,
    },
    profileDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginHorizontal: 24,
    },
    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingVertical: 16,
    },
    codeInfo: {
      flex: 1,
    },
    codeLabel: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 10,
      color: theme.colors.textSecondary,
      letterSpacing: 0.8,
      marginBottom: 2,
    },
    codeValue: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      fontSize: 16,
      letterSpacing: 1.5,
      fontWeight: '700',
      color: theme.colors.text,
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
      paddingHorizontal: 12,
      minHeight: 44,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceRaised,
    },
    codeBtnText: {
      fontFamily: theme.fonts.headingMedium,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.text,
    },
  });
