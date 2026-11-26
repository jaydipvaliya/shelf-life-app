import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const { colors, isDark } = useTheme();
  const opacityAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.85,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [opacityAnim]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: isDark ? '#2A3A32' : '#E6E2D8',
          opacity: opacityAnim,
        },
        style,
      ]}
    />
  );
};

export const CardSkeleton: React.FC = () => {
  const { colors, radius, spacing } = useTheme();

  return (
    <View
      style={[
        styles.cardSkeleton,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderColor: colors.borderSubtle,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
      ]}
    >
      <View style={styles.cardHeaderRow}>
        <Skeleton width={48} height={48} borderRadius={12} />
        <View style={styles.cardHeaderText}>
          <Skeleton width="65%" height={16} borderRadius={4} />
          <Skeleton
            width="40%"
            height={12}
            borderRadius={4}
            style={{ marginTop: 8 }}
          />
        </View>
        <Skeleton width={70} height={24} borderRadius={12} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardSkeleton: {
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
});
