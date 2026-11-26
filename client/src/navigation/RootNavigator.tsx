import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home,
  Refrigerator,
  ChefHat,
  BarChart2,
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/theme';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { RecipesScreen } from '../screens/recipes/RecipesScreen';
import { ItemDetailScreen } from '../screens/items/ItemDetailScreen';
import { SearchScreen } from '../screens/search/SearchScreen';
import { AnalyticsScreen } from '../screens/analytics/AnalyticsScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { FoodItem } from '../api/items';

export type MainTabType = 'home' | 'kitchen' | 'recipes' | 'impact';

export const RootNavigator: React.FC = () => {
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Auth flow state
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');

  // Main navigation state
  const [activeTab, setActiveTab] = useState<MainTabType>('home');
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Handle Android hardware back button for detail/settings overlays
  useEffect(() => {
    if (!selectedItem && !showSettings) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedItem) {
        setSelectedItem(null);
        return true;
      }
      if (showSettings) {
        setShowSettings(false);
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, [selectedItem, showSettings]);

  if (!isAuthenticated) {
    if (authScreen === 'register') {
      return <RegisterScreen onNavigateToLogin={() => setAuthScreen('login')} />;
    }
    return <LoginScreen onNavigateToRegister={() => setAuthScreen('register')} />;
  }

  if (selectedItem) {
    return (
      <ItemDetailScreen
        item={selectedItem}
        onBack={() => setSelectedItem(null)}
      />
    );
  }

  if (showSettings) {
    return <SettingsScreen onBack={() => setShowSettings(false)} />;
  }

  const tabs: Array<{
    id: MainTabType;
    label: string;
    renderIcon: (color: string) => React.ReactNode;
  }> = [
    {
      id: 'home',
      label: 'Home',
      renderIcon: (color) => <Home size={20} color={color} />,
    },
    {
      id: 'kitchen',
      label: 'Kitchen',
      renderIcon: (color) => <Refrigerator size={20} color={color} />,
    },
    {
      id: 'recipes',
      label: 'Recipes',
      renderIcon: (color) => <ChefHat size={20} color={color} />,
    },
    {
      id: 'impact',
      label: 'Impact',
      renderIcon: (color) => <BarChart2 size={20} color={color} />,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.screenContainer}>
        {activeTab === 'home' && (
          <HomeScreen
            onSelectItem={(item) => setSelectedItem(item)}
            onOpenSettings={() => setShowSettings(true)}
            onOpenRecipes={() => setActiveTab('recipes')}
          />
        )}
        {activeTab === 'kitchen' && (
          <SearchScreen onSelectItem={(item) => setSelectedItem(item)} />
        )}
        {activeTab === 'recipes' && <RecipesScreen />}
        {activeTab === 'impact' && <AnalyticsScreen />}
      </View>

      {/* Clean 4-Tab Bottom Navigation Bar */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.borderSubtle,
            borderTopWidth: 1,
            height: 60 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 8),
            ...shadows.card,
          },
        ]}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const tint = isActive ? colors.primary : colors.textMuted;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={styles.tabItem}
              activeOpacity={0.8}
            >
              {tab.renderIcon(tint)}
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: tint,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    paddingTop: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 0.1,
  },
});
