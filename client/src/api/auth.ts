import apiClient from './client';
import { User } from '../store/authStore';

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  register: async (data: { name: string; email: string; password: string }) => {
    const res = await apiClient.post('/api/auth/register', data);
    return res.data.data as AuthResponse;
  },

  login: async (data: { email: string; password: string; expoPushToken?: string }) => {
    const res = await apiClient.post('/api/auth/login', data);
    return res.data.data as AuthResponse;
  },

  logout: async (refreshToken?: string | null) => {
    try {
      await apiClient.post('/api/auth/logout', refreshToken ? { refreshToken } : {});
    } catch {
      // Ignore error on logout
    }
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const res = await apiClient.post('/api/auth/change-password', data);
    return res.data.data as { accessToken: string; refreshToken: string };
  },

  getMe: async () => {
    const res = await apiClient.get('/api/auth/me');
    return res.data.data.user as User;
  },

  updateProfile: async (data: {
    name?: string;
    avatar?: string;
    expoPushToken?: string;
    notificationPreferences?: {
      reminderDaysBefore?: number[];
      dailyDigestEnabled?: boolean;
      alertTime?: string;
    };
  }) => {
    const res = await apiClient.patch('/api/auth/profile', data);
    return res.data.data.user as User;
  },

  deleteAccount: async () => {
    await apiClient.delete('/api/auth/account');
  },
};
