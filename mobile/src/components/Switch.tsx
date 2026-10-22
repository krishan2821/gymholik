import React from 'react';
import {
  Switch as RNSwitch,
  SwitchProps as RNSwitchProps,
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { safeSelectionAsync } from '../utils/safeHaptics';

export interface SwitchProps extends Omit<RNSwitchProps, 'trackColor' | 'thumbColor'> {
  platformOverride?: 'ios' | 'android';
}

export const Switch: React.FC<SwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  platformOverride,
  style,
  ...rest
}) => {
  const { colors } = useTheme();
  const isAndroid = platformOverride ? platformOverride === 'android' : Platform.OS === 'android';

  const handleChange = (newVal: boolean) => {
    if (disabled) return;
    safeSelectionAsync().catch(() => {});
    onValueChange?.(newVal);
  };

  const trackColor = {
    false: colors.border,
    true: colors.primary,
  };

  const thumbColor = isAndroid
    ? value
      ? colors.surface
      : colors.textSecondary
    : colors.surface;

  return (
    <View style={styles.accessibleTouchTarget}>
      <RNSwitch
        value={value}
        onValueChange={handleChange}
        disabled={disabled}
        trackColor={trackColor}
        thumbColor={thumbColor}
        ios_backgroundColor={colors.border}
        style={style}
        {...rest}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  accessibleTouchTarget: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Switch;
