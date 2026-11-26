import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { Mail, Lock } from 'lucide-react-native';
import { Screen } from '../../components/layout/Screen';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../theme/theme';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onNavigateToRegister,
}) => {
  const { colors, spacing, radius, typography } = useTheme();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your email and password');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const data = await authApi.login({
        email: email.trim(),
        password,
      });
      setAuth(data.user, data.accessToken, data.refreshToken);
    } catch (err: any) {
      const message = !err.response
        ? 'Cannot reach server. Please check your internet connection.'
        : err.response?.data?.message || 'Login failed. Please check your credentials.';
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
        {/* Brand Hero Header */}
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
                fontSize: typography.fontSize.hero,
              },
            ]}
          >
            Shelf Life
          </Text>
          <Text
            style={[
              styles.appTagline,
              {
                color: colors.textSecondary,
                fontSize: typography.fontSize.md,
              },
            ]}
          >
            Eat well. Waste less. Keep food fresh.
          </Text>
        </View>

        {/* Form Box */}
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
          <Text
            style={[
              styles.formTitle,
              {
                color: colors.text,
                fontSize: typography.fontSize.xl,
                marginBottom: spacing.lg,
              },
            ]}
          >
            Welcome Back
          </Text>

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
            placeholder="••••••••"
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
            title="Log In"
            variant="primary"
            size="lg"
            loading={loading}
            onPress={handleLogin}
            fullWidth
            style={{ marginTop: spacing.sm }}
          />
        </View>

        {/* Footer switch to Register */}
        <View style={styles.footerRow}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            Don't have an account?{' '}
          </Text>
          <TouchableOpacity onPress={onNavigateToRegister}>
            <Text
              style={{
                color: colors.primary,
                fontWeight: '700',
                fontSize: 14,
              }}
            >
              Sign Up Free
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
    marginBottom: 28,
  },
  logoBadge: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
    letterSpacing: -1,
  },
  appTagline: {
    marginTop: 6,
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
  formTitle: {
    fontWeight: '700',
    letterSpacing: -0.4,
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
