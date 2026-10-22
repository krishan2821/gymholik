import React from 'react';
import { StyleSheet, View, Text, Image, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export type AvatarStatus = 'active' | 'expiring' | 'expired' | 'none';
export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  photoUrl?: string | null;
  name?: string;
  status?: AvatarStatus;
  size?: AvatarSize;
  style?: StyleProp<ViewStyle>;
}

export const Avatar: React.FC<AvatarProps> = ({
  photoUrl,
  name = '',
  status = 'none',
  size = 'md',
  style,
}) => {
  const { colors, fonts, radius } = useTheme();
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [photoUrl]);

  const trimmedUrl =
    typeof photoUrl === 'string' &&
    photoUrl.trim().length > 4 &&
    photoUrl.trim().toLowerCase() !== 'null' &&
    photoUrl.trim().toLowerCase() !== 'undefined'
      ? photoUrl.trim()
      : null;

  const showImage = Boolean(trimmedUrl && !imageError);

  const getInitials = (text: string) => {
    if (!text || !text.trim()) return '?';
    const parts = text.trim().split(/\s+/);
    if (parts.length >= 2 && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return text.trim().substring(0, 2).toUpperCase();
  };

  const dimensionBy = {
    sm: 36,
    md: 48,
    lg: 64,
    xl: 80,
  }[size];

  const fontSizeBy = {
    sm: 13,
    md: 17,
    lg: 22,
    xl: 28,
  }[size];

  const ringColorBy = {
    active: colors.chipSuccessText,
    expiring: colors.chipWarningText,
    expired: colors.chipDangerText,
    none: 'transparent',
  }[status];

  const hasRing = status !== 'none';
  const ringWidth = size === 'sm' ? 2 : 2.5;

  return (
    <View
      style={[
        styles.outerContainer,
        {
          width: dimensionBy + (hasRing ? ringWidth * 3 : 0),
          height: dimensionBy + (hasRing ? ringWidth * 3 : 0),
          borderColor: ringColorBy,
          borderWidth: hasRing ? ringWidth : 0,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.innerContainer,
          {
            width: dimensionBy,
            height: dimensionBy,
            borderRadius: dimensionBy / 2,
            backgroundColor: colors.primarySoft, // initials on primarySoft
            borderColor: colors.border,
          },
        ]}
      >
        {showImage ? (
          <Image
            source={{ uri: trimmedUrl! }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <Text
            style={[
              styles.initials,
              {
                fontSize: fontSizeBy,
                fontFamily: fonts.headingBold,
                color: colors.primary, // initials tinted with primary
              },
            ]}
          >
            {getInitials(name)}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  innerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initials: {
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});

export default Avatar;
