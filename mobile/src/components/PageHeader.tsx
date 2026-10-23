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
import { safeBack } from '../utils/navigation';

export interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
}

/**
 * Shared PageHeader component:
 * - 44px back button with surfaceRaised fill
 * - Single-line title with ellipsis, vertically centred with back button
 * - Optional right action (compact pill or icon, max 40% width)
 * - Placed inside Screen which owns the 20px margins and safe area padding
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  showBack = false,
  onBack,
  rightAction,
  right,
  style,
  subtitle,
}) => {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const action = rightAction ?? right;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      safeBack();
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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft color={colors.text} size={20} strokeWidth={2.2} />
          </TouchableOpacity>
        )}
        <View style={styles.titleWrap}>
          <Text
            style={styles.title}
            numberOfLines={1}
            ellipsizeMode="tail"
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {action && <View style={styles.rightAction}>{action}</View>}
    </View>
  );
};

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 0,
      paddingTop: 4,
      paddingBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 52,
      width: '100%',
    },
    leftRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
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
      flexShrink: 0,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
    },
    titleWrap: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    title: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 20,
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
      justifyContent: 'flex-end',
      maxWidth: '40%',
      flexShrink: 0,
    },
  });

export default PageHeader;
