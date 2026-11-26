import { FoodCategory } from './items';

export interface OpenFoodFactsProduct {
  barcode: string;
  name: string;
  brand?: string;
  category: FoodCategory;
  photoUrl?: string;
  quantityStr?: string;
}

const mapTagsToCategory = (tags: string[] = []): FoodCategory => {
  const lowerTags = tags.map((t) => t.toLowerCase());

  if (lowerTags.some((t) => t.includes('dairy') || t.includes('milk') || t.includes('cheese') || t.includes('yogurt'))) {
    return 'dairy';
  }
  if (lowerTags.some((t) => t.includes('vegetable') || t.includes('fruit') || t.includes('produce') || t.includes('plant'))) {
    return 'produce';
  }
  if (lowerTags.some((t) => t.includes('meat') || t.includes('beef') || t.includes('chicken') || t.includes('pork') || t.includes('fish'))) {
    return 'meat';
  }
  if (lowerTags.some((t) => t.includes('bread') || t.includes('bakery') || t.includes('pastry') || t.includes('cake'))) {
    return 'bakery';
  }
  if (lowerTags.some((t) => t.includes('frozen') || t.includes('ice cream'))) {
    return 'frozen';
  }
  if (lowerTags.some((t) => t.includes('beverage') || t.includes('drink') || t.includes('juice') || t.includes('soda') || t.includes('tea'))) {
    return 'beverages';
  }
  if (lowerTags.some((t) => t.includes('snack') || t.includes('chip') || t.includes('cookie') || t.includes('chocolate') || t.includes('candy'))) {
    return 'snacks';
  }

  return 'pantry';
};

export const fetchProductByBarcode = async (barcode: string): Promise<OpenFoodFactsProduct | null> => {
  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) return null;

  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${cleanBarcode}.json`);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.status !== 1 || !data.product) {
      return null;
    }

    const p = data.product;
    const name = p.product_name || p.product_name_en || p.generic_name || 'Scanned Food Product';
    const brand = p.brands || '';
    const photoUrl = p.image_front_small_url || p.image_front_url || p.image_url || '';
    const tags = p.categories_tags || [];
    const category = mapTagsToCategory(tags);
    const quantityStr = p.quantity || '';

    return {
      barcode: cleanBarcode,
      name: brand ? `${brand} ${name}` : name,
      brand,
      category,
      photoUrl,
      quantityStr,
    };
  } catch (err) {
    console.error('Error fetching barcode from Open Food Facts:', err);
    return null;
  }
};
