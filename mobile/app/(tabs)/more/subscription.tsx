import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { safeOpenURL } from '../../../src/utils/safeLinking';
import { MessageCircle, ShieldCheck, Sparkles } from 'lucide-react-native';
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

export default function SubscriptionScreen() {
  const { gymId, role } = useAuthStore();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { data: gymProfile } = useGymProfile();
  const upiId = process.env.EXPO_PUBLIC_UPI_ID;

  if (role !== 'OWNER') {
    return (
      <Screen safeTop={false}>
        <PageHeader title="Subscription" showBack onBack={() => safeBack('/(tabs)/more')} />
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  const isTrial = gymProfile?.status === 'TRIAL' || !gymProfile?.status;
  const statusText = isTrial ? 'Active Trial' : (gymProfile?.status || 'Active');

  let validTillText = '14 Days';
  if (gymProfile?.subscriptionValidTill) {
    try {
      const [y, m, d] = gymProfile.subscriptionValidTill.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      validTillText = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      validTillText = gymProfile.subscriptionValidTill;
    }
  }

  let daysLeftText = '14 Days';
  if (typeof gymProfile?.daysRemaining === 'number') {
    daysLeftText = `${gymProfile.daysRemaining} Days`;
  } else if (gymProfile?.subscriptionValidTill) {
    const [y, m, d] = gymProfile.subscriptionValidTill.split('-').map(Number);
    const target = new Date(y, m - 1, d).getTime();
    const now = new Date().setHours(0, 0, 0, 0);
    const diff = Math.max(0, Math.round((target - now) / (1000 * 60 * 60 * 24)));
    daysLeftText = `${diff} Days`;
  }

  const openWhatsApp = () => {
    const msg = SUBSCRIPTION.WHATSAPP_MSG(gymId || '');
    safeOpenURL(`https://wa.me/919999999999?text=${encodeURIComponent(msg)}`);
  };

  const upiPayLink = upiId ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=Gymholik&cu=INR` : '';

  return (
    <Screen safeTop={false} scrollable contentContainerStyle={styles.container}>
      <PageHeader title="Subscription" showBack onBack={() => safeBack('/(tabs)/more')} />

      {/* ── Single Plan Summary Card ─────────────────────────────── */}
      <GlassCard style={styles.card} contentStyle={styles.cardContent}>
        <View style={styles.planBadgeContainer}>
          <View style={styles.planIconCircle}>
            <Sparkles size={20} color={colors.primary} />
          </View>
          <Badge label={statusText} variant="success" size="md" />
        </View>

        <Text style={styles.planTitle}>{SUBSCRIPTION.PLAN_NAME}</Text>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{SUBSCRIPTION.STATUS_LABEL}</Text>
          <Text style={styles.infoValueActive}>{statusText}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{SUBSCRIPTION.VALID_TILL_LABEL}</Text>
          <Text style={styles.infoValue}>{validTillText}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{SUBSCRIPTION.DAYS_LEFT_LABEL}</Text>
          <Text style={styles.infoValueHighlight}>{daysLeftText}</Text>
        </View>
      </GlassCard>

      {/* ── Renewal / Support Section ────────────────────────────── */}
      <GlassCard style={styles.card} contentStyle={styles.cardContent}>
        <View style={styles.headerRow}>
          <ShieldCheck size={22} color={colors.primary} style={styles.headerIcon} />
          <Text style={styles.sectionTitle}>{SUBSCRIPTION.HOW_TO_RENEW_TITLE}</Text>
        </View>

        <Text style={styles.desc}>
          {upiId ? SUBSCRIPTION.HOW_TO_RENEW_DESC : 'Contact support to renew your Gymholik subscription.'}
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
        ) : (
          <View style={styles.noUpiContainer}>
            <Text style={styles.noUpiText}>Contact support to renew</Text>
          </View>
        )}

        <Button
          title={upiId ? 'Send screenshot on WhatsApp' : 'Contact support on WhatsApp'}
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
    container: {
      paddingHorizontal: 0,
      paddingBottom: 40,
    },
    card: {
      marginHorizontal: 20,
      marginBottom: theme.spacing.lg,
    },
    cardContent: {
      padding: theme.spacing.lg,
    },
    planBadgeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
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
    },
    planTitle: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 22,
      color: theme.colors.text,
      marginBottom: 4,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing.md,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    infoLabel: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    infoValue: {
      fontFamily: theme.fonts.bodyMedium,
      fontSize: 15,
      color: theme.colors.text,
      fontVariant: ['tabular-nums'],
    },
    infoValueActive: {
      fontFamily: theme.fonts.headingMedium,
      fontSize: 15,
      color: theme.colors.primary,
    },
    infoValueHighlight: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 16,
      color: theme.colors.text,
      fontVariant: ['tabular-nums'],
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
    noUpiContainer: {
      paddingVertical: 12,
      alignItems: 'center',
      marginBottom: 8,
    },
    noUpiText: {
      fontFamily: theme.fonts.headingMedium,
      fontSize: 16,
      color: theme.colors.primary,
    },
    bottomSpacer: {
      height: 24,
    },
  });
