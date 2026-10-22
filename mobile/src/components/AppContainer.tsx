import React, { createContext, useContext } from 'react';
import { StyleSheet, View, Image, StyleProp, ViewStyle, Platform } from 'react-native';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useTheme } from '../theme/ThemeContext';
import { useAppearanceStore } from '../theme/useAppearance';
import { BRAND } from '../theme';

export const AppContainerContext = createContext<boolean>(false);

export interface AppContainerProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  columnStyle?: StyleProp<ViewStyle>;
}

/**
 * AppContainer — wraps authenticated screens.
 *
 * On tablet/desktop: centres content in a 480px column on the full-height bg.
 * On phone: full width.
 *
 * Background is a pre-rendered soft gradient WebP per brand × mode —
 * no runtime blur.
 */
export const AppContainer: React.FC<AppContainerProps> = ({
  children,
  style,
  columnStyle,
}) => {
  const { isPhone } = useBreakpoint();
  const alreadyInContainer = useContext(AppContainerContext);
  const { colors, layout } = useTheme();
  const resolvedMode = useAppearanceStore((s) => s.resolvedMode);

  // Brand × mode gradient WebP
  const bgAsset = getBgAsset(BRAND, resolvedMode);

  if (alreadyInContainer || isPhone) {
    return <View style={[{ flex: 1, width: '100%' }, style]}>{children}</View>;
  }

  return (
    <AppContainerContext.Provider value={true}>
      <View style={[styles.outer, { backgroundColor: colors.bg }, style]}>
        {Platform.OS === 'web' && (
          <View style={styles.backdropWrap} pointerEvents="none">
            <Image
              source={bgAsset}
              style={styles.outerBgImage}
              resizeMode="cover"
            />
          </View>
        )}
        <View
          style={[
            styles.column,
            {
              maxWidth: layout.maxWidth.column,
              backgroundColor: colors.bg,
              borderColor: colors.border,
            },
            Platform.OS === 'web' && ({
              boxShadow: `0 0 36px ${colors.scrim}`,
            } as any),
            columnStyle,
          ]}
        >
          {children}
        </View>
      </View>
    </AppContainerContext.Provider>
  );
};

function getBgAsset(brand: string, mode: string) {
  if (brand === 'ember' && mode === 'light') {
    return require('../../assets/images/bg-ember-light.webp');
  }
  if (brand === 'ember') {
    return require('../../assets/images/bg-ember-dark.webp');
  }
  if (mode === 'light') {
    return require('../../assets/images/bg-cobalt-light.webp');
  }
  return require('../../assets/images/bg-cobalt-dark.webp');
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: '100%',
    height: '100%',
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
  outerBgImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    ...(Platform.OS === 'web'
      ? ({
          objectPosition: 'top center',
          objectFit: 'cover',
        } as any)
      : {}),
  },
  column: {
    flex: 1,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
});

export default AppContainer;
