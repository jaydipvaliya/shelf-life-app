import apiClient from './client';
import { FoodCategory, FoodLocation } from './items';

export interface WeeklySavingsPoint {
  label: string;
  amount: number;
  isCurrent: boolean;
}

export interface AnalyticsSummary {
  counts: {
    active: number;
    consumed: number;
    discarded: number;
    expired: number;
  };
  totalTracked: number;
  savedRate: number;
  estimatedMoneySaved: number;
  foodSavedKg?: number;
  currentStreakDays?: number;
  expiringSoonCount?: number;
  atRiskWeekCount?: number;
  atRiskValue?: number;
  monthlySavings?: {
    currentMonthSaved: number;
    previousMonthSaved: number;
    deltaPercent: number;
  };
  weeklySavings?: WeeklySavingsPoint[];
  categoryStats: Array<{
    _id: FoodCategory;
    total: number;
    consumed: number;
    discarded: number;
    active: number;
  }>;
  locationCounts: Record<FoodLocation, number>;
}

export const analyticsApi = {
  getSummary: async () => {
    const res = await apiClient.get('/api/analytics/summary');
    return res.data.data as AnalyticsSummary;
  },
};
