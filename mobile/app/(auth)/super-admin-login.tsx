import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, AlertCircle, ShieldAlert, ArrowLeft } from 'lucide-react-native';

import { useAuthStore } from '../../src/store/useAuthStore';
import { apiClient, classifyError } from '../../src/api';
import { theme } from '../../src/theme/theme';
import { Screen } from '../../src/components/Screen';
import { GlassCard } from '../../src/components/GlassCard';
import { Button } from '../../src/components/Button';
import { SUPER_ADMIN_LOGIN, FIELDS, COMMON, VALIDATION } from '../../src/constants/strings';

const schema = z.object({
  phone: z.string().min(1, VALIDATION.REQUIRED(FIELDS.PHONE)),
  password: z.string().min(1, VALIDATION.REQUIRED(FIELDS.PASSWORD)),
});
type FormData = z.infer<typeof schema>;

export default function SuperAdminLoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const setAuthData = useAuthStore((state) => state.setAuthData);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormData) => {
    setServerError(null);
    try {
      const response = await apiClient.post('/api/auth/login', {
        phone: values.phone,
        password: values.password,
      });
      if (response.data.success) {
        const { accessToken, refreshToken, role, userId, gymId } = response.data.data;
        await setAuthData(accessToken, refreshToken, role, userId, gymId ?? '');
        router.replace('/(tabs)');
      } else {
        setServerError(response.data.message || 'Login failed');
      }
    } catch (err: unknown) {
      const apiErr = classifyError(err);
      setServerError(apiErr.message);
    }
  };

  return (
    <Screen
      scrollable
      keyboardAvoiding
      contentContainerStyle={styles.scroll}
    >
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.back()}
        accessibilityLabel={COMMON.BACK}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <ArrowLeft color={theme.colors.text} size={22} />
      </TouchableOpacity>

      <GlassCard style={styles.card} contentStyle={styles.cardContent}>
        <View style={styles.iconCircle}>
          <ShieldAlert color={theme.colors.warning} size={40} />
        </View>
        <Text style={styles.title}>{SUPER_ADMIN_LOGIN.TITLE}</Text>
        <Text style={styles.subtitle}>{SUPER_ADMIN_LOGIN.SUBTITLE}</Text>

        {serverError && (
          <View style={styles.errorBanner}>
            <AlertCircle color={theme.colors.error} size={18} />
            <Text style={styles.errorText}>{serverError}</Text>
          </View>
        )}

        <Text style={styles.label}>{FIELDS.PHONE}</Text>
        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={[styles.inputRow, errors.phone && styles.inputError]}>
              <TextInput
                style={styles.inputField}
                placeholder={FIELDS.PHONE_PLACEHOLDER}
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="phone-pad"
                autoFocus
                returnKeyType="next"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>
          )}
        />
        {errors.phone && <Text style={styles.fieldError}>{errors.phone.message}</Text>}

        <Text style={[styles.label, { marginTop: 16 }]}>{FIELDS.PASSWORD}</Text>
        <View style={[styles.inputRow, errors.password && styles.inputError]}>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                ref={passwordRef}
                style={[styles.inputField, { paddingRight: 40 }]}
                placeholder="••••••••"
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                onSubmitEditing={handleSubmit(onSubmit)}
              />
            )}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            style={styles.eyeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {showPassword ? (
              <EyeOff color={theme.colors.primary} size={20} />
            ) : (
              <Eye color={theme.colors.textMuted} size={20} />
            )}
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.fieldError}>{errors.password.message}</Text>}

        <View style={styles.buttonWrapper}>
          <Button
            title={SUPER_ADMIN_LOGIN.SUBMIT}
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            size="md"
          />
        </View>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  card: {
    marginBottom: theme.spacing.xl,
  },
  cardContent: {
    padding: theme.spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(245, 181, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 181, 68, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.h1,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.40)',
    padding: 12,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.error,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 14,
    flex: 1,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    minHeight: 52,
    position: 'relative',
  },
  inputField: {
    flex: 1,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 15,
    color: theme.colors.text,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  eyeBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  fieldError: {
    ...theme.typography.small,
    color: theme.colors.error,
    marginTop: 4,
    marginLeft: 4,
  },
  buttonWrapper: {
    marginTop: theme.spacing.xl,
  },
});
