/**
 * Spoonacular & Built-in Kitchen Recipe Service with In-Memory TTL Caching
 */
const BUILTIN_RECIPES = require('../data/builtinRecipes');

// In-memory caches: Map<cacheKey, { data, expiresAt }>
const recipeCache = new Map();
const recipeDetailCache = new Map();
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours TTL
const MAX_CACHE_ENTRIES = 200;

const setBoundedCache = (cache, key, data) => {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

/**
 * Generate a clean URL slug from recipe title
 */
const slugify = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Clean ingredient names for Spoonacular search (lowercase, strip brand/organic prefixes)
 */
const cleanIngredientName = (name) => {
  return name
    .toLowerCase()
    .replace(/\b(organic|fresh|raw|frozen|canned|natural|pure|whole|sliced|chopped|diced)\b/gi, '')
    .replace(/[^a-z\s]/g, '')
    .trim();
};

/**
 * Generate a cache key from an array of ingredient names
 */
const generateCacheKey = (ingredients) => {
  return ingredients
    .map((i) => cleanIngredientName(i))
    .filter(Boolean)
    .sort()
    .join(',');
};

const tokenize = (text) => {
  return cleanIngredientName(text || '')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
};

const itemMatchesIngredient = (itemName, ingredientNameOrKeyword) => {
  const cleanItem = cleanIngredientName(itemName);
  const cleanTarget = cleanIngredientName(ingredientNameOrKeyword);
  if (!cleanItem || !cleanTarget) return false;
  if (cleanItem.includes(cleanTarget) || cleanTarget.includes(cleanItem)) {
    return true;
  }
  const itemTokens = tokenize(itemName);
  const targetTokens = tokenize(ingredientNameOrKeyword);
  return itemTokens.some((t) =>
    targetTokens.some((k) => t === k || `${t}s` === k || `${k}s` === t)
  );
};

/**
 * Fetch recipe suggestions from Spoonacular by ingredients
 * @param {string[]} ingredientNames
 * @returns {Promise<Array>}
 */
const getSuggestionsForIngredients = async (ingredientNames = []) => {
  if (!ingredientNames || ingredientNames.length === 0) {
    return [];
  }

  const cleanedIngredients = Array.from(
    new Set(ingredientNames.map((n) => cleanIngredientName(n)).filter(Boolean))
  );

  if (cleanedIngredients.length === 0) {
    return [];
  }

  const cacheKey = generateCacheKey(cleanedIngredients);

  // Check in-memory cache
  const cached = recipeCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    console.log(`⚡ [Recipe Cache HIT] Returning ${cached.data.length} cached recipe(s) for: ${cacheKey}`);
    return cached.data;
  }

  const apiKey = process.env.SPOONACULAR_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    console.warn('⚠️ [Recipe Service] SPOONACULAR_API_KEY is not set in environment. Returning empty recipes list.');
    return [];
  }

  const ingredientsQuery = encodeURIComponent(cleanedIngredients.join(','));
  const url = `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${ingredientsQuery}&ranking=1&number=10&apiKey=${apiKey.trim()}`;

  try {
    console.log(`🌐 [Recipe Service] Calling Spoonacular findByIngredients for: ${cleanedIngredients.join(', ')}`);
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 402) {
        console.warn('⚠️ [Recipe Service] Spoonacular daily API quota exhausted (Status 402). Returning empty recipes.');
      } else {
        console.error(`❌ [Recipe Service] Spoonacular API returned status ${response.status}: ${errorText}`);
      }
      return [];
    }

    const rawRecipes = await response.json();

    if (!Array.isArray(rawRecipes)) {
      console.warn('⚠️ [Recipe Service] Unexpected response format from Spoonacular:', rawRecipes);
      return [];
    }

    const normalized = rawRecipes.map((r) => {
      const titleSlug = slugify(r.title || 'recipe');
      const sourceUrl = `https://spoonacular.com/recipes/${titleSlug}-${r.id}`;

      const usedIngredients = (r.usedIngredients || []).map(
        (ing) => ing.name || ing.originalName || ing.original
      );
      const missedIngredients = (r.missedIngredients || []).map(
        (ing) => ing.name || ing.originalName || ing.original
      );

      return {
        id: r.id,
        title: r.title,
        image: r.image,
        sourceUrl,
        usedIngredients,
        missedIngredients,
        usedCount: r.usedIngredientCount ?? usedIngredients.length,
        missedCount: r.missedIngredientCount ?? missedIngredients.length,
      };
    });

    setBoundedCache(recipeCache, cacheKey, normalized);

    console.log(`✅ [Recipe Service] Successfully fetched and cached ${normalized.length} recipe(s)`);
    return normalized;
  } catch (error) {
    console.error('❌ [Recipe Service] Network or fetch error calling Spoonacular:', error.message);
    return [];
  }
};

/**
 * Fetch detailed instructions and ingredients for a recipe ID
 */
const getRecipeDetailsById = async (recipeId) => {
  const numericId = Number(recipeId);
  const builtin = BUILTIN_RECIPES.find((r) => r.id === numericId);
  if (builtin) {
    return {
      id: builtin.id,
      title: builtin.title,
      image: builtin.image,
      sourceUrl: '',
      readyInMinutes: builtin.readyInMinutes,
      servings: builtin.servings,
      ingredientsList: builtin.ingredientsList,
      instructions: builtin.instructions,
      isBuiltin: true,
    };
  }

  const cached = recipeDetailCache.get(numericId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey || apiKey.trim() === '' || Number.isNaN(numericId)) {
    return null;
  }

  const url = `https://api.spoonacular.com/recipes/${numericId}/information?includeNutrition=false&apiKey=${apiKey.trim()}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const raw = await response.json();

    const steps = [];
    if (Array.isArray(raw.analyzedInstructions) && raw.analyzedInstructions[0]?.steps) {
      for (const s of raw.analyzedInstructions[0].steps) {
        if (s.step) steps.push(s.step.trim());
      }
    } else if (typeof raw.instructions === 'string' && raw.instructions.trim()) {
      const cleaned = raw.instructions
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .split(/\n+|\.\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 3);
      steps.push(...cleaned);
    }

    const ingredientsList = Array.isArray(raw.extendedIngredients)
      ? raw.extendedIngredients.map((i) => i.original || i.name).filter(Boolean)
      : [];

    const details = {
      id: raw.id,
      title: raw.title,
      image: raw.image || '',
      sourceUrl: raw.sourceUrl || raw.spoonacularSourceUrl || '',
      readyInMinutes: raw.readyInMinutes || 20,
      servings: raw.servings || 2,
      ingredientsList,
      instructions: steps,
      isBuiltin: false,
    };

    setBoundedCache(recipeDetailCache, numericId, details);
    return details;
  } catch (err) {
    console.error('❌ [Recipe Service] Failed fetching recipe details:', err.message);
    return null;
  }
};

/**
 * Enrich & rank recipes (Spoonacular + Built-in recipes) against the user's active kitchen & expiring items
 */
const getSmartKitchenSuggestions = async ({
  allItems = [],
  expiringItems = [],
  selectedIngredients = [],
  scope = 'all',
}) => {
  const activePool = scope === 'expiring' ? expiringItems : allItems;
  if (!activePool || activePool.length === 0) {
    return [];
  }

  const expiringIds = new Set(expiringItems.map((i) => String(i._id)));

  // Determine seed ingredient names for Spoonacular query
  const seedItems =
    selectedIngredients.length > 0
      ? activePool.filter((i) =>
          selectedIngredients.some((sel) => itemMatchesIngredient(i.name, sel))
        )
      : expiringItems.length > 0 && scope !== 'kitchen-only'
      ? [...expiringItems, ...allItems.filter((i) => !expiringIds.has(String(i._id)))].slice(0, 6)
      : activePool.slice(0, 6);

  const seedNames = seedItems.map((i) => i.name);

  // 1. Fetch Spoonacular matches (gracefully returns [] if no key / offline / quota)
  const spoonacularMatches = await getSuggestionsForIngredients(seedNames);

  // Helper to map matched ingredients back to user's actual kitchen items
  const annotateKitchenMatches = (recipe) => {
    const matchedKitchenItems = [];
    const expiringMatched = [];
    const seenIds = new Set();

    const candidateNames = [
      ...(recipe.usedIngredients || []),
      ...(recipe.keywords || []),
    ];

    for (const item of allItems) {
      if (seenIds.has(String(item._id))) continue;

      const matched = candidateNames.some((cand) => itemMatchesIngredient(item.name, cand));
      if (!matched) continue;

      // If user explicitly picked specific ingredients, check filter compatibility
      seenIds.add(String(item._id));
      matchedKitchenItems.push(item);
      if (expiringIds.has(String(item._id))) {
        expiringMatched.push(item.name);
      }
    }

    const usedFromKitchen = matchedKitchenItems.map((i) => i.name);
    const usedIngredients =
      usedFromKitchen.length > 0
        ? Array.from(new Set(usedFromKitchen))
        : recipe.usedIngredients || [];

    return {
      id: recipe.id,
      title: recipe.title,
      image: recipe.image || '',
      sourceUrl: recipe.sourceUrl || '',
      readyInMinutes: recipe.readyInMinutes || null,
      servings: recipe.servings || null,
      usedIngredients,
      expiringMatchedIngredients: Array.from(new Set(expiringMatched)),
      matchedItemIds: matchedKitchenItems.map((i) => String(i._id)),
      missedIngredients: recipe.missedIngredients || [],
      ingredientsList: recipe.ingredientsList || [],
      instructions: recipe.instructions || [],
      usedCount: usedIngredients.length,
      missedCount: (recipe.missedIngredients || []).length,
      expiringMatchCount: expiringMatched.length,
      isBuiltin: Boolean(recipe.isBuiltin),
    };
  };

  // 2. Match built-in recipes against kitchen items
  const builtinAnnotated = BUILTIN_RECIPES.map((recipe) => {
    const matchedKeywords = [];
    const missingKeywords = [];

    // Check which recipe ingredients are in kitchen vs missing
    const matchedKitchen = allItems.filter((item) =>
      recipe.keywords.some((kw) => itemMatchesIngredient(item.name, kw))
    );

    if (matchedKitchen.length === 0) {
      return null;
    }

    // Check selected ingredient filter if provided
    if (selectedIngredients.length > 0) {
      const matchesSelected = selectedIngredients.some((sel) =>
        recipe.keywords.some((kw) => itemMatchesIngredient(sel, kw))
      );
      if (!matchesSelected) return null;
    }

    for (const ingLine of recipe.ingredientsList) {
      const foundInKitchen = allItems.some((item) => itemMatchesIngredient(item.name, ingLine));
      if (foundInKitchen) {
        matchedKeywords.push(ingLine);
      } else {
        missingKeywords.push(ingLine);
      }
    }

    return annotateKitchenMatches({
      ...recipe,
      usedIngredients: matchedKitchen.map((i) => i.name),
      missedIngredients: missingKeywords.slice(0, 4),
      isBuiltin: true,
    });
  }).filter(Boolean);

  // 3. Annotate Spoonacular matches
  const spoonacularAnnotated = spoonacularMatches
    .map((r) => annotateKitchenMatches({ ...r, isBuiltin: false }))
    .filter((r) => {
      if (scope === 'expiring' && r.expiringMatchCount === 0 && expiringItems.length > 0) {
        return false;
      }
      return r.usedCount > 0;
    });

  // 4. Merge & deduplicate by normalized title, preferring recipes with expiring matches & full instructions
  const mergedMap = new Map();
  for (const r of [...spoonacularAnnotated, ...builtinAnnotated]) {
    if (scope === 'expiring' && expiringItems.length > 0 && r.expiringMatchCount === 0) {
      continue;
    }
    const key = r.title.toLowerCase().trim();
    const existing = mergedMap.get(key);
    if (!existing || (r.instructions.length > existing.instructions.length)) {
      mergedMap.set(key, r);
    }
  }

  const results = Array.from(mergedMap.values());

  // 5. Sort: Expiring items rescued first, then total kitchen items used, then built-in instructions availability
  results.sort((a, b) => {
    if (b.expiringMatchCount !== a.expiringMatchCount) {
      return b.expiringMatchCount - a.expiringMatchCount;
    }
    if (b.usedCount !== a.usedCount) {
      return b.usedCount - a.usedCount;
    }
    return a.missedCount - b.missedCount;
  });

  return results.slice(0, 15);
};

/**
 * Generate quick actionable tips to save expiring food items before they spoil
 */
const generateFoodSavingTips = (expiringItems = []) => {
  return expiringItems.slice(0, 5).map((item) => {
    const nameLower = (item.name || '').toLowerCase();
    let tip = 'Use in tonight’s meal or portion and freeze to extend shelf life.';

    if (item.category === 'dairy' || /milk|yogurt|cheese|cream/.test(nameLower)) {
      tip = /milk|cream/.test(nameLower)
        ? 'Use in pancakes, oatmeal, smoothies, or freeze in ice-cube trays for cooking.'
        : 'Mix into sauces, omelettes, quesadillas, or parfaits before it turns.';
    } else if (item.category === 'bakery' || /bread|bun|bagel|tortilla/.test(nameLower)) {
      tip = 'Freeze slices with parchment between them, toast for French toast, or cube into croutons.';
    } else if (item.category === 'produce' || /spinach|banana|berry|tomato|avocado/.test(nameLower)) {
      if (/banana|berry/.test(nameLower)) {
        tip = 'Peel/slice and freeze for smoothies or mash into banana oat pancakes.';
      } else if (/spinach|greens|kale/.test(nameLower)) {
        tip = 'Wilt into pasta, omelettes, soups, or blend straight into a green smoothie.';
      } else {
        tip = 'Roast on a sheet pan, toss into stir-fry, or simmer into soup/sauce today.';
      }
    } else if (item.category === 'meat' || /chicken|beef|fish|shrimp|pork/.test(nameLower)) {
      tip = 'Cook tonight in a skillet/stir-fry or freeze in an airtight freezer bag immediately.';
    }

    return {
      itemId: String(item._id),
      itemName: item.name,
      daysUntilExpiry: item.daysUntilExpiry,
      location: item.location,
      tip,
    };
  });
};

/**
 * Clear cache helper (for testing)
 */
const clearCache = () => {
  recipeCache.clear();
  recipeDetailCache.clear();
};

module.exports = {
  getSuggestionsForIngredients,
  getSmartKitchenSuggestions,
  getRecipeDetailsById,
  generateFoodSavingTips,
  generateCacheKey,
  cleanIngredientName,
  slugify,
  clearCache,
  recipeCache,
};
