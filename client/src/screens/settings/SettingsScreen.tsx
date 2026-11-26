import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Share,
} from 'react-native';
import {
  Bell,
  Moon,
  Sun,
  Users,
  LogOut,
  User,
  Plus,
  Copy,
  Check,
  Lock,
  ShieldCheck,
} from 'lucide-react-native';
import { Screen } from '../../components/layout/Screen';
import { Header } from '../../components/layout/Header';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Avatar } from '../../components/ui/Avatar';
import { useTheme } from '../../theme/theme';
import { useAuthStore } from '../../store/authStore';
import { CURRENCIES } from '../../utils/currency';
import { authApi } from '../../api/auth';
import { householdsApi, Household } from '../../api/households';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface SettingsScreenProps {
  onBack?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const { colors, spacing, radius, typography, isDark } = useTheme();
  const {
    user,
    refreshToken,
    logout,
    updateTokens,
    toggleTheme,
    currency,
    setCurrency,
    updateUser,
  } = useAuthStore();
  const queryClient = useQueryClient();

  const [dailyDigest, setDailyDigest] = useState(
    user?.notificationPreferences?.dailyDigestEnabled ?? true
  );
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Account & Legal modals
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Household modals
  const [createHhVisible, setCreateHhVisible] = useState(false);
  const [joinHhVisible, setJoinHhVisible] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  // Fetch households
  const { data: households = [], refetch: refetchHouseholds } = useQuery({
    queryKey: ['households'],
    queryFn: () => householdsApi.getHouseholds(),
  });

  // Create household mutation
  const createHouseholdMutation = useMutation({
    mutationFn: (name: string) => householdsApi.createHousehold(name),
    onSuccess: (newHh) => {
      refetchHouseholds();
      setCreateHhVisible(false);
      setHouseholdName('');
      Alert.alert(
        'Household Created',
        `"${newHh.name}" created! Share invite code: ${newHh.inviteCode}`
      );
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Could not create household');
    },
  });

  // Join household mutation
  const joinHouseholdMutation = useMutation({
    mutationFn: (code: string) => householdsApi.joinByCode(code),
    onSuccess: (hh) => {
      refetchHouseholds();
      setJoinHhVisible(false);
      setInviteCode('');
      Alert.alert('Joined!', `You are now a member of "${hh.name}"`);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Invalid invite code');
    },
  });

  const handleToggleDailyDigest = async (val: boolean) => {
    setDailyDigest(val);
    try {
      await authApi.updateProfile({
        notificationPreferences: {
          dailyDigestEnabled: val,
        },
      });
      updateUser({
        notificationPreferences: {
          ...user?.notificationPreferences,
          dailyDigestEnabled: val,
        },
      });
    } catch {
      // Revert if error
      setDailyDigest(!val);
    }
  };

  return (
    <Screen withSafeArea withBottomSafeArea>
      <Header
        title="Settings"
        subtitle="Preferences, shared pantry & account"
        showBack={Boolean(onBack)}
        onBack={onBack}
      />

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingHorizontal: spacing.lg, paddingBottom: 60 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* User Account Card */}
        <Card
          style={[
            styles.userCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radius.xl,
              padding: spacing.lg,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <View style={styles.userRow}>
            <Avatar
              name={user?.name || 'Chef'}
              imageUrl={user?.avatar}
              size={52}
            />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text
                style={{
                  fontSize: typography.fontSize.lg,
                  fontWeight: '700',
                  color: colors.text,
                }}
              >
                {user?.name}
              </Text>
              <Text style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>
                {user?.email}
              </Text>
            </View>
          </View>
        </Card>

        {/* Appearance & Theming */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          APPEARANCE
        </Text>
        <Card
          style={[
            styles.cardSection,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radius.lg,
              padding: spacing.md,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <View style={styles.settingRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {isDark ? (
                <Moon size={20} color={colors.primary} style={{ marginRight: 12 }} />
              ) : (
                <Sun size={20} color={colors.primary} style={{ marginRight: 12 }} />
              )}
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                Dark Mode
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </Card>

        {/* Currency */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          CURRENCY
        </Text>
        <Card
          style={[
            styles.cardSection,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radius.lg,
              padding: spacing.md,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
            Used for item prices and savings impact
          </Text>
          <View style={styles.currencyWrap}>
            {CURRENCIES.map((c) => {
              const isSelected = currency === c.code;
              return (
                <TouchableOpacity
                  key={c.code}
                  onPress={() => setCurrency(c.code)}
                  style={[
                    styles.currencyChip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderRadius: radius.full,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: isSelected ? colors.textInverse : colors.text,
                      fontSize: 13,
                      fontWeight: isSelected ? '700' : '500',
                    }}
                  >
                    {c.symbol} {c.code}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Notifications */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          NOTIFICATIONS
        </Text>
        <Card
          style={[
            styles.cardSection,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radius.lg,
              padding: spacing.md,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <View style={styles.settingRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 }}>
              <Bell size={20} color={colors.primary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                  Daily 8:00 AM Expiry Digest
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  Sends alerts when items are within 3 days of expiring
                </Text>
              </View>
            </View>
            <Switch
              value={dailyDigest}
              onValueChange={handleToggleDailyDigest}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </Card>

        {/* Households / Shared Pantry */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          SHARED HOUSEHOLDS & PANTRY
        </Text>
        <Card
          style={[
            styles.cardSection,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radius.lg,
              padding: spacing.md,
              marginBottom: spacing.lg,
            },
          ]}
        >
          {households.length > 0 ? (
            households.map((hh) => (
              <View
                key={hh._id}
                style={[styles.hhItemRow, { borderBottomColor: colors.borderSubtle }]}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                    {hh.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    {hh.members.length} Member{hh.members.length > 1 ? 's' : ''}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={async () => {
                    setCopiedCode(hh.inviteCode);
                    try {
                      await Share.share({
                        message: `Join my "${hh.name}" shared kitchen on Shelf Life using invite code: ${hh.inviteCode}`,
                      });
                    } catch {
                      Alert.alert(
                        'Invite Code',
                        `Share code "${hh.inviteCode}" with family or roommates to join this pantry.`
                      );
                    }
                  }}
                  style={[
                    styles.copyChip,
                    { backgroundColor: colors.surfaceSubtle },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: colors.primary,
                      marginRight: 4,
                    }}
                  >
                    Code: {hh.inviteCode}
                  </Text>
                  {copiedCode === hh.inviteCode ? (
                    <Check size={12} color={colors.primary} />
                  ) : (
                    <Copy size={12} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              Share fridge & pantry lists with roommates or family members.
            </Text>
          )}

          <View style={styles.hhButtonsRow}>
            <Button
              title="Create Household"
              size="sm"
              variant="outline"
              icon={<Plus size={14} color={colors.primary} />}
              onPress={() => setCreateHhVisible(true)}
              style={{ flex: 1, marginRight: 8 }}
            />
            <Button
              title="Join by Code"
              size="sm"
              variant="secondary"
              onPress={() => setJoinHhVisible(true)}
              style={{ flex: 1 }}
            />
          </View>
        </Card>

        {/* Account Security & Legal */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          SECURITY & LEGAL
        </Text>
        <Card
          style={[
            styles.cardSection,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radius.lg,
              padding: spacing.md,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setPasswordModalVisible(true)}
            style={[
              styles.settingRow,
              {
                paddingBottom: 12,
                marginBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.borderSubtle,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Lock size={19} color={colors.primary} style={{ marginRight: 12 }} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                Change Password
              </Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
              Update
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPrivacyModalVisible(true)}
            style={styles.settingRow}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ShieldCheck size={19} color={colors.primary} style={{ marginRight: 12 }} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                Privacy Policy & Terms
              </Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
              View
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Logout Button */}
        <Button
          title="Sign Out"
          variant="danger"
          size="lg"
          icon={<LogOut size={18} color="#FFFFFF" />}
          onPress={() => {
            Alert.alert('Sign Out', 'Are you sure you want to log out?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Sign Out',
                style: 'destructive',
                onPress: async () => {
                  await authApi.logout(refreshToken);
                  logout();
                },
              },
            ]);
          }}
          fullWidth
        />

        <Button
          title="Delete Account"
          variant="secondary"
          size="md"
          onPress={() => {
            Alert.alert(
              'Delete Account',
              'This permanently deletes your account and all saved items. This action cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await authApi.deleteAccount();
                      logout();
                    } catch (err: any) {
                      Alert.alert(
                        'Delete Failed',
                        err.response?.data?.message || 'Could not delete account right now.'
                      );
                    }
                  },
                },
              ]
            );
          }}
          style={{ marginTop: spacing.md }}
          fullWidth
        />
      </ScrollView>

      {/* Change Password Modal */}
      <BottomSheet
        visible={passwordModalVisible}
        onClose={() => {
          setPasswordModalVisible(false);
          setCurrentPassword('');
          setNewPassword('');
        }}
        title="Change Password"
        subtitle="Use at least 8 characters. Other sessions will be signed out."
      >
        <Input
          label="Current Password"
          placeholder="Enter current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <Input
          label="New Password"
          placeholder="At least 8 characters"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <Button
          title="Update Password"
          variant="primary"
          loading={changingPassword}
          onPress={async () => {
            if (!currentPassword || newPassword.length < 8) {
              Alert.alert('Invalid Input', 'New password must be at least 8 characters.');
              return;
            }
            setChangingPassword(true);
            try {
              const tokens = await authApi.changePassword({
                currentPassword,
                newPassword,
              });
              updateTokens(tokens.accessToken, tokens.refreshToken);
              setPasswordModalVisible(false);
              setCurrentPassword('');
              setNewPassword('');
              Alert.alert('Success', 'Your password has been updated.');
            } catch (err: any) {
              Alert.alert(
                'Update Failed',
                err.response?.data?.message || 'Could not update password.'
              );
            } finally {
              setChangingPassword(false);
            }
          }}
          fullWidth
        />
      </BottomSheet>

      {/* Privacy & Terms Modal */}
      <BottomSheet
        visible={privacyModalVisible}
        onClose={() => setPrivacyModalVisible(false)}
        title="Privacy Policy & Terms"
        subtitle="How Shelf Life handles your kitchen data"
      >
        <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: 12 }}>
          • Inventory & Preferences: Only the food items, households, and notification preferences you save are stored in your account.
        </Text>
        <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: 12 }}>
          • Camera & Receipt Scanning: Photos captured for items or bills are used solely to store your item image or extract grocery lines via AI/OCR and are not sold or shared with advertisers.
        </Text>
        <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: 16 }}>
          • Account Control: You can permanently delete your account and all saved kitchen items anytime from Settings → Delete Account.
        </Text>
        <Button
          title="Close"
          variant="primary"
          onPress={() => setPrivacyModalVisible(false)}
          fullWidth
        />
      </BottomSheet>

      {/* Create Household Modal */}
      <BottomSheet
        visible={createHhVisible}
        onClose={() => setCreateHhVisible(false)}
        title="Create Household"
        subtitle="Share a common fridge & grocery list"
      >
        <Input
          label="Household Name"
          placeholder="e.g. Sunnyvale Apartment, Home Kitchen..."
          value={householdName}
          onChangeText={setHouseholdName}
        />
        <Button
          title="Create"
          variant="primary"
          loading={createHouseholdMutation.isPending}
          onPress={() => {
            if (householdName.trim()) {
              createHouseholdMutation.mutate(householdName.trim());
            }
          }}
          fullWidth
        />
      </BottomSheet>

      {/* Join Household Modal */}
      <BottomSheet
        visible={joinHhVisible}
        onClose={() => setJoinHhVisible(false)}
        title="Join Household"
        subtitle="Enter the 6-character invite code"
      >
        <Input
          label="Invite Code"
          placeholder="e.g. CABA48"
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="characters"
        />
        <Button
          title="Join Household"
          variant="primary"
          loading={joinHouseholdMutation.isPending}
          onPress={() => {
            if (inviteCode.trim()) {
              joinHouseholdMutation.mutate(inviteCode.trim());
            }
          }}
          fullWidth
        />
      </BottomSheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
  userCard: {
    borderWidth: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  cardSection: {
    borderWidth: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hhItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  copyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  hhButtonsRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  currencyWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  currencyChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
});
