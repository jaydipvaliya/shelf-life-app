import { FoodCategory, FoodLocation } from '../api/items';

export interface CategoryInfo {
  id: FoodCategory;
  name: string;
  emoji: string;
  iconName: string;
  color: string;
  defaultDays: number;
}

export const CATEGORIES: Record<FoodCategory, CategoryInfo> = {
  produce: {
    id: 'produce',
    name: 'Produce',
    emoji: '🥬',
    iconName: 'Salad',
    color: '#2D6A4F',
    defaultDays: 6,
  },
  dairy: {
    id: 'dairy',
    name: 'Dairy & Eggs',
    emoji: '🥛',
    iconName: 'Milk',
    color: '#3B82F6',
    defaultDays: 7,
  },
  meat: {
    id: 'meat',
    name: 'Meat & Seafood',
    emoji: '🥩',
    iconName: 'Beef',
    color: '#DC2626',
    defaultDays: 3,
  },
  bakery: {
    id: 'bakery',
    name: 'Bakery & Bread',
    emoji: '🍞',
    iconName: 'Wheat',
    color: '#D97706',
    defaultDays: 5,
  },
  pantry: {
    id: 'pantry',
    name: 'Pantry & Dry',
    emoji: '🥫',
    iconName: 'Package',
    color: '#8B5CF6',
    defaultDays: 90,
  },
  frozen: {
    id: 'frozen',
    name: 'Frozen Foods',
    emoji: '❄️',
    iconName: 'Snowflake',
    color: '#06B6D4',
    defaultDays: 180,
  },
  beverages: {
    id: 'beverages',
    name: 'Beverages',
    emoji: '🧃',
    iconName: 'Coffee',
    color: '#10B981',
    defaultDays: 14,
  },
  snacks: {
    id: 'snacks',
    name: 'Snacks & Sweets',
    emoji: '🥨',
    iconName: 'Cookie',
    color: '#EC4899',
    defaultDays: 30,
  },
  other: {
    id: 'other',
    name: 'Other',
    emoji: '📦',
    iconName: 'Box',
    color: '#64748B',
    defaultDays: 7,
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

export const LOCATIONS: Array<{ id: FoodLocation; name: string; emoji: string; iconName: string }> = [
  { id: 'fridge', name: 'Fridge', emoji: '❄️', iconName: 'Refrigerator' },
  { id: 'freezer', name: 'Freezer', emoji: '🧊', iconName: 'Archive' },
  { id: 'pantry', name: 'Pantry', emoji: '🏺', iconName: 'Layers' },
];

export const UNITS = ['pcs', 'g', 'kg', 'ml', 'l', 'pack', 'box', 'bottle', 'can', 'oz', 'lb'];

export const getSmartDefaultExpiry = (category: FoodCategory, location: FoodLocation): Date => {
  let days = CATEGORIES[category]?.defaultDays || 7;

  if (location === 'freezer') {
    days = Math.max(days * 3, 90);
  } else if (location === 'pantry' && (category === 'produce' || category === 'dairy' || category === 'meat')) {
    days = Math.min(days, 3);
  }

  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};
