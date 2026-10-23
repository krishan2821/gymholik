import React from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  StyleProp,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
  StatusBar as NativeStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { getTopScrimColors, getBottomScrimColors } from '../theme/theme';
import { useAppearanceStore } from '../theme/useAppearance';
import { BackgroundImage } from './BackgroundImage';
import { AppContainer } from './AppContainer';
import { useBreakpoint } from '../hooks/useBreakpoint';

export interface ScreenProps {
  children?: React.ReactNode;
  scrollable?: boolean;
  withHeroImage?: boolean;
  heroOpacity?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  safeBottom?: boolean;
  safeTop?: boolean;
  keyboardAvoiding?: boolean;
  contained?: boolean;
  hasFab?: boolean;
  noPadding?: boolean;
}

export const TAB_BAR_HEIGHT = 64;

export function getScreenBottomPadding(insetsBottom: number = 0, hasFab: boolean = false): number {
  return TAB_BAR_HEIGHT + insetsBottom + 24 + (hasFab ? 72 : 0);
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  scrollable = false,
  withHeroImage = false,
  heroOpacity = 0.85,
  refreshing = false,
  onRefresh,
  style,
  contentContainerStyle,
  safeBottom = true,
  safeTop = true,
  keyboardAvoiding = false,
  contained = true,
  hasFab = false,
  noPadding = false,
}) => {
  const { colors } = useTheme();
  const { isDesktop } = useBreakpoint();
  const resolvedMode = useAppearanceStore((s) => s.resolvedMode);
  const rawInsets = useSafeAreaInsets();
  const insets =
    Platform.OS === 'web'
      ? { top: 0, right: 0, bottom: 0, left: 0 }
      : rawInsets ?? { top: 0, right: 0, bottom: 0, left: 0 };

  const topPad = safeTop ? insets.top + (isDesktop ? 16 : 8) : 0;
  const bottomPad = safeBottom
    ? isDesktop
      ? 32
      : getScreenBottomPadding(insets.bottom, hasFab)
    : 0;
  const horizontalPad = noPadding ? 0 : isDesktop ? 32 : 20;

  const desktopContainerStyle = isDesktop
    ? {
        maxWidth: 1100,
        width: '100%' as any,
        alignSelf: 'center' as const,
      }
    : null;

  const statusStyle = resolvedMode === 'dark' ? 'light' : 'dark';

  const content = scrollable ? (
    <ScrollView
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[
        { flexGrow: 1, paddingHorizontal: horizontalPad },
        desktopContainerStyle,
        contentContainerStyle,
        { paddingTop: topPad, paddingBottom: bottomPad },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        { flex: 1, paddingHorizontal: horizontalPad },
        desktopContainerStyle,
        style,
        { paddingTop: topPad, paddingBottom: bottomPad },
      ]}
    >
      {children}
    </View>
  );

  const innerContent = (
    <>
      <NativeStatusBar
        barStyle={statusStyle === 'light' ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
      <StatusBar style={statusStyle} />
      {safeTop && insets.top > 0 && (
        <LinearGradient
          colors={getTopScrimColors(colors.bg)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top + 24,
            zIndex: 100,
          }}
          pointerEvents="none"
        />
      )}
      {safeBottom && !isDesktop && (
        <LinearGradient
          colors={getBottomScrimColors(colors.bg)}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: TAB_BAR_HEIGHT + insets.bottom + 16,
            zIndex: 90,
          }}
          pointerEvents="none"
        />
      )}
      {withHeroImage && <BackgroundImage />}
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </>
  );

  if (contained && !isDesktop) {
    return (
      <AppContainer style={{ flex: 1, backgroundColor: colors.bg }}>
        {innerContent}
      </AppContainer>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg }]}>
      {innerContent}
    </View>
  );
};

export default Screen;
