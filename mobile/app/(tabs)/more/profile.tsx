import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { User, Phone, Building2, ShieldCheck, Check } from 'lucide-react-native';
import { theme } from '../../../src/theme/theme';
import { useCurrentUser, useUpdateCurrentUser } from '../../../src/api/auth';
import { Screen } from '../../../src/components/Screen';
import { GlassCard } from '../../../src/components/GlassCard';
import { Badge } from '../../../src/components/Badge';
import { Button } from '../../../src/components/Button';
import { ErrorState } from '../../../src/components/ErrorState';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^[0-9]{10}$/, 'Mobile number must be exactly 10 digits'),
});

type FormData = z.infer<typeof schema>;

export default function EditProfileScreen() {
  const router = useRouter();
  const { data: currentUser, isLoading, isError, refetch } = useCurrentUser();
  const updateCurrentUser = useUpdateCurrentUser();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      phone: '',
    },
  });

  useEffect(() => {
    if (currentUser) {
      reset({
        name: currentUser.name || '',
        phone: currentUser.phone || '',
      });
    }
  }, [currentUser, reset]);

  if (isLoading) {
    return (
      <Screen safeTop={false} style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  if (isError || !currentUser) {
    return (
      <Screen safeTop={false}>
        <ErrorState message="Failed to load profile" onRetry={() => refetch()} />
      </Screen>
    );
  }

  const isOwner = currentUser.role === 'OWNER';

  const onSubmit = async (data: FormData) => {
    try {
      await updateCurrentUser.mutateAsync({
        name: data.name.trim(),
        phone: data.phone.trim(),
      });
      Alert.alert('Success', 'Profile updated successfully.');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update profile');
    }
  };

  return (
    <Screen
      safeTop={false}
      scrollable
      keyboardAvoiding
      contentContainerStyle={styles.container}
    >
      {/* ── Role & Gym Context Card ───────────────────────────────── */}
      <GlassCard style={styles.infoCard} contentStyle={styles.infoContent}>
        <View style={styles.avatar}>
          <User color={theme.colors.primary} size={36} />
        </View>
        <View style={styles.infoMeta}>
          <Text style={styles.infoName}>{currentUser.name}</Text>
          <View style={styles.badgeRow}>
            <Badge
              label={currentUser.role}
              variant={isOwner ? 'success' : 'neutral'}
              size="sm"
            />
          </View>
          {currentUser.gymName ? (
            <View style={styles.gymRow}>
              <Building2 size={14} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
              <Text style={styles.gymNameText}>{currentUser.gymName}</Text>
            </View>
          ) : null}
        </View>
      </GlassCard>

      {/* ── Edit Form Card ────────────────────────────────────────── */}
      <GlassCard style={styles.formCard}>
        <Text style={styles.sectionTitle}>Personal Details</Text>

        <Text style={styles.label}>Full Name</Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value } }) => (
            <View style={[styles.inputWrapper, errors.name && styles.inputWrapperError]}>
              <User size={18} color={theme.colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor={theme.colors.textMuted}
                value={value}
                onChangeText={onChange}
                cursorColor="#8EB69B"
                selectionColor="#8EB69B"
              />
            </View>
          )}
        />
        {errors.name && <Text style={styles.errorText}>{errors.name.message}</Text>}

        <Text style={[styles.label, { marginTop: 16 }]}>Mobile Number</Text>
        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, value } }) => (
            <View style={[styles.inputWrapper, errors.phone && styles.inputWrapperError]}>
              <Phone size={18} color={theme.colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="10-digit mobile number"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
                value={value}
                onChangeText={onChange}
                cursorColor="#8EB69B"
                selectionColor="#8EB69B"
              />
            </View>
          )}
        />
        {errors.phone && <Text style={styles.errorText}>{errors.phone.message}</Text>}

        <View style={styles.submitContainer}>
          <Button
            title="Save Changes"
            onPress={handleSubmit(onSubmit)}
            loading={updateCurrentUser.isPending}
            disabled={updateCurrentUser.isPending}
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
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    marginBottom: theme.spacing.lg,
  },
  infoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(142, 182, 155, 0.15)',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  infoMeta: {
    flex: 1,
  },
  infoName: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 18,
    color: theme.colors.text,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  gymRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  gymNameText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  formCard: {
    padding: theme.spacing.xl,
  },
  sectionTitle: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 17,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
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
    paddingHorizontal: 14,
    minHeight: 52,
  },
  inputWrapperError: {
    borderColor: theme.colors.error,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 15,
    color: theme.colors.text,
    paddingVertical: 12,
  },
  errorText: {
    ...theme.typography.small,
    color: theme.colors.error,
    marginTop: 4,
    marginBottom: 4,
    marginLeft: 4,
  },
  submitContainer: {
    marginTop: theme.spacing.xl,
  },
});
