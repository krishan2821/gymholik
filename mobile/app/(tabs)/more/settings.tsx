import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Switch,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Building2,
  Settings2,
  BellRing,
  ShieldAlert,
  QrCode,
  ExternalLink,
} from 'lucide-react-native';
import { theme } from '../../../src/theme/theme';
import { useAuthStore } from '../../../src/store/useAuthStore';
import {
  useGymSettings,
  useUpdateGymSettings,
  useCollectionInfo,
  useUpdateCollectionInfo,
} from '../../../src/api/more';
import { Screen } from '../../../src/components/Screen';
import { GlassCard } from '../../../src/components/GlassCard';
import { Button } from '../../../src/components/Button';
import { ErrorState } from '../../../src/components/ErrorState';
import { safeOpenURL } from '../../../src/utils/safeLinking';
import { SETTINGS, ERRORS, FIELDS, COMMON } from '../../../src/constants/strings';

const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

const schema = z.object({
  gymName: z.string().min(2, 'Gym name is required'),
  address: z.string().optional(),
  allowExpiredCheckin: z.boolean(),
  reminderDays: z.string().regex(/^[0-9]+$/, 'Must be a valid number of days'),
  staffCanSeeFullPhone: z.boolean(),
  upiId: z
    .string()
    .refine((val) => !val || UPI_REGEX.test(val.trim()), {
      message: 'Invalid UPI ID format (e.g. yourgym@upi or 9876543210@okaxis)',
    })
    .optional(),
  upiName: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function SettingsScreen() {
  const { role } = useAuthStore();
  const { data: settings, isLoading, isError, refetch } = useGymSettings();
  const { data: collectionInfo, refetch: refetchCollection } = useCollectionInfo();
  const updateSettings = useUpdateGymSettings();
  const updateCollectionInfo = useUpdateCollectionInfo();
  const submitLockRef = useRef(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      gymName: '',
      address: '',
      allowExpiredCheckin: false,
      reminderDays: '5',
      staffCanSeeFullPhone: false,
      upiId: '',
      upiName: '',
    },
  });

  const currentUpiId = watch('upiId');
  const currentUpiName = watch('upiName');

  useEffect(() => {
    if (settings) {
      reset({
        gymName: settings.gymName,
        address: settings.address,
        allowExpiredCheckin: settings.allowExpiredCheckin,
        reminderDays: settings.reminderDays,
        staffCanSeeFullPhone: settings.staffCanSeeFullPhone ?? false,
        upiId: collectionInfo?.upiId || '',
        upiName: collectionInfo?.upiName || '',
      });
    }
  }, [settings, collectionInfo, reset]);

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
    if (submitLockRef.current || updateSettings.isPending) return;
    submitLockRef.current = true;
    try {
      await updateSettings.mutateAsync({
        name: data.gymName,
        address: data.address,
        allowExpiredCheckin: data.allowExpiredCheckin,
        reminderDaysBefore: parseInt(data.reminderDays, 10) || 5,
        staffCanSeeFullPhone: data.staffCanSeeFullPhone,
      });

      if (data.upiId && data.upiId.trim().length > 0) {
        await updateCollectionInfo.mutateAsync({
          upiId: data.upiId.trim(),
          upiName: data.upiName?.trim() || undefined,
        });
      }

      Toast.show({ type: 'success', text1: COMMON.SUCCESS, text2: SETTINGS.SAVE_SUCCESS });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: COMMON.ERROR,
        text2: err.response?.data?.message || 'Failed to update settings',
      });
    } finally {
      submitLockRef.current = false;
    }
  };

  return (
    <Screen
      safeTop={false}
      scrollable
      keyboardAvoiding
      contentContainerStyle={styles.container}
    >
      <GlassCard style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Building2 size={20} color={theme.colors.primary} style={styles.headerIcon} />
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

        <Text style={[styles.label, styles.labelSpaced]}>{FIELDS.ADDRESS}</Text>
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
          <Settings2 size={20} color={theme.colors.primary} style={styles.headerIcon} />
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
          <BellRing size={18} color={theme.colors.primary} style={styles.headerIcon} />
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
          <ShieldAlert size={20} color={theme.colors.warning} style={styles.headerIcon} />
          <Text style={styles.sectionTitle}>Privacy & Staff Access</Text>
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchTextContainer}>
            <Text style={styles.switchLabel}>{SETTINGS.STAFF_FULL_PHONE_LABEL}</Text>
            <Text style={[styles.switchDesc, styles.warningDesc]}>
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

      {/* ── UPI Fee Collection Settings ─────────────────────────── */}
      <GlassCard style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <QrCode size={20} color={theme.colors.primary} style={styles.headerIcon} />
          <Text style={styles.sectionTitle}>Fee Collection UPI</Text>
        </View>

        <Text style={styles.sectionDesc}>
          This is used to generate the member QR code and payment links for collecting fees directly to your gym bank account.
        </Text>

        <Text style={[styles.label, styles.labelSpaced]}>Collection UPI ID</Text>
        <Controller
          control={control}
          name="upiId"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={[styles.input, errors.upiId && styles.inputError]}
              placeholder="e.g. yourgym@upi or 9876543210@okaxis"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={value}
              onChangeText={onChange}
            />
          )}
        />
        {errors.upiId && (
          <Text style={styles.errorText}>{errors.upiId.message}</Text>
        )}

        <Text style={[styles.label, styles.labelSpaced]}>Name on UPI (Optional)</Text>
        <Controller
          control={control}
          name="upiName"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="e.g. Gymholik Fitness Club"
              placeholderTextColor={theme.colors.textMuted}
              value={value}
              onChangeText={onChange}
            />
          )}
        />

        {currentUpiId && !errors.upiId ? (
          <TouchableOpacity
            style={styles.testUpiBtn}
            onPress={async () => {
              const testUrl = `upi://pay?pa=${encodeURIComponent(
                currentUpiId.trim()
              )}&pn=${encodeURIComponent(
                currentUpiName?.trim() || 'Gym'
              )}&am=1.00&cu=INR&tn=Gymholik%20Test%20Fee`;
              const opened = await safeOpenURL(testUrl);
              if (!opened) {
                Toast.show({
                  type: 'info',
                  text1: 'UPI Test Link',
                  text2: 'No UPI app installed or testing on web. URI is valid.',
                });
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Test UPI link"
          >
            <ExternalLink size={16} color={theme.colors.primary} />
            <Text style={styles.testUpiBtnText}>Test UPI link on device</Text>
          </TouchableOpacity>
        ) : null}
      </GlassCard>

      <View style={styles.submitContainer}>
        <Button
          title={SETTINGS.SAVE_BTN}
          onPress={handleSubmit(onSubmit)}
          loading={updateSettings.isPending || updateCollectionInfo.isPending}
          disabled={updateSettings.isPending || updateCollectionInfo.isPending}
          variant="primary"
          size="lg"
        />
      </View>

      <View style={styles.bottomSpacer} />
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
  headerIcon: {
    marginRight: 8,
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
  labelSpaced: {
    marginTop: 12,
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
  warningDesc: {
    color: theme.colors.warning,
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
  sectionDesc: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  testUpiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(218, 241, 222, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.16)',
    alignSelf: 'flex-start',
    minHeight: 44,
  },
  testUpiBtnText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 14,
    color: theme.colors.primary,
  },
  bottomSpacer: {
    height: 40,
  },
});
