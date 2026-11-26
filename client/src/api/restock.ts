import apiClient from './client';
import { useQuery } from '@tanstack/react-query';
import { FoodCategory, FoodItem, FoodLocation } from './items';

export interface RestockItem {
  _id: string;
  name: string;
  category: FoodCategory;
  location: FoodLocation;
  quantity: number;
  unit: string;
  price?: number | null;
  isChecked: boolean;
  source: 'manual' | 'consumed' | 'discarded' | 'recipe';
  householdId?: {
    _id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddRestockPayload {
  name: string;
  category?: FoodCategory;
  location?: FoodLocation;
  quantity?: number;
  unit?: string;
  price?: number | null;
  source?: 'manual' | 'consumed' | 'discarded' | 'recipe';
  householdId?: string | null;
}

export const restockApi = {
  getItems: async (): Promise<RestockItem[]> => {
    const res = await apiClient.get('/api/restock');
    return res.data.data.items as RestockItem[];
  },

  addItem: async (payload: AddRestockPayload): Promise<RestockItem> => {
    const res = await apiClient.post('/api/restock', payload);
    return res.data.data.item as RestockItem;
  },

  toggleChecked: async (id: string, isChecked: boolean): Promise<RestockItem> => {
    const res = await apiClient.patch(`/api/restock/${id}`, { isChecked });
    return res.data.data.item as RestockItem;
  },

  deleteItem: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/restock/${id}`);
  },

  stockBought: async (): Promise<{ stockedItems: FoodItem[]; count: number }> => {
    const res = await apiClient.post('/api/restock/stock-bought');
    return res.data.data;
  },
};

export const useRestockItems = () => {
  return useQuery({
    queryKey: ['restock'],
    queryFn: () => restockApi.getItems(),
    staleTime: 1000 * 30,
  });
};
