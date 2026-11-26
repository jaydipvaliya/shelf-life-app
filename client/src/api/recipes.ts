import apiClient from './client';
import { useQuery } from '@tanstack/react-query';
import { FoodItem } from './items';

export interface RecipeSuggestion {
  id: number;
  title: string;
  image: string;
  sourceUrl: string;
  readyInMinutes?: number | null;
  servings?: number | null;
  usedIngredients: string[];
  expiringMatchedIngredients?: string[];
  matchedItemIds?: string[];
  missedIngredients: string[];
  ingredientsList?: string[];
  instructions?: string[];
  usedCount: number;
  missedCount: number;
  expiringMatchCount?: number;
  isBuiltin?: boolean;
}

export interface FoodSavingTip {
  itemId: string;
  itemName: string;
  daysUntilExpiry: number;
  location: string;
  tip: string;
}

export interface KitchenPlanResponse {
  expiringItems: FoodItem[];
  kitchenItems: FoodItem[];
  recipes: RecipeSuggestion[];
  quickTips: FoodSavingTip[];
}

export interface RecipeDetails {
  id: number;
  title: string;
  image: string;
  sourceUrl: string;
  readyInMinutes: number;
  servings: number;
  ingredientsList: string[];
  instructions: string[];
  isBuiltin: boolean;
}

export const recipesApi = {
  getSuggestions: async (
    days: number = 3,
    scope: 'all' | 'expiring' = 'all'
  ): Promise<RecipeSuggestion[]> => {
    try {
      const res = await apiClient.get(
        `/api/recipes/suggestions?days=${days}&scope=${scope}`
      );
      const recipes = res.data.data?.recipes || res.data.recipes || [];
      return recipes as RecipeSuggestion[];
    } catch (error) {
      console.warn('Error fetching recipe suggestions:', error);
      return [];
    }
  },

  getKitchenPlan: async (params: {
    days?: number;
    scope?: 'all' | 'expiring';
    ingredients?: string[];
  } = {}): Promise<KitchenPlanResponse> => {
    const query = new URLSearchParams();
    query.set('days', String(params.days ?? 5));
    query.set('scope', params.scope ?? 'all');
    if (params.ingredients && params.ingredients.length > 0) {
      query.set('ingredients', params.ingredients.join(','));
    }

    const res = await apiClient.get(`/api/recipes/kitchen-plan?${query.toString()}`);
    return res.data.data as KitchenPlanResponse;
  },

  getDetails: async (id: number): Promise<RecipeDetails | null> => {
    try {
      const res = await apiClient.get(`/api/recipes/${id}/details`);
      return res.data.data.recipe as RecipeDetails;
    } catch {
      return null;
    }
  },
};

export const useRecipeSuggestions = (
  days: number = 3,
  scope: 'all' | 'expiring' = 'all'
) => {
  return useQuery({
    queryKey: ['recipe-suggestions', days, scope],
    queryFn: () => recipesApi.getSuggestions(days, scope),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
};

export const useKitchenPlan = (params: {
  days?: number;
  scope?: 'all' | 'expiring';
  ingredients?: string[];
} = {}) => {
  return useQuery({
    queryKey: [
      'kitchen-plan',
      params.days ?? 5,
      params.scope ?? 'all',
      (params.ingredients || []).join(','),
    ],
    queryFn: () => recipesApi.getKitchenPlan(params),
    staleTime: 1000 * 60 * 2,
  });
};

export const useRecipeDetails = (id: number | null, enabled: boolean) => {
  return useQuery({
    queryKey: ['recipe-details', id],
    queryFn: () => recipesApi.getDetails(id!),
    enabled: Boolean(id && enabled),
    staleTime: 1000 * 60 * 30,
  });
};
