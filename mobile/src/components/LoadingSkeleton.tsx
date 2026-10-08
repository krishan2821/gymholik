import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../theme/theme';
import { Skeleton, SkeletonCircle } from './Skeleton';
import { GlassCard } from './GlassCard';

export const LoadingSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <GlassCard key={index} style={styles.card} contentStyle={styles.cardContent}>
          <SkeletonCircle size={48} />
          <View style={styles.content}>
            <Skeleton width="75%" height={14} borderRadius={theme.radius.xs} style={styles.line} />
            <Skeleton width="50%" height={12} borderRadius={theme.radius.xs} style={styles.line} />
            <Skeleton width="35%" height={10} borderRadius={theme.radius.xs} />
          </View>
        </GlassCard>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
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
