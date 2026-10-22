import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, useStyles, ThemeValue } from '../theme/ThemeContext';
import { Skeleton, SkeletonCircle } from './Skeleton';
import { GlassCard } from './GlassCard';

export const LoadingSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  const { radius } = useTheme();
  const styles = useStyles(makeStyles);

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <GlassCard key={index} style={styles.card} contentStyle={styles.cardContent}>
          <SkeletonCircle size={48} />
          <View style={styles.content}>
            <Skeleton width="75%" height={14} borderRadius={radius.xs} style={styles.line} />
            <Skeleton width="50%" height={12} borderRadius={radius.xs} style={styles.line} />
            <Skeleton width="35%" height={10} borderRadius={radius.xs} />
          </View>
        </GlassCard>
      ))}
    </View>
  );
};

const makeStyles = (theme: ThemeValue) =>
  StyleSheet.create({
    container: {
      padding: theme.spacing.md,
    },
    card: {
      marginBottom: theme.spacing.md,
    },
    cardContent: {
      flexDirection: 'row',
      padding: theme.spacing.md,
      alignItems: 'center',
    },
    content: {
      flex: 1,
      marginLeft: theme.spacing.md,
      justifyContent: 'center',
    },
    line: {
      marginBottom: 8,
    },
  });

export default LoadingSkeleton;
