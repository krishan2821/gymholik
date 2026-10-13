import React, { createContext, useContext } from 'react';
import { StyleSheet, View, Image, StyleProp, ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useBreakpoint } from '../hooks/useBreakpoint';

const bgGymAsset = require('../../assets/images/bg-gym.webp');

export const AppContainerContext = createContext<boolean>(false);

export interface AppContainerProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  columnStyle?: StyleProp<ViewStyle>;
}

/**
 * AppContainer component used by the shared Screen component and authenticated layout.
 * - On tablet and desktop: centres app content in a column with max width 480 px on the
 *   full-height dark background (#051F20), with a subtle 1px border rgba(218,241,222,0.08)
 *   on both sides.
 * - On phone: full width.
 * - Prevents double-nesting via AppContainerContext.
 */
export const AppContainer: React.FC<AppContainerProps> = ({
  children,
  style,
  columnStyle,
}) => {
  const { isPhone } = useBreakpoint();
  const alreadyInContainer = useContext(AppContainerContext);

  if (alreadyInContainer || isPhone) {
    return <View style={[styles.innerRoot, style]}>{children}</View>;
  }

  return (
    <AppContainerContext.Provider value={true}>
      <View style={[styles.outer, style]}>
        {Platform.OS === 'web' && (
          <View style={styles.backdropWrap} pointerEvents="none">
            <Image
              source={bgGymAsset}
              style={styles.outerBgImage}
              resizeMode="cover"
            />
            {/* 0.92 Dark green overlay */}
            <View style={styles.overlay} />
            {/* Radial sage glow */}
            <View style={styles.radialGlow} />
          </View>
        )}
        <View style={[styles.column, styles.columnWide, columnStyle]}>
          {children}
        </View>
      </View>
    </AppContainerContext.Provider>
  );
};

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#051F20',
    alignItems: 'center',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          overflowX: 'hidden',
        } as any)
      : {}),
  },
  backdropWrap: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 31, 32, 0.92)',
  },
  radialGlow: {
    ...StyleSheet.absoluteFill,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'radial-gradient(circle at 50% 30%, rgba(142, 182, 155, 0.16) 0%, rgba(5, 31, 32, 0) 68%)',
        } as any)
      : {}),
  },
  innerRoot: {
    flex: 1,
    width: '100%',
  },
  column: {
    flex: 1,
    width: '100%',
    position: 'relative',
    backgroundColor: '#072728',
    overflow: 'hidden',
  },
  columnWide: {
    maxWidth: 480,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.08)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 36px rgba(0, 0, 0, 0.6), 0 0 10px rgba(0, 0, 0, 0.4)',
        } as any)
      : {}),
  },
  outerBgImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    opacity: 0.35,
    ...(Platform.OS === 'web'
      ? ({
          objectPosition: 'top center',
          objectFit: 'cover',
          filter: 'blur(8px)',
          transform: [{ scale: 1.05 }],
        } as any)
      : {}),
  },
});

export default AppContainer;
