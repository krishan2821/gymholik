import React from 'react';
import { Image, StyleSheet, StyleProp, ImageStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const logoMintAsset = require('../../assets/images/logo-mint.png');

export interface GymholikLogoProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
  variant?: 'primary' | 'card' | 'text' | 'plain';
  tintColor?: string;
}

export const GymholikLogo: React.FC<GymholikLogoProps> = ({
  size = 64,
  style,
  variant = 'plain',
  tintColor,
}) => {
  const { colors } = useTheme();

  // If explicit tintColor provided, use it; otherwise primary on card/primary variant, text on plain/text variant
  const resolvedTintColor =
    tintColor ?? (variant === 'primary' || variant === 'card' ? colors.primary : colors.text);

  return (
    <Image
      source={logoMintAsset}
      style={[
        styles.logo,
        {
          width: size,
          height: size * (606 / 766), // maintain aspect ratio of logo mark
          tintColor: resolvedTintColor,
        },
        style,
      ]}
      resizeMode="contain"
      accessibilityLabel="Gymholik Logo"
    />
  );
};

const styles = StyleSheet.create({
  logo: {
    backgroundColor: 'transparent',
  },
});

export default GymholikLogo;
