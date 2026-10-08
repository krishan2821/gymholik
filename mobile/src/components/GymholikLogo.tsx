import React from 'react';
import { Image, StyleSheet, StyleProp, ImageStyle } from 'react-native';

const logoMintAsset = require('../../assets/images/logo-mint.png');

export interface GymholikLogoProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export const GymholikLogo: React.FC<GymholikLogoProps> = ({ size = 64, style }) => {
  return (
    <Image
      source={logoMintAsset}
      style={[
        styles.logo,
        {
          width: size,
          height: size * (606 / 766), // maintain aspect ratio of logo mark
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
