import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../../theme/theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeightRatio?: number;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeightRatio = 0.9,
}) => {
  const { colors, spacing, radius, typography, shadows } = useTheme();
  const screenHeight = Dimensions.get('window').height;
  const isWeb = Platform.OS === 'web';

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={[
            styles.sheetContainer,
            isWeb && styles.webModal,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              maxHeight: screenHeight * maxHeightRatio,
              borderColor: colors.borderSubtle,
              ...shadows.modal,
            },
          ]}
        >
          {/* Drag handle bar */}
          <View style={styles.handleContainer}>
            <View
              style={[
                styles.handle,
                { backgroundColor: colors.border },
              ]}
            />
          </View>

          {/* Header */}
          <View
            style={[
              styles.header,
              {
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing.sm,
                borderBottomColor: colors.borderSubtle,
              },
            ]}
          >
            <View style={styles.headerTextContainer}>
              {title && (
                <Text
                  style={[
                    styles.title,
                    {
                      color: colors.text,
                      fontSize: typography.fontSize.xl,
                    },
                  ]}
                >
                  {title}
                </Text>
              )}
              {subtitle && (
                <Text
                  style={[
                    styles.subtitle,
                    {
                      color: colors.textSecondary,
                      fontSize: typography.fontSize.sm,
                    },
                  ]}
                >
                  {subtitle}
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeButton,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Sheet content */}
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={{
              padding: spacing.lg,
              paddingBottom: 32,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    borderTopWidth: 1,
  },
  webModal: {
    maxWidth: 600,
    alignSelf: 'center',
    borderRadius: 24,
    marginBottom: 40,
    borderWidth: 1,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  contentScroll: {
    flexGrow: 0,
  },
});
