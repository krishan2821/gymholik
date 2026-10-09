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
}

export const TAB_BAR_HEIGHT = 64;

/**
 * Returns required bottom padding for any scrollable container so that the last card
 * is never hidden behind the floating tab bar (bottom safe-area inset + 64 + 40).
 */
export function getScreenBottomPadding(insetsBottom: number = 0): number {
  return insetsBottom + TAB_BAR_HEIGHT + 40;
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
}) => {
  const insets = useSafeAreaInsets();

  // Top padding: insets.top + 12 so nothing sits under status bar or Dynamic Island
  const topPad = safeTop ? insets.top + 12 : 0;
  // Bottom padding: insets.bottom + TAB_BAR_HEIGHT (64) + 40 so last card is never hidden behind tab bar
  const bottomPad = safeBottom ? getScreenBottomPadding(insets.bottom) : 0;

  const content = scrollable ? (
    <ScrollView
      style={[styles.scroll, style]}
      contentContainerStyle={[
        styles.scrollContent,
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
    <View style={[styles.content, style, { paddingTop: topPad }]}>{children}</View>
  );

  return (
    // Root fills whole screen edge-to-edge — background extends under status bar & home indicator
    <View style={styles.root}>
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
