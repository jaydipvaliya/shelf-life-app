import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../theme/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  fullWidth = false,
}) => {
  const { colors, spacing, radius, typography } = useTheme();

  let bg = colors.primary;
  let textCol = colors.textInverse;
  let borderColor = 'transparent';
  let borderWidth = 0;

  switch (variant) {
    case 'secondary':
      bg = colors.surfaceSubtle;
      textCol = colors.text;
      borderColor = colors.border;
      borderWidth = 1;
      break;
    case 'outline':
      bg = 'transparent';
      textCol = colors.primary;
      borderColor = colors.primary;
      borderWidth = 1.5;
      break;
    case 'ghost':
      bg = 'transparent';
      textCol = colors.text;
      break;
    case 'danger':
      bg = colors.danger;
      textCol = '#FFFFFF';
      break;
    case 'primary':
    default:
      bg = colors.primary;
      textCol = colors.textInverse;
      break;
  }

  let paddingVertical = spacing.md;
  let paddingHorizontal = spacing.lg;
  let fontSize = typography.fontSize.md;

  if (size === 'sm') {
    paddingVertical = spacing.sm;
    paddingHorizontal = spacing.md;
    fontSize = typography.fontSize.sm;
  } else if (size === 'lg') {
    paddingVertical = spacing.lg;
    paddingHorizontal = spacing.xl;
    fontSize = typography.fontSize.lg;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        styles.button,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth,
          paddingVertical,
          paddingHorizontal,
          borderRadius: radius.md,
          opacity: disabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textCol} />
      ) : (
        <>
          {icon && iconPosition === 'left' ? <>{icon}</> : null}
          <Text
            style={[
              styles.text,
              {
                color: textCol,
                fontSize,
                marginHorizontal: icon ? 8 : 0,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' ? <>{icon}</> : null}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
