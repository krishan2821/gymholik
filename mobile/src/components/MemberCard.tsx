import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { differenceInDays, parseISO } from 'date-fns';
import { MessageCircle } from 'lucide-react-native';
import { theme } from '../theme/theme';
import { Member } from '../api/members';
import { useAuthStore } from '../store/useAuthStore';
import { GlassCard } from './GlassCard';
import { Avatar, AvatarStatus } from './Avatar';
import { Badge, BadgeVariant } from './Badge';
import { MaskedPhone, isPhoneMasked } from './MaskedPhone';

interface MemberCardProps {
  member: Member;
  onPress: () => void;
}

export const MemberCard = React.memo(({ member, onPress }: MemberCardProps) => {
  const { name, phone, photoUrl, currentMembership } = member;
  const role = useAuthStore((state) => state.role);
  const isTrainer = role === 'TRAINER';
  const masked = isPhoneMasked(phone);

  const getMembershipStatus = (): {
    badgeVariant: BadgeVariant;
    avatarStatus: AvatarStatus;
    text: string;
  } => {
    if (!currentMembership) {
      return { badgeVariant: 'error', avatarStatus: 'expired', text: 'No Plan' };
    }

    if (currentMembership.status === 'EXPIRED') {
      return { badgeVariant: 'error', avatarStatus: 'expired', text: 'Expired' };
    }

    try {
      const expiry = parseISO(currentMembership.expiryDate);
      const daysLeft = differenceInDays(expiry, new Date());

      if (daysLeft <= 5) {
        return {
          badgeVariant: 'warning',
          avatarStatus: 'expiring',
          text: daysLeft <= 0 ? 'Expiring today' : `Exp in ${daysLeft}d`,
        };
      }
    } catch {
      // Fallback if parsing fails
    }

    return { badgeVariant: 'success', avatarStatus: 'active', text: 'Active' };
  };

  const formatMoney = (paise: number) => `₹${paise / 100}`;

  const openWhatsApp = (e: any) => {
    e?.stopPropagation?.();
    if (masked || isTrainer) return;
    const message = `Hello ${name},\n`;
    Linking.openURL(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`);
  };

  const status = getMembershipStatus();

  return (
    <GlassCard style={styles.card} onPress={onPress}>
      <View style={styles.cardContent}>
        <View style={styles.avatarWrapper}>
          <Avatar
            photoUrl={photoUrl}
            name={name}
            status={status.avatarStatus}
            size="md"
          />
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Badge label={status.text} variant={status.badgeVariant} size="sm" />
          </View>

          <MaskedPhone phone={phone} textStyle={styles.phone} style={styles.phoneContainer} />

          {currentMembership ? (
            <>
              <Text style={styles.detailText} numberOfLines={1}>
                {currentMembership.planName}
              </Text>
              <Text style={styles.expiryText}>
                Expires:{' '}
                {new Date(currentMembership.expiryDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              {!isTrainer && currentMembership.duePaise > 0 && (
                <View style={styles.dueBadge}>
                  <Text style={styles.dueText}>
                    Due {formatMoney(currentMembership.duePaise)}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.detailText}>No active membership</Text>
          )}
        </View>

        {!masked && !isTrainer && (
          <TouchableOpacity
            style={styles.waButton}
            onPress={openWhatsApp}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={`WhatsApp ${name}`}
          >
            <MessageCircle color={theme.colors.primary} size={22} />
          </TouchableOpacity>
        )}
      </View>
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  card: {
    marginBottom: theme.spacing.md,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  avatarWrapper: {
    marginRight: theme.spacing.md,
  },
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
    ...theme.typography.h3,
    color: theme.colors.text,
    flex: 1,
    marginRight: theme.spacing.xs,
  },
  phoneContainer: {
    marginBottom: 4,
  },
  phone: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  detailText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  expiryText: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
  },
  dueBadge: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.35)',
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  dueText: {
    ...theme.typography.small,
    color: theme.colors.error,
    fontWeight: '700',
  },
  waButton: {
    minWidth: 44, // 44px tap target
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.raised,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginLeft: theme.spacing.xs,
  },
});

export default MemberCard;
