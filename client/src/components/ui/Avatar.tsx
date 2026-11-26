import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/theme';

interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: number;
  style?: ViewStyle;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  imageUrl,
  size = 40,
  style,
}) => {
  const { colors, typography } = useTheme();

  const getInitials = (n: string) => {
    if (!n) return '?';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  if (imageUrl) {
    return (
      <View style={[containerStyle, style]}>
        <Image
          source={{ uri: imageUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        containerStyle,
        { backgroundColor: colors.primaryLight + '25' },
        style,
      ]}
    >
      <Text
        style={[
          styles.initials,
          {
            color: colors.primary,
            fontSize: size * 0.4,
          },
        ]}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  initials: {
    fontWeight: '700',
  },
});
