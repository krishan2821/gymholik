import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme, useStyles, ThemeValue } from '../theme/ThemeContext';

export interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
}

/**
 * Shared PageHeader component:
 * - 20px side padding aligned with content
 * - Back button (when pushed/requested), not touching the column edge
 * - Title and optional subtitle
 * - Optional right action
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  showBack = false,
  onBack,
  rightAction,
  style,
  subtitle,
}) => {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.leftRow}>
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft color={colors.text} size={20} strokeWidth={2.2} />
          </TouchableOpacity>
        )}
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {rightAction && <View style={styles.rightAction}>{rightAction}</View>}
    </View>
  );
};

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 20, // 20px side padding aligned with column content
      paddingTop: 12,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 56,
      width: '100%',
    },
    leftRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 12,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
    },
    titleWrap: {
      flex: 1,
      justifyContent: 'center',
    },
    title: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 22,
      color: theme.colors.text,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    rightAction: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  });

export default PageHeader;
