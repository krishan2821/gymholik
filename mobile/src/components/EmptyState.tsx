import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Receipt, CalendarCheck, Users, Search } from 'lucide-react-native';
import { useTheme, useStyles, ThemeValue } from '../theme/ThemeContext';
import { STATES } from '../constants/strings';
import { Button } from './Button';

export type EmptyStateType = 'payments' | 'attendance' | 'members' | 'search' | 'default';

export interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  type?: EmptyStateType;
  onAction?: () => void;
  actionLabel?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message = STATES.EMPTY_TITLE,
  icon,
  type = 'default',
  onAction,
  actionLabel,
}) => {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const resolveIcon = () => {
    if (icon) return icon;
    switch (type) {
      case 'payments':
        return <Receipt color={colors.primary} size={38} />;
      case 'attendance':
        return <CalendarCheck color={colors.primary} size={38} />;
      case 'members':
        return <Users color={colors.primary} size={38} />;
      case 'search':
        return <Search color={colors.primary} size={38} />;
      default:
        return <Users color={colors.primary} size={38} />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        {resolveIcon()}
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

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
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
      backgroundColor: theme.colors.primarySoft,
      borderWidth: 1,
      borderColor: theme.colors.primarySoft,
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
      color: theme.colors.textSecondary,
      textAlign: 'center',
      maxWidth: 280,
    },
    buttonWrapper: {
      marginTop: theme.spacing.lg,
    },
  });

export default EmptyState;
