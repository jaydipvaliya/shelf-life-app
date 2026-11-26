import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../theme/theme';

interface BadgeProps {
  label: string;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  withDot?: boolean;
  dotColor?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  color,
  backgroundColor,
  borderColor,
  withDot = false,
  dotColor,
  style,
  textStyle,
  size = 'md',
}) => {
  const { colors, radius, typography, spacing } = useTheme();

  const textColor = color || colors.primary;
  const bg = backgroundColor || colors.surfaceSubtle;
  const border = borderColor || 'transparent';

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: borderColor ? 1 : 0,
          borderRadius: radius.full,
          paddingVertical: isSmall ? 2 : 4,
          paddingHorizontal: isSmall ? spacing.sm : spacing.md,
        },
        style,
      ]}
    >
      {withDot && (
        <View
          style={[
            styles.dot,
            {
              backgroundColor: dotColor || textColor,
              width: isSmall ? 5 : 6,
              height: isSmall ? 5 : 6,
            },
          ]}
        />
      )}
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize: isSmall ? typography.fontSize.xxs : typography.fontSize.xs,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  dot: {
    borderRadius: 999,
    marginRight: 5,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
