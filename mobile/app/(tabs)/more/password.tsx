import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import { theme } from '../../../src/theme/theme';
import { useChangePassword } from '../../../src/api/more';
import { Screen } from '../../../src/components/Screen';
import { GlassCard } from '../../../src/components/GlassCard';
import { Button } from '../../../src/components/Button';
import { CHANGE_PASSWORD, VALIDATION } from '../../../src/constants/strings';

const schema = z
  .object({
    currentPassword: z
      .string()
      .min(1, VALIDATION.REQUIRED(CHANGE_PASSWORD.OLD_PASSWORD)),
    newPassword: z
      .string()
      .min(6, VALIDATION.MIN_LENGTH(CHANGE_PASSWORD.NEW_PASSWORD, 6)),
    confirmPassword: z
      .string()
      .min(1, VALIDATION.REQUIRED(CHANGE_PASSWORD.CONFIRM_PASSWORD)),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: VALIDATION.PASSWORD_CONFIRM,
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export default function ChangePasswordScreen() {
  const router = useRouter();
  const changePassword = useChangePassword();

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await changePassword.mutateAsync({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      Alert.alert('Success', CHANGE_PASSWORD.SUCCESS);
      router.back();
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to update password'
      );
    }
  };

  return (
    <Screen
      safeTop={false}
      scrollable
      keyboardAvoiding
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Lock size={28} color={theme.colors.primary} />
        </View>
        <Text style={styles.title}>{CHANGE_PASSWORD.SCREEN_TITLE}</Text>
        <Text style={styles.subtitle}>
          Update your account password with a strong secret key.
        </Text>
      </View>

      <GlassCard style={styles.card}>
        {/* Current Password */}
        <Text style={styles.label}>{CHANGE_PASSWORD.OLD_PASSWORD}</Text>
        <Controller
          control={control}
          name="currentPassword"
          render={({ field: { onChange, value } }) => (
            <View
              style={[
                styles.inputWrapper,
                errors.currentPassword && styles.inputWrapperError,
              ]}
            >
              <TextInput
                style={styles.input}
                secureTextEntry={!showCurrent}
                value={value}
                onChangeText={onChange}
                placeholder="Enter current password"
                placeholderTextColor={theme.colors.textMuted}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowCurrent((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel="Toggle current password visibility"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showCurrent ? (
                  <EyeOff size={20} color={theme.colors.textMuted} />
                ) : (
                  <Eye size={20} color={theme.colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          )}
        />
        {errors.currentPassword && (
          <Text style={styles.errorText}>{errors.currentPassword.message}</Text>
        )}

        {/* New Password */}
        <Text style={[styles.label, { marginTop: 14 }]}>
          {CHANGE_PASSWORD.NEW_PASSWORD}
        </Text>
        <Controller
          control={control}
          name="newPassword"
          render={({ field: { onChange, value } }) => (
            <View
              style={[
                styles.inputWrapper,
                errors.newPassword && styles.inputWrapperError,
              ]}
            >
              <TextInput
                style={styles.input}
                secureTextEntry={!showNew}
                value={value}
                onChangeText={onChange}
                placeholder="Enter new password (min. 6 characters)"
                placeholderTextColor={theme.colors.textMuted}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowNew((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel="Toggle new password visibility"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showNew ? (
                  <EyeOff size={20} color={theme.colors.textMuted} />
                ) : (
                  <Eye size={20} color={theme.colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          )}
        />
        {errors.newPassword && (
          <Text style={styles.errorText}>{errors.newPassword.message}</Text>
        )}

        {/* Confirm Password */}
        <Text style={[styles.label, { marginTop: 14 }]}>
          {CHANGE_PASSWORD.CONFIRM_PASSWORD}
        </Text>
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, value } }) => (
            <View
              style={[
                styles.inputWrapper,
                errors.confirmPassword && styles.inputWrapperError,
              ]}
            >
              <TextInput
                style={styles.input}
                secureTextEntry={!showConfirm}
                value={value}
                onChangeText={onChange}
                placeholder="Confirm your new password"
                placeholderTextColor={theme.colors.textMuted}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowConfirm((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel="Toggle confirm password visibility"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showConfirm ? (
                  <EyeOff size={20} color={theme.colors.textMuted} />
                ) : (
                  <Eye size={20} color={theme.colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          )}
        />
        {errors.confirmPassword && (
          <Text style={styles.errorText}>{errors.confirmPassword.message}</Text>
        )}

        <View style={styles.submitContainer}>
          <Button
            title={CHANGE_PASSWORD.SUBMIT}
            onPress={handleSubmit(onSubmit)}
            loading={changePassword.isPending}
            disabled={changePassword.isPending}
            variant="primary"
            size="lg"
          />
        </View>
      </GlassCard>

      <View style={{ height: 40 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.xl,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.md,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.raised,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 22,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  card: {
    padding: theme.spacing.xl,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 6,
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.raised,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  inputWrapperError: {
    borderColor: theme.colors.error,
  },
  input: {
    flex: 1,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 15,
    color: theme.colors.text,
    paddingVertical: 12,
  },
  eyeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...theme.typography.small,
    color: theme.colors.error,
    marginTop: 4,
    marginLeft: 4,
  },
  submitContainer: {
    marginTop: theme.spacing.xl,
  },
});
