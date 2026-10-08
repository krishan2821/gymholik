import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { theme } from '../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.spring(checkScale, {
          toValue: 1,
          tension: 70,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(contentFade, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        onDismiss();
      }, durationMs);

      return () => clearTimeout(timer);
    }
  }, [visible, durationMs, onDismiss, pulseScale, pulseOpacity, checkScale, contentFade]);

  if (!visible) return null;

  const currentTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        {/* Full-screen Sage Pulse Effect */}
        <Animated.View
          style={[
            styles.pulseCircle,
            {
              transform: [{ scale: pulseScale }],
              opacity: pulseOpacity,
            },
          ]}
        />

        {/* Center Checkmark Container */}
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
            <Check size={48} color={theme.colors.textOnPrimary} strokeWidth={3.5} />
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.94)',
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
    backgroundColor: 'rgba(142, 182, 155, 0.18)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(142, 182, 155, 0.35)',
  },
  timeText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.text,
  },
});
