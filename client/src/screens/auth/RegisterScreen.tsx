import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { User, Mail, Lock } from 'lucide-react-native';
import { Screen } from '../../components/layout/Screen';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../theme/theme';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth';

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onNavigateToLogin,
}) => {
  const { colors, spacing, radius, typography } = useTheme();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setErrorMsg('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const data = await authApi.register({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      setAuth(data.user, data.accessToken, data.refreshToken);
    } catch (err: any) {
      const message = !err.response
        ? 'Cannot reach server. Please check your internet connection.'
        : err.response?.data?.message || 'Registration failed. Please try again.';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen withSafeArea withBottomSafeArea>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <View
            style={[
              styles.logoBadge,
              {
                backgroundColor: '#124831',
                borderRadius: radius.xl,
                overflow: 'hidden',
              },
            ]}
          >
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.logoImage}
              resizeMode="cover"
            />
          </View>
          <Text
            style={[
              styles.appName,
              {
                color: colors.text,
                fontSize: typography.fontSize.xxxl,
              },
            ]}
          >
            Join Shelf Life
          </Text>
          <Text
            style={[
              styles.appTagline,
              {
                color: colors.textSecondary,
                fontSize: typography.fontSize.sm,
              },
            ]}
          >
            Start saving hundreds on groceries and eliminating waste
          </Text>
        </View>

        {/* Form Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radius.xl,
              padding: spacing.xl,
            },
          ]}
        >
          {errorMsg ? (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: colors.urgentBg,
                  borderColor: colors.urgentBorder,
                },
              ]}
            >
              <Text style={{ color: colors.urgentText, fontSize: 13, fontWeight: '500' }}>
                {errorMsg}
              </Text>
            </View>
          ) : null}

          <Input
            label="Full Name"
            placeholder="Gordon Ramsay"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errorMsg) setErrorMsg('');
            }}
            leftIcon={<User size={18} color={colors.textMuted} />}
          />

          <Input
            label="Email Address"
            placeholder="chef@kitchen.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errorMsg) setErrorMsg('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={<Mail size={18} color={colors.textMuted} />}
          />

          <Input
            label="Password"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errorMsg) setErrorMsg('');
            }}
            secureTextEntry
            autoCapitalize="none"
            leftIcon={<Lock size={18} color={colors.textMuted} />}
          />

          <Button
            title="Create Free Account"
            variant="primary"
            size="lg"
            loading={loading}
            onPress={handleRegister}
            fullWidth
            style={{ marginTop: spacing.md }}
          />
        </View>

        {/* Footer */}
        <View style={styles.footerRow}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={onNavigateToLogin}>
            <Text
              style={{
                color: colors.primary,
                fontWeight: '700',
                fontSize: 14,
              }}
            >
              Log In
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  appName: {
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  appTagline: {
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  errorBanner: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
});
