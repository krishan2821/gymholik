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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme/theme';
import { BackgroundImage } from './BackgroundImage';
import { AppContainer } from './AppContainer';

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
}

export const TAB_BAR_HEIGHT = 64;

/**
 * Returns required bottom padding for any scrollable container so that the last card
 * is never hidden behind the floating tab bar (bottom safe-area inset + 64 + 40).
 */
export function getScreenBottomPadding(insetsBottom: number = 0): number {
  return insetsBottom + TAB_BAR_HEIGHT + 40;
}

import { useBreakpoint } from '../hooks/useBreakpoint';

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
}) => {
  const { isDesktop } = useBreakpoint();
  const rawInsets = useSafeAreaInsets();
  const insets = Platform.OS === 'web' ? { top: 0, right: 0, bottom: 0, left: 0 } : (rawInsets ?? { top: 0, right: 0, bottom: 0, left: 0 });

  // Top padding: insets.top + 12 so nothing sits under status bar or Dynamic Island
  const topPad = safeTop ? insets.top + (isDesktop ? 16 : 12) : 0;
  // Bottom padding: on desktop no floating tab bar, on phone/tablet bottomPad reserves 104px
  const bottomPad = safeBottom
    ? isDesktop
      ? 32
      : getScreenBottomPadding(insets.bottom)
    : 0;

  const desktopContainerStyle = isDesktop
    ? {
        maxWidth: 1100,
        width: '100%' as any,
        alignSelf: 'center' as const,
        paddingHorizontal: 32,
      }
    : null;

  const content = scrollable ? (
    <ScrollView
      style={[styles.scroll, style]}
      contentContainerStyle={[
        styles.scrollContent,
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
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, desktopContainerStyle, style, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      {children}
    </View>
  );

  const innerContent = (
    <>
      <StatusBar style="light" />
      {withHeroImage && <BackgroundImage opacity={heroOpacity} />}
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
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
      <AppContainer style={styles.root}>
        {innerContent}
      </AppContainer>
    );
  }

  return (
    // Root fills whole screen edge-to-edge — background extends under status bar & home indicator
    <View style={styles.root}>
      {innerContent}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
});

export default Screen;
