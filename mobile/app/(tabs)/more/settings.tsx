import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Share,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Building2,
  Settings2,
  BellRing,
  Check,
  ShieldAlert,
  KeyRound,
  Copy,
  Share2,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { theme } from '../../../src/theme/theme';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { useGymSettings, useUpdateGymSettings } from '../../../src/api/more';
import { Screen } from '../../../src/components/Screen';
import { GlassCard } from '../../../src/components/GlassCard';
import { Button } from '../../../src/components/Button';
import { ErrorState } from '../../../src/components/ErrorState';
import { SETTINGS, ERRORS, FIELDS } from '../../../src/constants/strings';

const schema = z.object({
  gymName: z.string().min(2, 'Gym name is required'),
  address: z.string().optional(),
  allowExpiredCheckin: z.boolean(),
  reminderDays: z.string().regex(/^[0-9]+$/, 'Must be a valid number of days'),
  staffCanSeeFullPhone: z.boolean(),
});
type FormData = z.infer<typeof schema>;

export default function SettingsScreen() {
  const { role, gymCode } = useAuthStore();
  const { data: settings, isLoading, isError, refetch } = useGymSettings();
  const updateSettings = useUpdateGymSettings();
  const [copiedCode, setCopiedCode] = useState(false);

  const effectiveGymCode = settings?.gymCode || gymCode;

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
        message: `Join ${settings?.gymName || 'our gym'} on Gymholik! Use Gym Code: ${effectiveGymCode}`,
      });
    } catch {
      // User cancelled
    }
  };

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      gymName: '',
      address: '',
      allowExpiredCheckin: false,
      reminderDays: '5',
      staffCanSeeFullPhone: false,
    },
  });

  useEffect(() => {
    if (settings) {
      reset({
        gymName: settings.gymName,
        address: settings.address,
        allowExpiredCheckin: settings.allowExpiredCheckin,
        reminderDays: settings.reminderDays,
        staffCanSeeFullPhone: settings.staffCanSeeFullPhone ?? false,
      });
    }
  }, [settings, reset]);

  if (role !== 'OWNER') {
    return (
      <Screen safeTop={false}>
        <ErrorState message={ERRORS.PERMISSION_DENIED} onRetry={() => {}} />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen safeTop={false} style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen safeTop={false}>
        <ErrorState message={SETTINGS.LOAD_ERROR} onRetry={() => refetch()} />
      </Screen>
    );
  }

  const onSubmit = async (data: FormData) => {
    try {
      await updateSettings.mutateAsync({
        name: data.gymName,
        address: data.address,
        allowExpiredCheckin: data.allowExpiredCheckin,
        reminderDaysBefore: parseInt(data.reminderDays, 10) || 5,
        staffCanSeeFullPhone: data.staffCanSeeFullPhone,
      });
      Alert.alert('Saved', 'Gym settings updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update settings');
    }
  };

  return (
    <Screen
      safeTop={false}
      scrollable
      keyboardAvoiding
      contentContainerStyle={styles.container}
    >
      {/* ── Gym Code Card (Owner Only) ─────────────────────────── */}
      {effectiveGymCode ? (
        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <KeyRound size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Gym Code</Text>
          </View>
          <Text style={styles.gymCodeHint}>
            Share this code with trainers to allow them to register and link to your gym.
          </Text>
          <View style={styles.gymCodeDisplayRow}>
            <View style={styles.gymCodeBox}>
              <Text style={styles.gymCodeText}>{effectiveGymCode}</Text>
            </View>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleCopyGymCode}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Copy gym code"
            >
              {copiedCode ? (
                <Check size={16} color={theme.colors.primary} />
              ) : (
                <Copy size={16} color={theme.colors.primary} />
              )}
              <Text style={styles.actionBtnText}>{copiedCode ? 'Copied' : 'Copy'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleShareGymCode}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Share gym code"
            >
              <Share2 size={16} color={theme.colors.primary} />
              <Text style={styles.actionBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      ) : null}

      <GlassCard style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Building2 size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.sectionTitle}>{SETTINGS.SECTION_GENERAL}</Text>
        </View>

        <Text style={styles.label}>{SETTINGS.GYM_NAME_LABEL}</Text>
        <Controller
          control={control}
          name="gymName"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={[styles.input, errors.gymName && styles.inputError]}
              placeholder="Enter gym name"
              placeholderTextColor={theme.colors.textMuted}
              value={value}
              onChangeText={onChange}
            />
          )}
        />
        {errors.gymName && (
          <Text style={styles.errorText}>{errors.gymName.message}</Text>
        )}

        <Text style={[styles.label, { marginTop: 12 }]}>{FIELDS.ADDRESS}</Text>
        <Controller
          control={control}
          name="address"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={[styles.input, styles.textArea, errors.address && styles.inputError]}
              placeholder="Gym address or location"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={3}
              value={value}
              onChangeText={onChange}
            />
          )}
        />
        {errors.address && (
          <Text style={styles.errorText}>{errors.address.message}</Text>
        )}
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Settings2 size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.sectionTitle}>{SETTINGS.SECTION_CHECKIN}</Text>
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchTextContainer}>
            <Text style={styles.switchLabel}>{SETTINGS.ALLOW_EXPIRED_LABEL}</Text>
            <Text style={styles.switchDesc}>{SETTINGS.ALLOW_EXPIRED_DESC}</Text>
          </View>
          <Controller
            control={control}
            name="allowExpiredCheckin"
            render={({ field: { onChange, value } }) => (
              <Switch
                value={value}
                onValueChange={onChange}
                trackColor={{
                  false: theme.colors.raised,
                  true: theme.colors.primary,
                }}
                thumbColor={
                  value ? theme.colors.textOnPrimary : theme.colors.textMuted
                }
              />
            )}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.sectionHeaderRow}>
          <BellRing size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.subSectionTitle}>Expiry Reminders</Text>
        </View>

        <Text style={styles.label}>{SETTINGS.REMINDER_LABEL}</Text>
        <Controller
          control={control}
          name="reminderDays"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={[styles.input, errors.reminderDays && styles.inputError]}
              placeholder="e.g. 5"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              value={value}
              onChangeText={onChange}
            />
          )}
        />
        {errors.reminderDays && (
          <Text style={styles.errorText}>{errors.reminderDays.message}</Text>
        )}
      </GlassCard>

      {/* ── Staff Privacy Settings ─────────────────────────────── */}
      <GlassCard style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <ShieldAlert size={20} color={theme.colors.warning} style={{ marginRight: 8 }} />
          <Text style={styles.sectionTitle}>Privacy & Staff Access</Text>
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchTextContainer}>
            <Text style={styles.switchLabel}>{SETTINGS.STAFF_FULL_PHONE_LABEL}</Text>
            <Text style={[styles.switchDesc, { color: theme.colors.warning }]}>
              {SETTINGS.STAFF_FULL_PHONE_WARNING}
            </Text>
          </View>
          <Controller
            control={control}
            name="staffCanSeeFullPhone"
            render={({ field: { onChange, value } }) => (
              <Switch
                value={value}
                onValueChange={onChange}
                trackColor={{
                  false: theme.colors.raised,
                  true: theme.colors.primary,
                }}
                thumbColor={
                  value ? theme.colors.textOnPrimary : theme.colors.textMuted
                }
              />
            )}
          />
        </View>
      </GlassCard>

      <View style={styles.submitContainer}>
        <Button
          title={SETTINGS.SAVE_BTN}
          onPress={handleSubmit(onSubmit)}
          loading={updateSettings.isPending}
          disabled={updateSettings.isPending}
          variant="primary"
          size="lg"
        />
      </View>

      <View style={{ height: 40 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionCard: {
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
    color: theme.colors.text,
  },
  subSectionTitle: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 16,
    color: theme.colors.text,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    backgroundColor: theme.colors.raised,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    minHeight: 52,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 15,
    color: theme.colors.text,
  },
  textArea: {
    minHeight: 88,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    ...theme.typography.small,
    color: theme.colors.error,
    marginTop: 4,
    marginBottom: 6,
    marginLeft: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  switchLabel: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 15,
    color: theme.colors.text,
  },
  switchDesc: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 3,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
  },
  submitContainer: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  gymCodeHint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  gymCodeDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gymCodeBox: {
    flex: 1,
    backgroundColor: theme.colors.raised,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    height: 48,
    justifyContent: 'center',
  },
  gymCodeText: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 16,
    color: theme.colors.text,
    letterSpacing: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.raised,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    height: 48,
  },
  actionBtnText: {
    fontFamily: theme.fonts.headingMedium,
    fontSize: 13,
    color: theme.colors.text,
  },
});
