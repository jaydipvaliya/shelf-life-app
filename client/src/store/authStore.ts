import { create } from 'zustand';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CurrencyCode, isSupportedCurrency } from '../utils/currency';

export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  expoPushToken?: string;
  notificationPreferences?: {
    reminderDaysBefore?: number[];
    dailyDigestEnabled?: boolean;
    alertTime?: string;
  };
  households?: Array<{
    _id: string;
    name: string;
    inviteCode?: string;
  }>;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;
  theme: 'light' | 'dark';
  currency: CurrencyCode;
  apiBaseUrl: string;

  // Actions
  hydrateAuth: () => Promise<void>;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  updateTokens: (accessToken: string, refreshToken?: string) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setCurrency: (currency: CurrencyCode) => void;
  setApiBaseUrl: (url: string) => void;
  setLoading: (loading: boolean) => void;
}

const TOKEN_ACCESS_KEY = 'shelflife_access_token';
const TOKEN_REFRESH_KEY = 'shelflife_refresh_token';
const USER_KEY = 'shelflife_user';
const THEME_KEY = 'shelflife_theme';
const CURRENCY_KEY = 'shelflife_currency';
const API_URL_KEY = 'shelflife_api_url';

const getSecureItem = async (key: string): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(key)
        : null;
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

const setSecureItem = async (key: string, value: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Ignore storage error
  }
};

const removeSecureItem = async (key: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore storage error
  }
};

const getAsyncItem = async (key: string): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(key)
        : null;
    }
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

const setAsyncItem = async (key: string, value: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    await AsyncStorage.setItem(key, value);
  } catch {
    // Ignore storage error
  }
};

const removeAsyncItem = async (key: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      return;
    }
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignore storage error
  }
};

const PRODUCTION_API_URL = 'https://shelf-life-app-elgp.onrender.com';

const getConfiguredApiUrl = (): string | null => {
  const configuredUrl =
    process.env.EXPO_PUBLIC_API_URL ||
    (Constants.expoConfig?.extra?.apiUrl as string | undefined);

  if (
    configuredUrl &&
    configuredUrl.trim() !== '' &&
    !configuredUrl.includes('your-production-server-url.com')
  ) {
    return configuredUrl.trim().replace(/\/+$/, '');
  }
  return null;
};

const getDefaultApiBaseUrl = (): string => {
  const configuredUrl = getConfiguredApiUrl();
  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return PRODUCTION_API_URL;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${window.location.hostname}:5000`;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) {
      const resolvedHost =
        Platform.OS === 'android' && (host === 'localhost' || host === '127.0.0.1')
          ? '10.0.2.2'
          : host;
      return `http://${resolvedHost}:5000`;
    }
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  hasHydrated: false,
  theme: 'light',
  currency: 'USD',
  apiBaseUrl: getDefaultApiBaseUrl(),

  hydrateAuth: async () => {
    if (get().hasHydrated) return;

    const [
      storedToken,
      storedRefresh,
      storedUserJson,
      storedTheme,
      storedCurrency,
      storedApiUrl,
    ] = await Promise.all([
      getSecureItem(TOKEN_ACCESS_KEY),
      getSecureItem(TOKEN_REFRESH_KEY),
      getAsyncItem(USER_KEY),
      getAsyncItem(THEME_KEY),
      getAsyncItem(CURRENCY_KEY),
      getAsyncItem(API_URL_KEY),
    ]);

    let initialUser: User | null = null;
    if (storedUserJson) {
      try {
        initialUser = JSON.parse(storedUserJson);
      } catch {
        initialUser = null;
      }
    }

    const configuredProdUrl =
      typeof __DEV__ !== 'undefined' && !__DEV__
        ? getConfiguredApiUrl() || PRODUCTION_API_URL
        : null;

    set({
      user: initialUser,
      accessToken: storedToken,
      refreshToken: storedRefresh,
      isAuthenticated: Boolean(storedToken && initialUser),
      theme: storedTheme === 'dark' ? 'dark' : 'light',
      currency: isSupportedCurrency(storedCurrency) ? storedCurrency : 'USD',
      apiBaseUrl: configuredProdUrl || storedApiUrl || getDefaultApiBaseUrl(),
      hasHydrated: true,
    });
  },

  setAuth: (user, accessToken, refreshToken) => {
    void setSecureItem(TOKEN_ACCESS_KEY, accessToken);
    void setSecureItem(TOKEN_REFRESH_KEY, refreshToken);
    void setAsyncItem(USER_KEY, JSON.stringify(user));

    set({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  updateTokens: (accessToken, refreshToken) => {
    void setSecureItem(TOKEN_ACCESS_KEY, accessToken);
    if (refreshToken) {
      void setSecureItem(TOKEN_REFRESH_KEY, refreshToken);
    }

    set((state) => ({
      accessToken,
      refreshToken: refreshToken || state.refreshToken,
    }));
  },

  updateUser: (updates) => {
    const currentUser = get().user;
    if (!currentUser) return;
    const updated = { ...currentUser, ...updates };
    void setAsyncItem(USER_KEY, JSON.stringify(updated));
    set({ user: updated });
  },

  logout: () => {
    void removeSecureItem(TOKEN_ACCESS_KEY);
    void removeSecureItem(TOKEN_REFRESH_KEY);
    void removeAsyncItem(USER_KEY);

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  setTheme: (theme) => {
    void setAsyncItem(THEME_KEY, theme);
    set({ theme });
  },

  toggleTheme: () => {
    const nextTheme = get().theme === 'light' ? 'dark' : 'light';
    void setAsyncItem(THEME_KEY, nextTheme);
    set({ theme: nextTheme });
  },

  setCurrency: (currency) => {
    void setAsyncItem(CURRENCY_KEY, currency);
    set({ currency });
  },

  setApiBaseUrl: (url) => {
    const cleaned = url.replace(/\/+$/, '');
    void setAsyncItem(API_URL_KEY, cleaned);
    set({ apiBaseUrl: cleaned });
  },

  setLoading: (loading) => set({ isLoading: loading }),
}));
