import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ui/ErrorBoundary';
import { useAuthStore } from './src/store/authStore';
import { registerForPushNotificationsAsync } from './src/utils/notifications';
import { authApi } from './src/api/auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

function AppContent() {
  const { hasHydrated, hydrateAuth, isAuthenticated, user, updateUser } = useAuthStore();

  useEffect(() => {
    void hydrateAuth();
  }, [hydrateAuth]);

  // Clear cached queries whenever user signs out so switching accounts stays isolated
  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      queryClient.clear();
    }
  }, [hasHydrated, isAuthenticated]);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;

    let active = true;
    const syncPushToken = async () => {
      const token = await registerForPushNotificationsAsync();
      if (!active || !token || user?.expoPushToken === token) return;

      try {
        await authApi.updateProfile({ expoPushToken: token });
        if (active) {
          updateUser({ expoPushToken: token });
        }
      } catch {
        // Non-blocking: ignore if push sync fails temporarily
      }
    };

    void syncPushToken();
    return () => {
      active = false;
    };
  }, [hasHydrated, isAuthenticated, user?.expoPushToken, updateUser]);

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return <RootNavigator />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppContent />
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
