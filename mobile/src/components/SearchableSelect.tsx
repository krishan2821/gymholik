import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
  Pressable,
  StyleProp,
  ViewStyle,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { ChevronDown, Check, Search, X, Edit3 } from 'lucide-react-native';
import { useTheme, useStyles, ThemeValue } from '../theme/ThemeContext';
import { COMMON, REGISTER } from '../constants/strings';
import { canUseGlass } from '../utils/platformCapabilities';
import { BlurView } from 'expo-blur';

export interface SearchableSelectOption {
  readonly label: string;
  readonly value: string;
}

export interface SearchableSelectProps {
  label?: string;
  value?: string;
  options: readonly SearchableSelectOption[] | SearchableSelectOption[];
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
  allowOther?: boolean;
  otherPlaceholder?: string;
  disabled?: boolean;
  helperText?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value,
  options,
  placeholder = REGISTER.SEARCHABLE_SELECT.SEARCH_PLACEHOLDER,
  error,
  onChange,
  allowOther = false,
  otherPlaceholder = REGISTER.SEARCHABLE_SELECT.OTHER_INPUT_PLACEHOLDER,
  disabled = false,
  helperText,
  containerStyle,
}) => {
  const { colors, isDark } = useTheme();
  const styles = useStyles(makeStyles);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reduceMotion, setReduceMotion] = useState(false);

  // Free text "Other" state
  const isCustomValue = useMemo(() => {
    if (!value) return false;
    return !options.some((o) => o.value === value);
  }, [value, options]);

  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherText, setOtherText] = useState(isCustomValue ? value || '' : '');
  const searchInputRef = useRef<TextInput>(null);
  const otherInputRef = useRef<TextInput>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  // Sync otherText when value changes from outside
  useEffect(() => {
    if (isCustomValue && value) {
      setOtherText(value);
    }
  }, [value, isCustomValue]);

  // Selected label lookup
  const selectedLabel = useMemo(() => {
    if (!value) return '';
    const match = options.find((o) => o.value === value);
    if (match) return match.label;
    if (isCustomValue) return value;
    return value;
  }, [value, options, isCustomValue]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) =>
      item.label.toLowerCase().includes(q) || item.value.toLowerCase().includes(q)
    );
  }, [options, searchQuery]);

  const handleOpen = () => {
    if (disabled) return;
    setSearchQuery('');
    setShowOtherInput(isCustomValue);
    if (isCustomValue && value) {
      setOtherText(value);
    }
    setModalVisible(true);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    setModalVisible(false);
    setShowOtherInput(false);
  };

  const handleSelectOption = (itemValue: string) => {
    onChange(itemValue);
    handleClose();
  };

  const handleSelectOther = () => {
    setShowOtherInput(true);
    setTimeout(() => {
      otherInputRef.current?.focus();
    }, 100);
  };

  const handleConfirmOther = () => {
    const trimmed = otherText.trim();
    if (trimmed) {
      onChange(trimmed);
      handleClose();
    }
  };

  const isOtherSelected = isCustomValue || (showOtherInput && !!otherText);

  return (
    <View style={[styles.root, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Trigger Button */}
      <TouchableOpacity
        style={[
          styles.trigger,
          error ? styles.triggerError : null,
          disabled ? styles.triggerDisabled : null,
        ]}
        onPress={handleOpen}
        activeOpacity={0.75}
        disabled={disabled}
        accessibilityRole="combobox"
        accessibilityLabel={label || placeholder}
        accessibilityState={{ expanded: modalVisible, disabled }}
      >
        <Text
          style={[styles.triggerText, !value && styles.placeholderText]}
          numberOfLines={1}
        >
          {selectedLabel || placeholder}
        </Text>
        <ChevronDown size={20} color={colors.primary} />
      </TouchableOpacity>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}

      {/* Bottom Sheet Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={handleClose}
      >
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.backdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.sheetWrapper}
              >
                <View
                  style={[
                    styles.sheetContainer,
                    {
                      backgroundColor: canUseGlass() ? colors.glassTint : colors.surfaceRaised,
                      borderColor: canUseGlass() ? colors.glassBorder : colors.border,
                    },
                  ]}
                >
                  {canUseGlass() && (
                    <BlurView
                      intensity={40}
                      tint={isDark ? 'dark' : 'light'}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  {/* Drag Handle (top radius 28) */}
                  <View style={styles.handleContainer}>
                    <View style={styles.handle} />
                  </View>

                  {/* Header */}
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle} numberOfLines={1}>
                      {label || placeholder}
                    </Text>
                    <TouchableOpacity
                      onPress={handleClose}
                      style={styles.closeButton}
                      accessibilityLabel={COMMON.CLOSE}
                    >
                      <X size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Search Box */}
                  <View style={styles.searchBox}>
                    <Search size={18} color={colors.textSecondary} style={styles.searchIcon} />
                    <TextInput
                      ref={searchInputRef}
                      style={styles.searchInput}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder={REGISTER.SEARCHABLE_SELECT.SEARCH_PLACEHOLDER}
                      placeholderTextColor={colors.textSecondary}
                      cursorColor={colors.primary}
                      selectionColor={colors.primary}
                      autoCorrect={false}
                      autoCapitalize="none"
                      clearButtonMode="while-editing"
                      returnKeyType="search"
                    />
                    {searchQuery.length > 0 && Platform.OS !== 'ios' && (
                      <TouchableOpacity
                        onPress={() => setSearchQuery('')}
                        style={styles.clearSearchBtn}
                      >
                        <X size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Free text Other input if revealed */}
                  {allowOther && showOtherInput && (
                    <View style={styles.otherInputContainer}>
                      <View style={styles.otherInputWrapper}>
                        <Edit3 size={16} color={colors.primary} style={styles.otherIcon} />
                        <TextInput
                          ref={otherInputRef}
                          style={styles.otherTextInput}
                          value={otherText}
                          onChangeText={setOtherText}
                          placeholder={otherPlaceholder}
                          placeholderTextColor={colors.textSecondary}
                          cursorColor={colors.primary}
                          selectionColor={colors.primary}
                          returnKeyType="done"
                          onSubmitEditing={handleConfirmOther}
                        />
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.otherConfirmBtn,
                          !otherText.trim() && styles.otherConfirmBtnDisabled,
                        ]}
                        onPress={handleConfirmOther}
                        disabled={!otherText.trim()}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.otherConfirmBtnText}>
                          {REGISTER.SEARCHABLE_SELECT.CONFIRM_OTHER}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Options List with 44px rows */}
                  <FlatList
                    data={filteredOptions}
                    keyExtractor={(item) => item.value}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                          {REGISTER.SEARCHABLE_SELECT.NO_RESULTS}
                        </Text>
                      </View>
                    }
                    renderItem={({ item }) => {
                      const isSelected = item.value === value && !isCustomValue;
                      return (
                        <TouchableOpacity
                          style={[styles.row, isSelected && styles.rowSelected]}
                          onPress={() => handleSelectOption(item.value)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[styles.rowText, isSelected && styles.rowTextSelected]}
                            numberOfLines={1}
                          >
                            {item.label}
                          </Text>
                          {isSelected && (
                            <View style={styles.tickWrapper}>
                              <Check size={18} color={colors.primary} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    }}
                    ListFooterComponent={
                      allowOther ? (
                        <TouchableOpacity
                          style={[styles.row, isOtherSelected && styles.rowSelected]}
                          onPress={handleSelectOther}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.rowText,
                              isOtherSelected && styles.rowTextSelected,
                              styles.otherLabelText,
                            ]}
                            numberOfLines={1}
                          >
                            {isCustomValue && value
                              ? `${REGISTER.SEARCHABLE_SELECT.OTHER_ROW}: ${value}`
                              : REGISTER.SEARCHABLE_SELECT.OTHER_ROW}
                          </Text>
                          {isOtherSelected && (
                            <View style={styles.tickWrapper}>
                              <Check size={18} color={colors.primary} />
                            </View>
                          )}
                        </TouchableOpacity>
                      ) : null
                    }
                  />
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
    root: {
      marginVertical: theme.spacing.sm,
    },
    label: {
      fontFamily: theme.fonts.bodyMedium,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xs + 2,
    },
    trigger: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
    },
    triggerError: {
      borderColor: theme.colors.danger,
    },
    triggerDisabled: {
      opacity: 0.5,
    },
    triggerText: {
      flex: 1,
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 15,
      lineHeight: 20,
      color: theme.colors.text,
      marginRight: theme.spacing.sm,
    },
    placeholderText: {
      color: theme.colors.textSecondary,
    },
    errorText: {
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.danger,
      marginTop: theme.spacing.xs,
    },
    helperText: {
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
    backdrop: {
      flex: 1,
      backgroundColor: theme.colors.scrim,
      justifyContent: 'flex-end',
    },
    sheetWrapper: {
      width: '100%',
      maxHeight: '85%',
    },
    sheetContainer: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28, // Required 28px top radius
      borderTopRightRadius: 28, // Required 28px top radius
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
      maxHeight: '100%',
    },
    handleContainer: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    handle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.surfaceRaised,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    sheetTitle: {
      flex: 1,
      fontFamily: theme.fonts.headingSemiBold,
      fontSize: 17,
      lineHeight: 22,
      color: theme.colors.text,
    },
    closeButton: {
      padding: theme.spacing.xs,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceRaised,
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.sm + 4,
      height: 42,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchIcon: {
      marginRight: theme.spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 14,
      color: theme.colors.text,
      paddingVertical: 0,
    },
    clearSearchBtn: {
      padding: theme.spacing.xs,
    },
    otherInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    otherInputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceRaised,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.sm + 4,
      height: 42,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    otherIcon: {
      marginRight: theme.spacing.xs + 2,
    },
    otherTextInput: {
      flex: 1,
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 14,
      color: theme.colors.text,
      paddingVertical: 0,
    },
    otherConfirmBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      height: 42,
      justifyContent: 'center',
      alignItems: 'center',
    },
    otherConfirmBtnDisabled: {
      opacity: 0.5,
    },
    otherConfirmBtnText: {
      fontFamily: theme.fonts.headingSemiBold,
      fontSize: 13,
      color: theme.colors.textOnPrimary,
    },
    listContent: {
      paddingHorizontal: theme.spacing.md,
    },
    // 44px rows as required
    row: {
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      paddingHorizontal: theme.spacing.xs,
    },
    rowSelected: {
      backgroundColor: theme.colors.primarySoft,
    },
    rowText: {
      flex: 1,
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 15,
      lineHeight: 20,
      color: theme.colors.text,
    },
    rowTextSelected: {
      fontFamily: theme.fonts.headingSemiBold,
      color: theme.colors.primary,
    },
    otherLabelText: {
      fontStyle: 'italic',
    },
    tickWrapper: {
      marginLeft: theme.spacing.sm,
    },
    emptyContainer: {
      paddingVertical: theme.spacing.lg,
      alignItems: 'center',
    },
    emptyText: {
      fontFamily: theme.fonts.bodyRegular,
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
  });
