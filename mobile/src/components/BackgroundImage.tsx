import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Image, StyleProp, ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme/theme';

const bgGymAsset = require('../../assets/images/bg-gym.webp');
const bgGymWebAsset = require('../../assets/images/bg-gym-web.jpg');

export interface BackgroundImageProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  opacity?: number;
  overlayColors?: [string, string, ...string[]];
  locations?: [number, number, ...number[]];
}

export const BackgroundImage: React.FC<BackgroundImageProps> = ({
  style,
  children,
  opacity = 0.85,
  // top 0→~120px: rgba(5,31,32,0.9) — status bar reads well
  // middle: 0.75 — image still visible
  // bottom: 0.92 — cards stay readable
  overlayColors = ['rgba(5, 31, 32, 0.90)', 'rgba(5, 31, 32, 0.75)', 'rgba(5, 31, 32, 0.92)'],
  locations = [0, 0.45, 1.0],
}) => {
  const imageAsset = Platform.OS === 'web' ? bgGymWebAsset : bgGymAsset;

  return (
    <View style={[styles.container, style]}>
      <Image
        source={imageAsset}
        style={[styles.image, { opacity }]}
        resizeMode="cover"
      />
      <LinearGradient
        colors={overlayColors}
        locations={locations}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
    width: '100%',
    maxWidth: theme.layout.maxWidth.column,
    alignSelf: 'center',
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    ...(Platform.OS === 'web'
      ? ({
          objectPosition: 'top',
          objectFit: 'cover',
        } as any)
      : {}),
  },
});

export default BackgroundImage;
