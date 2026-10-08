import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Image, StyleProp, ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme/theme';

const bgGymAsset = require('../../assets/images/bg-gym.webp');

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
  return (
    <View style={[styles.container, style]}>
      <Image
        source={bgGymAsset}
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
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
});

export default BackgroundImage;
