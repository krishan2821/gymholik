import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { usePrefersReducedTransparency } from '../hooks/usePrefersReducedTransparency';
import { canUseGlass } from '../utils/platformCapabilities';
import { BlurView } from 'expo-blur';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterBottomSheetProps {
  visible: boolean;
  title: string;
  options: FilterOption[];
  selectedValue: string;
  onSelect: (val: string) => void;
  onClose: () => void;
  platformOverride?: 'ios26' | 'ios' | 'android' | 'web';
}

export const FilterBottomSheet: React.FC<FilterBottomSheetProps> = ({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
  platformOverride,
}) => {
  const { colors, fonts, radius } = useTheme();
  const reducedTransparency = usePrefersReducedTransparency();
  const isGlass = canUseGlass({ platformOverride, reduceTransparency: reducedTransparency });

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.overlay, { backgroundColor: colors.scrim }]}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheet,
                {
                  borderTopLeftRadius: radius.sheet, // 28 radius
                  borderTopRightRadius: radius.sheet, // 28 radius
                  borderTopWidth: 1,
                  borderLeftWidth: 1,
                  borderRightWidth: 1,
                  borderColor: isGlass ? colors.glassBorder : colors.border,
                  backgroundColor: isGlass ? colors.glassTint : colors.surface,
                },
              ]}
            >
              {isGlass && (
                <BlurView
                  intensity={40}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
              )}

              {/* Drag handle */}
              <View style={styles.handleContainer}>
                <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
              </View>

              <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Text style={[styles.title, { fontFamily: fonts.headingBold, color: colors.text }]}>
                  {title}
                </Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <X size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.optionsList}>
                {options.map((opt) => {
                  const isSelected = opt.value === selectedValue;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.optionRow,
                        isSelected && { backgroundColor: colors.primarySoft },
                      ]}
                      onPress={() => {
                        onSelect(opt.value);
                        onClose();
                      }}
                      activeOpacity={0.7}
                      {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
                    >
                      <Text
                        style={[
                          styles.optionLabel,
                          {
                            fontFamily: isSelected ? fonts.headingBold : fonts.bodyRegular,
                            color: isSelected ? colors.primary : colors.text,
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && <Check size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: 'center',
    padding: Platform.OS === 'web' ? 16 : 0,
  },
  sheet: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 440 : '100%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    overflow: 'hidden',
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 16,
  },
  closeBtn: {
    padding: 6,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsList: {
    paddingVertical: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    minHeight: 48,
  },
  optionLabel: {
    fontSize: 15,
  },
});

export default FilterBottomSheet;
