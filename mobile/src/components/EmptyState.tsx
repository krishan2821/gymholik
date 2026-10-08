import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SearchX } from 'lucide-react-native';
import { theme } from '../theme/theme';
import { STATES } from '../constants/strings';
import { Button } from './Button';

export interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  onAction?: () => void;
  actionLabel?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message = STATES.EMPTY_TITLE,
  icon,
  onAction,
  actionLabel,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        {icon || <SearchX color={theme.colors.primary} size={40} />}
      </View>
      {title && <Text style={styles.title}>{title}</Text>}
      <Text style={styles.message}>{message}</Text>
      {onAction && actionLabel && (
        <View style={styles.buttonWrapper}>
          <Button
            title={actionLabel}
            onPress={onAction}
            size="sm"
            fullWidth={false}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  iconWrapper: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: theme.colors.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  buttonWrapper: {
    marginTop: theme.spacing.lg,
  },
});

export default EmptyState;
