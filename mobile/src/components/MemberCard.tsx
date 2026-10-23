import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { safeOpenURL } from '../utils/safeLinking';
import { differenceInDays, parseISO } from 'date-fns';
import { MessageCircle, AlertCircle } from 'lucide-react-native';
import { Member } from '../api/members';
import { useAuthStore } from '../store/useAuthStore';
import { GlassCard } from './GlassCard';
import { Avatar, AvatarStatus } from './Avatar';
import { Badge, BadgeVariant } from './Badge';
import { MaskedPhone, isPhoneMasked } from './MaskedPhone';
import { formatMoney, formatDate } from '../utils/formatters';
import { useTheme, useStyles, ThemeValue, ColorMode } from '../theme/ThemeContext';

export interface MemberCardProps {
  member: Member;
  onPress: () => void;
  mode?: ColorMode;
}

export const MemberCard = React.memo(
  ({ member, onPress, mode }: MemberCardProps) => {
    const { colors, fonts, spacing, radius } = useTheme();
    const styles = useStyles(makeStyles);
  const { name, phone, photoUrl, currentMembership } = member;
  const role = useAuthStore((state) => state.role);
  const isTrainer = role === 'TRAINER';
  const masked = isPhoneMasked(phone);

  const hasUpcomingRenewal = Boolean(
    member.currentExpiry && (
      member.status === 'UPCOMING' ||
      (currentMembership?.expiryDate && member.currentExpiry > currentMembership.expiryDate)
    )
  );

  const getMembershipStatus = (): {
    badgeVariant: BadgeVariant;
    avatarStatus: AvatarStatus;
    text: string;
  } => {
    if (!currentMembership) {
      if (member.status === 'UPCOMING' || hasUpcomingRenewal) {
        return { badgeVariant: 'upcoming', avatarStatus: 'active', text: 'Upcoming' };
      }
      return { badgeVariant: 'expired', avatarStatus: 'expired', text: 'No Plan' };
    }

    if (currentMembership.status === 'UPCOMING' || member.status === 'UPCOMING') {
      return { badgeVariant: 'upcoming', avatarStatus: 'active', text: 'Upcoming' };
    }

    if (currentMembership.status === 'EXPIRED') {
      return { badgeVariant: 'expired', avatarStatus: 'expired', text: 'Expired' };
    }

    try {
      const expiry = parseISO(currentMembership.expiryDate);
      const daysLeft = differenceInDays(expiry, new Date());

      if (daysLeft <= 5 && !hasUpcomingRenewal) {
        return {
          badgeVariant: 'warning',
          avatarStatus: 'expiring',
          text: daysLeft <= 0 ? 'Expiring today' : `Exp in ${daysLeft}d`,
        };
      }
    } catch {
      // Fallback if parsing fails
    }

    return { badgeVariant: 'active', avatarStatus: 'active', text: 'Active' };
  };

  const openWhatsApp = (e: any) => {
    e?.stopPropagation?.();
    if (masked || isTrainer) return;
    const message = `Hello ${name},\n`;
    safeOpenURL(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`);
  };

  const status = getMembershipStatus();
  const duePaise = member.dueTotalPaise ?? currentMembership?.duePaise ?? 0;

  return (
    <GlassCard style={[styles.card, { marginBottom: spacing.md }]} contentStyle={[styles.cardRow, { padding: spacing.md }]}>
      <TouchableOpacity
        style={styles.cardMain}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${name}`}
      >
        <View style={[styles.avatarWrapper, { marginRight: spacing.md }]}>
          <Avatar
            photoUrl={photoUrl}
            name={name}
            status={status.avatarStatus}
            size="md"
          />
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.headerRow}>
            <Text style={[styles.name, { fontFamily: fonts.headingBold, color: colors.text }]} numberOfLines={1}>
              {name}
            </Text>
            <Badge label={status.text} variant={status.badgeVariant} size="sm" />
          </View>

          <MaskedPhone
            phone={phone}
            textStyle={{ fontFamily: fonts.bodyRegular, fontSize: 13, color: colors.textSecondary }}
            style={{ marginBottom: 4 }}
          />

          {currentMembership ? (
            <>
              <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>
                {currentMembership.planName}
              </Text>
              <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 12, color: colors.textSecondary }}>
                {hasUpcomingRenewal
                  ? `Renewed till ${formatDate(member.currentExpiry)}`
                  : `Expires: ${formatDate(currentMembership.expiryDate)}`}
              </Text>
              {!isTrainer && duePaise > 0 && (
                <View
                  style={[
                    styles.dueBadge,
                    {
                      backgroundColor: colors.chipDangerBg,
                      borderColor: colors.border,
                      borderRadius: radius.chip,
                    },
                  ]}
                >
                  <AlertCircle size={12} color={colors.chipDangerText} style={{ marginRight: 4 }} />
                  <Text
                    style={{
                      fontFamily: fonts.headingBold,
                      fontSize: 11,
                      color: colors.chipDangerText,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    Due {formatMoney(duePaise)}
                  </Text>
                </View>
              )}
            </>
          ) : hasUpcomingRenewal ? (
            <>
              <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 13, color: colors.textSecondary }}>Upcoming Membership</Text>
              <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 12, color: colors.textSecondary }}>
                Renewed till {formatDate(member.currentExpiry)}
              </Text>
            </>
          ) : (
            <Text style={{ fontFamily: fonts.bodyRegular, fontSize: 13, color: colors.textSecondary }}>No active membership</Text>
          )}
        </View>
      </TouchableOpacity>

      {!masked && !isTrainer && (
        <TouchableOpacity
          style={[
            styles.waButton,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
            },
          ]}
          onPress={openWhatsApp}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`WhatsApp ${name}`}
        >
          <MessageCircle color={colors.primary} size={22} />
        </TouchableOpacity>
      )}
    </GlassCard>
  );
  },
  (prev, next) => {
    return (
      prev.member === next.member &&
      prev.onPress === next.onPress &&
      prev.mode === next.mode
    );
  }
);

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
    card: {},
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cardMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatarWrapper: {},
    infoContainer: {
      flex: 1,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    name: {
      fontSize: 16,
      fontFamily: theme.fonts.headingBold,
      color: theme.colors.text,
      flex: 1,
      marginRight: 8,
    },
    dueBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      alignSelf: 'flex-start',
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      borderColor: theme.colors.border,
      borderRadius: theme.radius.chip,
    },
    waButton: {
      minWidth: 44, // 44px tap target
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceRaised,
      marginLeft: 8,
    },
  });

export default MemberCard;
