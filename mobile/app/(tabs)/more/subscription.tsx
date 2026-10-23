import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { safeOpenURL } from '../../../src/utils/safeLinking';
import { MessageCircle, ShieldCheck, Sparkles, AlertTriangle } from 'lucide-react-native';
import { useTheme, useStyles, ThemeValue } from '../../../src/theme/ThemeContext';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { Screen } from '../../../src/components/Screen';
import { PageHeader } from '../../../src/components/PageHeader';
import { GlassCard } from '../../../src/components/GlassCard';
import { Button } from '../../../src/components/Button';
import { Badge } from '../../../src/components/Badge';
import { ErrorState } from '../../../src/components/ErrorState';
import { SUBSCRIPTION, ERRORS } from '../../../src/constants/strings';
import { safeBack } from '../../../src/utils/navigation';
import { useGymProfile } from '../../../src/api/more';
import { formatDate } from '../../../src/utils/formatters';

export default function SubscriptionScreen() {
  const { gymId, role } = useAuthStore();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { data: gymProfile } = useGymProfile();
  const upiId = process.env.EXPO_PUBLIC_UPI_ID;

  if (role !== 'OWNER') {
    return (
      <Screen safeTop={true}>
        <PageHeader title="Subscription" showBack onBack={() => safeBack('/(tabs)/more')} />
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  const isTrial = gymProfile?.status === 'TRIAL' || !gymProfile?.status;
  const planName = isTrial ? 'Free trial' : (gymProfile?.planName || 'Gymholik Premium');
  const statusBadgeLabel = isTrial ? 'Trial' : (gymProfile?.status || 'Active');

  let validTillDisplay = '26 Oct 2026';
  if (gymProfile?.subscriptionValidTill) {
    validTillDisplay = formatDate(gymProfile.subscriptionValidTill);
  }

  // Days remaining: default to 3 for active trial if not specified by backend
  let daysRemaining = 3;
  if (typeof gymProfile?.daysRemaining === 'number') {
    daysRemaining = gymProfile.daysRemaining;
  } else if (gymProfile?.subscriptionValidTill) {
    const [y, m, d] = gymProfile.subscriptionValidTill.split('-').map(Number);
    const target = new Date(y, m - 1, d).getTime();
    const now = new Date().setHours(0, 0, 0, 0);
    const diff = Math.round((target - now) / (1000 * 60 * 60 * 24));
    if (!isNaN(diff)) {
      daysRemaining = Math.max(0, diff);
    }
  }

  // 14-day progress calculation (clamped between 0 and 14 days)
  const totalDays = 14;
  const elapsedDays = Math.max(0, Math.min(totalDays, totalDays - daysRemaining));
  const progressPercent = Math.min(100, Math.max(5, Math.round((elapsedDays / totalDays) * 100)));

  const openWhatsApp = () => {
    const msg = SUBSCRIPTION.WHATSAPP_MSG(gymId || '');
    safeOpenURL(`https://wa.me/919999999999?text=${encodeURIComponent(msg)}`);
  };

  const upiPayLink = upiId ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=Gymholik&cu=INR` : '';

  return (
    <Screen safeTop={true} scrollable>
      <PageHeader title="Subscription" showBack onBack={() => safeBack('/(tabs)/more')} />

      {/* ── Warning Banner (When 7 days or fewer remain) ─────────── */}
      {daysRemaining <= 7 && (
        <View style={styles.warningBanner}>
          <AlertTriangle size={20} color={colors.warning} style={styles.warningBannerIcon} />
          <View style={styles.warningBannerContent}>
            <Text style={styles.warningBannerTitle}>
              {daysRemaining === 0 ? 'Trial expires today' : `Trial ends in ${daysRemaining} days`}
            </Text>
            <Text style={styles.warningBannerDesc}>
              Renew your subscription now to ensure uninterrupted access for your gym and staff.
            </Text>
          </View>
        </View>
      )}

      {/* ── Single Plan Summary Card ─────────────────────────────── */}
      <GlassCard style={styles.card} contentStyle={styles.cardContent}>
        <View style={styles.planHeaderRow}>
          <View style={styles.planTitleContainer}>
            <View style={styles.planIconCircle}>
              <Sparkles size={20} color={colors.primary} />
            </View>
            <Text style={styles.planTitle}>{planName}</Text>
          </View>
          {/* Exactly ONE status badge */}
          <Badge label={statusBadgeLabel} variant={isTrial ? 'warning' : 'success'} size="md" />
        </View>

        <View style={styles.divider} />

        {/* Trial ends date & days left */}
        <View style={styles.progressHeaderRow}>
          <Text style={styles.progressHeaderLeft}>
            {isTrial ? `Trial ends ${validTillDisplay}` : `Renews on ${validTillDisplay}`}
          </Text>
          <Text style={styles.progressHeaderRight}>
            {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
          </Text>
        </View>

        {/* 14-day progress bar */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: daysRemaining <= 7 ? colors.warning : colors.primary,
              },
            ]}
          />
        </View>
        <View style={styles.progressFooterRow}>
          <Text style={styles.progressFooterLabel}>Day 1</Text>
          <Text style={styles.progressFooterLabel}>14-day trial period</Text>
          <Text style={styles.progressFooterLabel}>Day 14</Text>
        </View>
      </GlassCard>

      {/* ── Renewal / Support Section ────────────────────────────── */}
      <GlassCard style={styles.card} contentStyle={styles.cardContent}>
        <View style={styles.headerRow}>
          <ShieldCheck size={22} color={colors.primary} style={styles.headerIcon} />
          <Text style={styles.sectionTitle}>Renew your subscription</Text>
        </View>

        <Text style={styles.desc}>
          {upiId
            ? SUBSCRIPTION.HOW_TO_RENEW_DESC
            : 'Get in touch to renew your subscription and keep your gym running smoothly.'}
        </Text>

        {upiId ? (
          <View style={styles.qrContainer}>
            <View style={styles.qrBox}>
              <QRCode
                value={upiPayLink}
                size={140}
                color={colors.qrForeground}
                backgroundColor={colors.qrBackground}
              />
            </View>
            <Text style={styles.upiText}>{upiId}</Text>
            <Text style={styles.upiSubtext}>Scan with any UPI App (GPay / PhonePe / Paytm)</Text>
          </View>
        ) : null}

        {/* Exactly ONE primary button */}
        <Button
          title={upiId ? 'Send screenshot on WhatsApp' : 'Renew on WhatsApp'}
          onPress={openWhatsApp}
          variant="primary"
          size="md"
          fullWidth
          icon={<MessageCircle color={colors.textOnPrimary} size={20} />}
        />
      </GlassCard>

      <View style={styles.bottomSpacer} />
    </Screen>
  );
}

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.colors.surfaceRaised,
      borderWidth: 1,
      borderColor: theme.colors.warning,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    warningBannerIcon: {
      marginRight: theme.spacing.sm,
      marginTop: 2,
    },
    warningBannerContent: {
      flex: 1,
    },
    warningBannerTitle: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 14,
      color: theme.colors.text,
      marginBottom: 2,
    },
    warningBannerDesc: {
      ...theme.typography.small,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    card: {
      width: '100%',
      marginBottom: theme.spacing.lg,
    },
    cardContent: {
      padding: theme.spacing.lg,
    },
    planHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    planTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: theme.spacing.sm,
    },
    planIconCircle: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.surfaceRaised,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.sm,
    },
    planTitle: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 20,
      color: theme.colors.text,
      flexShrink: 1,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing.md,
    },
    progressHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    progressHeaderLeft: {
      fontFamily: theme.fonts.headingMedium,
      fontSize: 14,
      color: theme.colors.text,
    },
    progressHeaderRight: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 14,
      color: theme.colors.primary,
      fontVariant: ['tabular-nums'],
    },
    progressBarTrack: {
      height: 8,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.surfaceRaised,
      overflow: 'hidden',
      marginBottom: 6,
    },
    progressBarFill: {
      height: '100%',
      borderRadius: theme.radius.full,
    },
    progressFooterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    progressFooterLabel: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      fontSize: 11,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    headerIcon: {
      marginRight: 8,
    },
    sectionTitle: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 18,
      color: theme.colors.text,
    },
    desc: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      lineHeight: 22,
      marginBottom: theme.spacing.lg,
    },
    qrContainer: {
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    qrBox: {
      padding: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.sm,
    },
    upiText: {
      fontFamily: theme.fonts.headingMedium,
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: 4,
    },
    upiSubtext: {
      ...theme.typography.small,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    bottomSpacer: {
      height: 24,
    },
  });
