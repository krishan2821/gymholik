import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { MessageCircle, QrCode, ShieldCheck, Sparkles, Copy, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { theme } from '../../../src/theme/theme';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { Screen } from '../../../src/components/Screen';
import { GlassCard } from '../../../src/components/GlassCard';
import { Button } from '../../../src/components/Button';
import { Badge } from '../../../src/components/Badge';
import { ErrorState } from '../../../src/components/ErrorState';
import { SUBSCRIPTION, ERRORS } from '../../../src/constants/strings';

export default function SubscriptionScreen() {
  const { gymId, gymCode, role } = useAuthStore();
  const [copied, setCopied] = React.useState(false);

  if (role !== 'OWNER') {
    return (
      <Screen safeTop={false}>
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  const copyCode = async () => {
    const code = gymCode || gymId;
    if (!code) return;
    await Clipboard.setStringAsync(code);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openWhatsApp = () => {
    const msg = SUBSCRIPTION.WHATSAPP_MSG(gymCode || gymId || '');
    Linking.openURL(`https://wa.me/919999999999?text=${encodeURIComponent(msg)}`);
  };

  return (
    <Screen safeTop={false} scrollable contentContainerStyle={styles.container}>
      <GlassCard style={styles.heroCard}>
        <View style={styles.planBadgeContainer}>
          <View style={styles.planIconCircle}>
            <Sparkles size={20} color={theme.colors.primary} />
          </View>
          <Badge label="Active Trial" variant="success" size="md" />
        </View>

        <Text style={styles.planTitle}>{SUBSCRIPTION.PLAN_NAME}</Text>

        <View style={styles.codeRow}>
          <Text style={styles.gymIdText}>Gym Code: {gymCode || gymId || 'N/A'}</Text>
          {(gymCode || gymId) && (
            <TouchableOpacity
              onPress={copyCode}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.copyBtn}
              accessibilityRole="button"
              accessibilityLabel="Copy gym code"
            >
              {copied ? (
                <Check size={14} color={theme.colors.primary} />
              ) : (
                <Copy size={14} color={theme.colors.textMuted} />
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{SUBSCRIPTION.STATUS_LABEL}</Text>
          <Text style={styles.infoValueActive}>Active Trial</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{SUBSCRIPTION.VALID_TILL_LABEL}</Text>
          <Text style={styles.infoValue}>31 Dec 2026</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{SUBSCRIPTION.DAYS_LEFT_LABEL}</Text>
          <Text style={styles.infoValueHighlight}>30 Days</Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.renewCard}>
        <View style={styles.headerRow}>
          <ShieldCheck size={22} color={theme.colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.sectionTitle}>{SUBSCRIPTION.HOW_TO_RENEW_TITLE}</Text>
        </View>

        <Text style={styles.desc}>{SUBSCRIPTION.HOW_TO_RENEW_DESC}</Text>

        <View style={styles.qrContainer}>
          <View style={styles.qrBox}>
            <QrCode color={theme.colors.text} size={110} />
          </View>
          <Text style={styles.upiText}>{SUBSCRIPTION.UPI_ID}</Text>
          <Text style={styles.upiSubtext}>Scan with any UPI App (GPay / PhonePe / Paytm)</Text>
        </View>

        <Button
          title={SUBSCRIPTION.WHATSAPP_BTN}
          onPress={openWhatsApp}
          variant="primary"
          size="lg"
          icon={<MessageCircle color={theme.colors.textOnPrimary} size={20} />}
        />
      </GlassCard>

      <View style={{ height: 24 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  heroCard: {
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
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
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 24,
    color: theme.colors.text,
    marginBottom: 4,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  gymIdText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  copyBtn: {
    padding: 4,
    marginLeft: 6,
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
    color: theme.colors.textMuted,
  },
  infoValue: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 15,
    color: theme.colors.text,
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
  },
  renewCard: {
    padding: theme.spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
    color: theme.colors.text,
  },
  desc: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    lineHeight: 22,
    marginBottom: theme.spacing.xl,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  qrBox: {
    width: 170,
    height: 170,
    backgroundColor: theme.colors.raised,
    borderRadius: theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  upiText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 4,
  },
  upiSubtext: {
    ...theme.typography.small,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
