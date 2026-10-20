import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import { SafeBlurView } from './SafeBlurView';
import { theme } from '../theme/theme';

export interface GlassCardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  onPress?: () => void;
  activeOpacity?: number;
  maxWidthToken?: 'form' | 'content' | number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  contentStyle,
  intensity = 24,
  onPress,
  activeOpacity = 0.85,
  maxWidthToken,
}) => {
  const ContainerComponent = onPress ? TouchableOpacity : View;
  const isInteractive = Boolean(onPress);

  const containerProps = isInteractive
    ? {
        onPress,
        activeOpacity,
        accessibilityRole: Platform.OS === 'web' ? undefined : ('button' as const),
        accessibilityLabel: undefined,
        dataSet: { interactive: 'card' },
        ...(Platform.OS === 'web' ? ({ tabIndex: 0 } as any) : {}),
      }
    : {
        dataSet: { interactive: 'card' },
      };

  const resolvedMaxWidth =
    maxWidthToken === 'form'
      ? theme.layout.maxWidth.form
      : maxWidthToken === 'content'
      ? theme.layout.maxWidth.content
      : typeof maxWidthToken === 'number'
      ? maxWidthToken
      : theme.layout.maxWidth.content;

  return (
    <ContainerComponent
      {...containerProps}
      style={[
        styles.card,
        { maxWidth: resolvedMaxWidth },
        isInteractive && Platform.OS === 'web' && styles.webPointer,
        style,
      ]}
    >
      <SafeBlurView
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
    width: '100%',
    alignSelf: 'center',
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
  webPointer: {
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  innerContent: {
    position: 'relative',
    zIndex: 1,
  },
});

export default GlassCard;
