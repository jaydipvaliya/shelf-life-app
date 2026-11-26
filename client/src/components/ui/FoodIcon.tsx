import React from 'react';
import {
  Salad,
  Milk,
  Beef,
  Wheat,
  Package,
  Snowflake,
  Coffee,
  Cookie,
  Box,
  Refrigerator,
  Archive,
  Layers,
  UtensilsCrossed,
} from 'lucide-react-native';
import { FoodCategory, FoodLocation } from '../../api/items';

interface CategoryIconProps {
  category: FoodCategory | string;
  size?: number;
  color?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  size = 18,
  color = '#2D6A4F',
}) => {
  switch (category) {
    case 'produce':
      return <Salad size={size} color={color} />;
    case 'dairy':
      return <Milk size={size} color={color} />;
    case 'meat':
      return <Beef size={size} color={color} />;
    case 'bakery':
      return <Wheat size={size} color={color} />;
    case 'pantry':
      return <Package size={size} color={color} />;
    case 'frozen':
      return <Snowflake size={size} color={color} />;
    case 'beverages':
      return <Coffee size={size} color={color} />;
    case 'snacks':
      return <Cookie size={size} color={color} />;
    case 'other':
    default:
      return <Box size={size} color={color} />;
  }
};

interface LocationIconProps {
  location: FoodLocation | 'all' | string;
  size?: number;
  color?: string;
}

export const LocationIcon: React.FC<LocationIconProps> = ({
  location,
  size = 16,
  color = '#2D6A4F',
}) => {
  switch (location) {
    case 'fridge':
      return <Refrigerator size={size} color={color} />;
    case 'freezer':
      return <Archive size={size} color={color} />;
    case 'pantry':
      return <Layers size={size} color={color} />;
    case 'all':
    default:
      return <UtensilsCrossed size={size} color={color} />;
  }
};
