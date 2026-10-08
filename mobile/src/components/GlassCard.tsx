import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { theme } from '../theme/theme';

export interface GlassCardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  onPress?: () => void;
  activeOpacity?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  contentStyle,
  intensity = 24,
  onPress,
  activeOpacity = 0.85,
}) => {
  const ContainerComponent = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { onPress, activeOpacity } : {};

  return (
    <ContainerComponent
      {...containerProps}
      style={[styles.card, style]}
    >
      <BlurView
        intensity={intensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.innerContent, contentStyle]}>
        {children}
      </View>
    </ContainerComponent>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.glass,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassBg,
    overflow: 'hidden',
    ...(Platform.OS === 'ios'
      ? theme.shadows.glass
      : {
          elevation: 4,
          shadowColor: theme.colors.primary,
        }),
  },
  innerContent: {
    position: 'relative',
    zIndex: 1,
  },
});

export default GlassCard;
