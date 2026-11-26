import React from 'react';
import {
  View,
  ScrollView,
  StatusBar,
  ViewStyle,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';

interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
  withSafeArea?: boolean;
  withBottomSafeArea?: boolean;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  scrollable = false,
  style,
  contentContainerStyle,
  refreshing = false,
  onRefresh,
  withSafeArea = true,
  withBottomSafeArea = false,
}) => {
  const { colors, isDark } = useTheme();

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.background,
  };

  const Wrapper = withSafeArea ? SafeAreaView : View;
  const edges: Edge[] = withBottomSafeArea
    ? ['top', 'bottom', 'left', 'right']
    : ['top', 'left', 'right'];

  return (
    <Wrapper
      style={[containerStyle, style]}
      {...(withSafeArea ? { edges } : {})}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scrollable ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              { paddingBottom: 40 },
              contentContainerStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, contentContainerStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </Wrapper>
  );
};
