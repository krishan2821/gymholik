import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { create } from 'zustand';
import { useTheme, useStyles, ThemeValue } from '../theme/ThemeContext';
import { usePrefersReducedTransparency } from '../hooks/usePrefersReducedTransparency';
import { canUseGlass } from '../utils/platformCapabilities';
import { BlurView } from 'expo-blur';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  platformOverride?: 'ios26' | 'ios' | 'android' | 'web';
}

export interface ConfirmDialogOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  platformOverride?: 'ios26' | 'ios' | 'android' | 'web';
}

interface ConfirmDialogState {
  isOpen: boolean;
  options: ConfirmDialogOptions | null;
  show: (options: ConfirmDialogOptions) => void;
  hide: () => void;
}

export const useConfirmDialogStore = create<ConfirmDialogState>((set) => ({
  isOpen: false,
  options: null,
  show: (options) => set({ isOpen: true, options }),
  hide: () => set({ isOpen: false, options: null }),
}));

export const showConfirmDialog = (options: ConfirmDialogOptions) => {
  useConfirmDialogStore.getState().show(options);
};

export const hideConfirmDialog = () => {
  useConfirmDialogStore.getState().hide();
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
  platformOverride,
}) => {
  const { colors, fonts, radius } = useTheme();
  const styles = useStyles(makeStyles);
  const reducedTransparency = usePrefersReducedTransparency();
  const isGlass = canUseGlass({ platformOverride, reduceTransparency: reducedTransparency });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={[styles.overlay, { backgroundColor: colors.scrim }]}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.dialogCard,
                {
                  borderRadius: radius.card,
                  borderColor: isGlass ? colors.glassBorder : colors.border,
                  backgroundColor: isGlass ? colors.glassTint : colors.surface,
                },
                Platform.OS === 'android' && { elevation: 12 },
              ]}
            >
              {isGlass && (
                <BlurView
                  intensity={40}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Text style={[styles.title, { fontFamily: fonts.headingBold, color: colors.text }]}>
                {title}
              </Text>
              {message ? (
                <Text style={[styles.message, { fontFamily: fonts.bodyRegular, color: colors.textSecondary }]}>
                  {message}
                </Text>
              ) : null}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={onCancel}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <Text style={[styles.cancelText, { fontFamily: fonts.headingMedium, color: colors.text }]}>
                    {cancelText}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    {
                      backgroundColor: isDestructive ? colors.danger : colors.primary,
                      borderColor: isDestructive ? colors.danger : colors.primary,
                    },
                  ]}
                  onPress={onConfirm}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.confirmText,
                      {
                        fontFamily: fonts.headingBold,
                        color: colors.textOnPrimary,
                      },
                    ]}
                  >
                    {confirmText}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export const GlobalConfirmDialog: React.FC = () => {
  const { isOpen, options, hide } = useConfirmDialogStore();

  if (!isOpen || !options) return null;

  return (
    <ConfirmDialog
      visible={isOpen}
      title={options.title}
      message={options.message}
      confirmText={options.confirmText}
      cancelText={options.cancelText}
      isDestructive={options.isDestructive}
      platformOverride={options.platformOverride}
      onConfirm={() => {
        hide();
        options.onConfirm();
      }}
      onCancel={() => {
        hide();
        options.onCancel?.();
      }}
    />
  );
};

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
    borderWidth: 1,
    overflow: 'hidden',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
        }
      : {}),
  },
  title: {
    fontSize: 18,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingHorizontal: 18,
    minHeight: 44,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 14,
  },
  confirmText: {
    fontSize: 14,
  },
});

export default ConfirmDialog;
