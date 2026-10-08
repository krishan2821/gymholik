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
  /** @deprecated — use contentContainerStyle paddingBottom instead */
  safeBottom?: boolean;
  safeTop?: boolean;
  keyboardAvoiding?: boolean;
}

export const TAB_BAR_HEIGHT = 64;

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

  // Top padding: insets.top + 12 so no content sits under status bar or Dynamic Island
  const topPad = safeTop ? insets.top + 12 : 0;
  // Bottom padding: tabBarHeight + insets.bottom + 24 so last card is never hidden behind floating tab bar
  const bottomPad = safeBottom ? TAB_BAR_HEIGHT + insets.bottom + 24 : 0;

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
    // Root fills the whole screen edge-to-edge — background extends under status bar & home indicator
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
    // No top/bottom inset here — we want background to bleed behind status bar & home indicator
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
