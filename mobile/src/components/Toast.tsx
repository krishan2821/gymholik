import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { BaseToastProps } from 'react-native-toast-message';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react-native';
import { useTheme, useStyles, ThemeValue } from '../theme/ThemeContext';
import { canUseGlass } from '../utils/platformCapabilities';
import { BlurView } from 'expo-blur';

export interface ToastItemProps extends BaseToastProps {
  type: 'success' | 'error' | 'info';
  platformOverride?: 'ios26' | 'ios' | 'android' | 'web';
}

export const ToastItem: React.FC<ToastItemProps> = ({
  type,
  text1,
  text2,
  platformOverride,
}) => {
  const { colors, fonts, radius, mode } = useTheme();
  const styles = useStyles(makeStyles);
  const isGlass = canUseGlass({ platformOverride });

  const iconBy = {
    success: <CheckCircle2 color={colors.success} size={22} />,
    error: <AlertCircle color={colors.danger} size={22} />,
    info: <Info color={colors.warning} size={22} />,
  }[type];

  const borderColor = {
    success: colors.border,
    error: colors.danger,
    info: colors.warning,
  }[type];

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: isGlass ? colors.glassBorder : borderColor,
          backgroundColor: isGlass ? colors.glassTint : colors.surfaceRaised,
          borderRadius: radius.card,
        },
        Platform.OS === 'android' && { elevation: 6 },
      ]}
    >
      {isGlass && (
        <BlurView
          intensity={40}
          tint={mode === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={styles.iconContainer}>{iconBy}</View>
      <View style={styles.textContainer}>
        {text1 ? (
          <Text style={[styles.title, { fontFamily: fonts.headingBold, color: colors.text }]}>
            {text1}
          </Text>
        ) : null}
        {text2 ? (
          <Text style={[styles.message, { fontFamily: fonts.bodyRegular, color: colors.textSecondary }]}>
            {text2}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

export const toastConfig = {
  success: (props: BaseToastProps) => <ToastItem type="success" {...props} />,
  error: (props: BaseToastProps) => <ToastItem type="error" {...props} />,
  info: (props: BaseToastProps) => <ToastItem type="info" {...props} />,
};

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
  container: {
    width: '90%',
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  iconContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
  },
});

export default toastConfig;
