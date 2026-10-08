import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { BaseToastProps } from 'react-native-toast-message';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react-native';
import { theme } from '../theme/theme';

export const toastConfig = {
  success: (props: BaseToastProps) => (
    <View style={[styles.container, styles.successBorder]}>
      <View style={styles.iconContainer}>
        <CheckCircle2 color={theme.colors.primary} size={22} />
      </View>
      <View style={styles.textContainer}>
        {props.text1 && <Text style={styles.title}>{props.text1}</Text>}
        {props.text2 && <Text style={styles.message}>{props.text2}</Text>}
      </View>
    </View>
  ),

  error: (props: BaseToastProps) => (
    <View style={[styles.container, styles.errorBorder]}>
      <View style={styles.iconContainer}>
        <AlertCircle color={theme.colors.error} size={22} />
      </View>
      <View style={styles.textContainer}>
        {props.text1 && <Text style={styles.title}>{props.text1}</Text>}
        {props.text2 && <Text style={styles.message}>{props.text2}</Text>}
      </View>
    </View>
  ),

  info: (props: BaseToastProps) => (
    <View style={[styles.container, styles.infoBorder]}>
      <View style={styles.iconContainer}>
        <Info color={theme.colors.warning} size={22} />
      </View>
      <View style={styles.textContainer}>
        {props.text1 && <Text style={styles.title}>{props.text1}</Text>}
        {props.text2 && <Text style={styles.message}>{props.text2}</Text>}
      </View>
    </View>
  ),
};

const styles = StyleSheet.create({
  container: {
    width: '90%',
    minHeight: 56,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  successBorder: {
    borderColor: 'rgba(142, 182, 155, 0.45)',
  },
  errorBorder: {
    borderColor: 'rgba(255, 107, 107, 0.45)',
  },
  infoBorder: {
    borderColor: 'rgba(245, 181, 68, 0.45)',
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
    fontFamily: theme.fonts.headingBold,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  message: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
});

export default toastConfig;
