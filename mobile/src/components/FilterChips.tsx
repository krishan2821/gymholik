import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { theme } from '../theme/theme';
import { Chip } from './Chip';

export interface FilterChipsProps {
  options: { label: string; value: string; count?: number }[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export const FilterChips: React.FC<FilterChipsProps> = ({ options, selectedValue, onSelect }) => {
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {options.map((option) => {
        const isSelected = option.value === selectedValue;
        return (
          <Chip
            key={option.value}
            label={option.label}
            selected={isSelected}
            count={option.count}
            onPress={() => onSelect(option.value)}
          />
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
});

export default FilterChips;
