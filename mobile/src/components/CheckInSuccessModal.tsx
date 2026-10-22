import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Animated,
  useWindowDimensions,
  Platform,
} from 'react-native';
import * as Haptics from '../utils/safeHaptics';
import { Check } from 'lucide-react-native';
import { useTheme, useStyles, ThemeValue } from '../theme/ThemeContext';

interface CheckInSuccessModalProps {
  visible: boolean;
  memberName?: string;
  onDismiss: () => void;
  durationMs?: number;
}

export const CheckInSuccessModal: React.FC<CheckInSuccessModalProps> = ({
  visible,
  memberName = 'Member',
  onDismiss,
  durationMs = 1800,
}) => {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.7)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      // Reset values
      pulseScale.setValue(1);
      pulseOpacity.setValue(0.7);
      checkScale.setValue(0);
      contentFade.setValue(0);

      // Pulse animation
      Animated.parallel([
        Animated.timing(pulseScale, {
          toValue: 2.4,
          duration: 900,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0,
          duration: 900,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(checkScale, {
          toValue: 1,
          tension: 70,
          friction: 6,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(contentFade, {
          toValue: 1,
          duration: 350,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();

      const timer = setTimeout(() => {
        onDismiss();
      }, durationMs);

      return () => clearTimeout(timer);
    }
  }, [visible, durationMs, onDismiss]);

  const now = new Date();
  const currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        {/* Expanding pulse ring */}
        <Animated.View
          style={[
            styles.pulseCircle,
            {
              transform: [{ scale: pulseScale }],
              opacity: pulseOpacity,
            },
          ]}
        />

        {/* Content Box */}
        <Animated.View
          style={[
            styles.contentContainer,
            {
              opacity: contentFade,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.checkCircle,
              {
                transform: [{ scale: checkScale }],
              },
            ]}
          >
            <Check size={48} color={colors.textOnPrimary} strokeWidth={3.5} />
          </Animated.View>

          <Text style={styles.title}>Check-in Successful!</Text>
          <Text style={styles.memberName} numberOfLines={1}>
            {memberName}
          </Text>

          <View style={styles.timeBadge}>
            <Text style={styles.timeText}>{currentTime}</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.scrim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pulseCircle: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: theme.colors.primary,
    },
    contentContainer: {
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    checkCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      ...theme.shadows.glow,
    },
    title: {
      fontFamily: theme.fonts.headingBold,
      fontSize: 22,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 6,
    },
    memberName: {
      fontFamily: theme.fonts.headingSemiBold,
      fontSize: 18,
      color: theme.colors.primary,
      textAlign: 'center',
      marginBottom: 16,
    },
    timeBadge: {
      backgroundColor: theme.colors.primarySoft,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    timeText: {
      fontFamily: theme.fonts.bodyMedium,
      fontSize: 13,
      color: theme.colors.text,
    },
  });

export default CheckInSuccessModal;
