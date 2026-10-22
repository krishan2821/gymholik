import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAppearanceStore } from '../theme/useAppearance';

export interface GlassCardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  onPress?: () => void;
  activeOpacity?: number;
  maxWidthToken?: 'form' | 'content' | number;
  variant?: 'surface' | 'surfaceRaised';
}

/**
 * Card / GlassCard component:
 * Solid surfaces with border and Android tonal elevation.
 * Strictly no glass or blur on cards per design system specification.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  contentStyle,
  onPress,
  activeOpacity = 0.85,
  maxWidthToken,
  variant = 'surface',
}) => {
  const { colors, radius, layout } = useTheme();
  const resolvedMode = useAppearanceStore((s) => s.resolvedMode);

  const ContainerComponent = onPress ? TouchableOpacity : View;
  const isInteractive = Boolean(onPress);

  const containerProps = isInteractive
    ? {
        onPress,
        activeOpacity,
        accessibilityRole: Platform.OS === 'web' ? undefined : ('button' as const),
        dataSet: { interactive: 'card' },
        ...(Platform.OS === 'web' ? ({ tabIndex: 0 } as any) : {}),
      }
    : {
        dataSet: { interactive: 'card' },
      };

  const resolvedMaxWidth =
    maxWidthToken === 'form'
      ? layout.maxWidth.form
      : maxWidthToken === 'content'
      ? layout.maxWidth.content
      : typeof maxWidthToken === 'number'
      ? maxWidthToken
      : layout.maxWidth.content;

  const cardBackground = variant === 'surfaceRaised' ? colors.surfaceRaised : colors.surface;

  const cardShadow =
    Platform.OS === 'ios'
      ? {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: resolvedMode === 'dark' ? 0.28 : 0.08,
          shadowRadius: 10,
        }
      : Platform.OS === 'android'
      ? {
          elevation: variant === 'surfaceRaised' ? 4 : 2,
        }
      : ({
          boxShadow: `0 2px 10px ${colors.shadow}1a`,
        } as any);

  return (
    <ContainerComponent
      {...containerProps}
      style={[
        {
          width: '100%',
          alignSelf: 'center',
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: cardBackground,
          overflow: 'hidden',
          maxWidth: resolvedMaxWidth,
        },
        cardShadow,
        isInteractive && Platform.OS === 'web' && { cursor: 'pointer' },
        style,
      ]}
    >
      <View style={[{ position: 'relative', zIndex: 1 }, contentStyle]}>
        {children}
      </View>
    </ContainerComponent>
  );
};

export const Card = GlassCard;

export default GlassCard;
