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
import { theme } from '../theme/theme';
import { Check, X } from 'lucide-react-native';

export interface FilterOption {
  label: string;
  value: string;
}

interface FilterBottomSheetProps {
  visible: boolean;
  title: string;
  options: FilterOption[];
  selectedValue: string;
  onSelect: (val: string) => void;
  onClose: () => void;
}

export const FilterBottomSheet: React.FC<FilterBottomSheetProps> = ({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.optionsList}>
                {options.map((opt) => {
                  const isSelected = opt.value === selectedValue;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.optionRow, isSelected && styles.optionRowActive]}
                      onPress={() => {
                        onSelect(opt.value);
                        onClose();
                      }}
                      activeOpacity={0.7}
                      {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
                    >
                      <Text style={[styles.optionLabel, isSelected && styles.optionLabelActive]}>
                        {opt.label}
                      </Text>
                      {isSelected && <Check size={18} color={theme.colors.primary} />}
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
    backgroundColor: 'rgba(5, 31, 32, 0.75)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: 'center',
    padding: Platform.OS === 'web' ? 16 : 0,
  },
  sheet: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 420 : '100%',
    backgroundColor: '#0B2B26',
    borderTopLeftRadius: Platform.OS === 'web' ? theme.radius.lg : theme.radius.xl,
    borderTopRightRadius: Platform.OS === 'web' ? theme.radius.lg : theme.radius.xl,
    borderRadius: Platform.OS === 'web' ? theme.radius.lg : undefined,
    borderWidth: 1,
    borderColor: 'rgba(218, 241, 222, 0.16)',
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(218, 241, 222, 0.08)',
  },
  title: {
    fontFamily: theme.fonts.headingBold,
    fontSize: 16,
    color: theme.colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  optionsList: {
    paddingVertical: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  optionRowActive: {
    backgroundColor: 'rgba(142, 182, 155, 0.08)',
  },
  optionLabel: {
    fontFamily: theme.fonts.bodyRegular,
    fontSize: 15,
    color: theme.colors.textMuted,
  },
  optionLabelActive: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.primary,
  },
});
