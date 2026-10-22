import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  StyleProp,
  ViewStyle,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Calendar, Clock, ChevronDown } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { formatDate } from '../utils/formatters';
import { safeSelectionAsync } from '../utils/safeHaptics';

export interface DatePickerProps {
  label?: string;
  value: Date;
  onChange: (date: Date) => void;
  mode?: 'date' | 'time';
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  platformOverride?: 'ios' | 'android' | 'web';
}

export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onChange,
  mode = 'date',
  minimumDate,
  maximumDate,
  disabled = false,
  error,
  containerStyle,
  platformOverride,
}) => {
  const { colors, fonts, radius, spacing } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(value);

  const activePlatform = platformOverride || Platform.OS;
  const isIOS = activePlatform === 'ios';
  const isAndroid = activePlatform === 'android';
  const isWeb = activePlatform === 'web';

  const handleOpen = () => {
    if (disabled) return;
    safeSelectionAsync().catch(() => {});
    setTempDate(value);
    setShowPicker(true);
  };

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (isAndroid) {
      setShowPicker(false);
      if (event.type === 'set' && selectedDate) {
        onChange(selectedDate);
      }
    } else if (isIOS) {
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const handleIOSDone = () => {
    setShowPicker(false);
    onChange(tempDate);
  };

  const handleIOSCancel = () => {
    setShowPicker(false);
  };

  const formatDisplayValue = (d: Date): string => {
    if (mode === 'time') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return formatDate(d.toISOString());
  };

  return (
    <View style={[{ width: '100%', marginBottom: spacing.md }, containerStyle]}>
      {label ? (
        <Text
          style={{
            fontFamily: fonts.headingMedium,
            fontSize: 12,
            fontWeight: '600',
            color: error ? colors.danger : colors.textSecondary,
            marginBottom: 6,
            marginLeft: 4,
          }}
        >
          {label}
        </Text>
      ) : null}

      {isWeb ? (
        <View
          style={[
            styles.trigger,
            {
              backgroundColor: colors.surfaceRaised,
              borderRadius: radius.input,
              borderColor: error ? colors.danger : colors.border,
            },
          ]}
        >
          {mode === 'time' ? (
            <Clock size={18} color={colors.primary} style={{ marginRight: 10 }} />
          ) : (
            <Calendar size={18} color={colors.primary} style={{ marginRight: 10 }} />
          )}
          <input
            type={mode === 'time' ? 'time' : 'date'}
            value={
              mode === 'time'
                ? value.toTimeString().substring(0, 5)
                : value.toISOString().substring(0, 10)
            }
            disabled={disabled}
            onChange={(e) => {
              if (e.target.value) {
                if (mode === 'time') {
                  const [hours, mins] = e.target.value.split(':').map(Number);
                  const d = new Date(value);
                  d.setHours(hours, mins);
                  onChange(d);
                } else {
                  onChange(new Date(e.target.value));
                }
              }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: fonts.bodyRegular,
              fontSize: '15px',
              color: colors.text,
              width: '100%',
              minHeight: '44px',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          />
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleOpen}
          disabled={disabled}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={label || (mode === 'time' ? 'Select time' : 'Select date')}
          style={[
            styles.trigger,
            {
              backgroundColor: colors.surfaceRaised,
              borderRadius: radius.input,
              borderColor: error ? colors.danger : colors.border,
              opacity: disabled ? 0.6 : 1,
            },
          ]}
        >
          <View style={styles.triggerLeft}>
            {mode === 'time' ? (
              <Clock size={18} color={colors.primary} style={{ marginRight: 10 }} />
            ) : (
              <Calendar size={18} color={colors.primary} style={{ marginRight: 10 }} />
            )}
            <Text
              style={{
                fontFamily: fonts.bodyRegular,
                fontSize: 15,
                color: colors.text,
              }}
            >
              {formatDisplayValue(value)}
            </Text>
          </View>
          <ChevronDown size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      {error ? (
        <Text
          style={{
            fontFamily: fonts.bodyRegular,
            fontSize: 11,
            color: colors.danger,
            marginTop: 4,
            marginLeft: 4,
          }}
        >
          {error}
        </Text>
      ) : null}

      {/* Android Native Picker */}
      {showPicker && isAndroid && (
        <DateTimePicker
          value={value}
          mode={mode}
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
        />
      )}

      {/* iOS Modal Sheet Picker */}
      {showPicker && isIOS && (
        <Modal
          transparent
          animationType="fade"
          visible={showPicker}
          onRequestClose={handleIOSCancel}
        >
          <View style={[styles.modalOverlay, { backgroundColor: colors.scrim }]}>
            <View
              style={[
                styles.iosPickerSheet,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: radius.sheet,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={[styles.iosPickerHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={handleIOSCancel} style={styles.headerBtn}>
                  <Text style={{ color: colors.textSecondary, fontFamily: fonts.headingMedium, fontSize: 15 }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: colors.text, fontFamily: fonts.headingBold, fontSize: 16 }}>
                  {label || (mode === 'time' ? 'Select Time' : 'Select Date')}
                </Text>
                <TouchableOpacity onPress={handleIOSDone} style={styles.headerBtn}>
                  <Text style={{ color: colors.primary, fontFamily: fonts.headingBold, fontSize: 15 }}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>

              <DateTimePicker
                value={tempDate}
                mode={mode}
                display="spinner"
                textColor={colors.text}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={handleChange}
                style={{ height: 216, width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  trigger: {
    minHeight: 52,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  iosPickerSheet: {
    borderWidth: 1,
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: 34,
  },
  iosPickerHeader: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerBtn: {
    padding: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
});

export default DatePicker;
