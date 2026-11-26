import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isAndroidExpoGo = (): boolean => {
  if (Platform.OS !== 'android') return false;
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo'
  );
};

let handlerConfigured = false;

export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  // Remote push notifications were removed from Android Expo Go in SDK 53+;
  // skip loading expo-notifications in Expo Go and enable it only in dev/standalone builds.
  if (Platform.OS === 'web' || isAndroidExpoGo()) {
    return null;
  }

  try {
    const Notifications = await import('expo-notifications');

    if (!handlerConfigured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      handlerConfigured = true;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('expiry-alerts', {
        name: 'Expiry Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    return tokenData.data || null;
  } catch {
    return null;
  }
};
