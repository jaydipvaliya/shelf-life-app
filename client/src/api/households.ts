import apiClient from './client';
import { FoodItem } from './items';

export interface HouseholdMember {
  user: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface Household {
  _id: string;
  name: string;
  owner: {
    _id: string;
    name: string;
    email: string;
  };
  members: HouseholdMember[];
  inviteCode: string;
  createdAt: string;
}

export const householdsApi = {
  getHouseholds: async () => {
    const res = await apiClient.get('/api/households');
    return res.data.data.households as Household[];
  },

  createHousehold: async (name: string) => {
    const res = await apiClient.post('/api/households', { name });
    return res.data.data.household as Household;
  },

  joinByCode: async (inviteCode: string) => {
    const res = await apiClient.post('/api/households/join', { inviteCode });
    return res.data.data.household as Household;
  },

  inviteMember: async (householdId: string, email: string) => {
    const res = await apiClient.post(`/api/households/${householdId}/invite`, { email });
    return res.data.data.household as Household;
  },

  getHouseholdItems: async (householdId: string) => {
    const res = await apiClient.get(`/api/households/${householdId}/items`);
    return res.data.data.items as FoodItem[];
  },
};
