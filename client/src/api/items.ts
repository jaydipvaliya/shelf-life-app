import apiClient from './client';

export type FoodCategory =
  | 'dairy'
  | 'produce'
  | 'meat'
  | 'bakery'
  | 'pantry'
  | 'frozen'
  | 'beverages'
  | 'snacks'
  | 'other';

export type FoodLocation = 'fridge' | 'freezer' | 'pantry';

export type ItemStatus = 'active' | 'consumed' | 'discarded' | 'expired';

export type ItemUrgency = 'safe' | 'warning' | 'urgent' | 'expired' | 'consumed' | 'discarded';

export interface FoodItem {
  _id: string;
  name: string;
  category: FoodCategory;
  location: FoodLocation;
  quantity: number;
  unit: string;
  price?: number | null;
  expiryDate: string;
  photoUrl?: string;
  barcode?: string;
  notes?: string;
  status: ItemStatus;
  statusChangedAt?: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  householdId?: {
    _id: string;
    name: string;
  } | null;
  daysUntilExpiry: number;
  urgency: ItemUrgency;
  createdAt: string;
  updatedAt: string;
}

export interface ItemFilters {
  location?: FoodLocation | 'all';
  category?: FoodCategory | 'all';
  status?: ItemStatus | 'all';
  search?: string;
  householdId?: string;
  sort?: 'expiry' | 'newest' | 'oldest' | 'name';
}

export interface CreateItemPayload {
  name: string;
  category: FoodCategory;
  location: FoodLocation;
  quantity: number;
  unit: string;
  price?: number | null;
  expiryDate: string;
  photoUrl?: string;
  barcode?: string;
  notes?: string;
  householdId?: string | null;
}

export interface UpdateItemPayload extends Partial<CreateItemPayload> {
  status?: ItemStatus;
}

export interface ParsedHaulItem {
  name: string;
  category: FoodCategory;
  location: FoodLocation;
  quantity: number;
  unit: string;
  price: number | null;
  expiryDate: string;
}

export const itemsApi = {
  getItems: async (filters: ItemFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.location && filters.location !== 'all') params.append('location', filters.location);
    if (filters.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.householdId) params.append('householdId', filters.householdId);
    if (filters.sort) params.append('sort', filters.sort);

    const res = await apiClient.get(`/api/items?${params.toString()}`);
    return res.data.data.items as FoodItem[];
  },

  getExpiringSoon: async (days: number = 3, householdId?: string) => {
    const params = new URLSearchParams({ days: days.toString() });
    if (householdId) params.append('householdId', householdId);

    const res = await apiClient.get(`/api/items/expiring-soon?${params.toString()}`);
    return res.data.data.items as FoodItem[];
  },

  getItemById: async (id: string) => {
    const res = await apiClient.get(`/api/items/${id}`);
    return res.data.data.item as FoodItem;
  },

  createItem: async (data: CreateItemPayload) => {
    const res = await apiClient.post('/api/items', data);
    return res.data.data.item as FoodItem;
  },

  parseHaul: async (text: string): Promise<ParsedHaulItem[]> => {
    const res = await apiClient.post('/api/items/parse-haul', { text });
    return res.data.data.items as ParsedHaulItem[];
  },

  scanReceipt: async (
    formData: FormData
  ): Promise<{
    rawText: string;
    items: ParsedHaulItem[];
    count: number;
    usedAI?: boolean;
    provider?: string;
    aiConfigured?: boolean;
  }> => {
    const res = await apiClient.post('/api/items/scan-receipt', formData, {
      timeout: 45000,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.data;
  },

  createItemsBatch: async (
    items: CreateItemPayload[],
    householdId?: string | null
  ): Promise<{ items: FoodItem[]; count: number }> => {
    const res = await apiClient.post('/api/items/batch', { items, householdId });
    return res.data.data;
  },

  updateItem: async (id: string, data: UpdateItemPayload) => {
    const res = await apiClient.patch(`/api/items/${id}`, data);
    return res.data.data.item as FoodItem;
  },

  deleteItem: async (id: string) => {
    const res = await apiClient.delete(`/api/items/${id}`);
    return res.data.data;
  },

  uploadPhoto: async (formData: FormData) => {
    const res = await apiClient.post('/api/uploads/photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.data.url as string;
  },
};
