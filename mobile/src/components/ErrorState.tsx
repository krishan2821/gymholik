import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useTheme, useStyles, ThemeValue } from '../theme/ThemeContext';
import { STATES } from '../constants/strings';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message = STATES.ERROR_TITLE,
  onRetry,
  retryLabel = STATES.ERROR_RETRY,
}) => {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <AlertCircle color={colors.danger} size={40} />
      </View>
      {title && <Text style={styles.title}>{title}</Text>}
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <View style={styles.buttonWrapper}>
          <Button
            title={retryLabel}
            onPress={onRetry}
            variant="secondary"
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
      backgroundColor: theme.colors.chipDangerBg,
      borderWidth: 1,
      borderColor: theme.colors.danger,
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

export default ErrorState;
