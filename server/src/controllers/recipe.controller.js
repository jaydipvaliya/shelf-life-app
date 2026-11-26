const Item = require('../models/Item');
const Household = require('../models/Household');
const {
  getSmartKitchenSuggestions,
  getRecipeDetailsById,
  generateFoodSavingTips,
} = require('../services/recipe.service');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getUserKitchenItems = async (userId) => {
  const userHouseholds = await Household.find({
    'members.user': userId,
  }).select('_id');
  const householdIds = userHouseholds.map((h) => h._id);

  return Item.find({
    status: 'active',
    $or: [{ userId }, { householdId: { $in: householdIds } }],
  })
    .sort({ expiryDate: 1 })
    .select('name category location quantity unit expiryDate status');
};

/**
 * GET /recipes/suggestions?days=3&scope=all|expiring&ingredients=milk,eggs
 * Surface recipes using expiring items (and optionally all kitchen items)
 */
const getRecipeSuggestions = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 3;
  const scope = req.query.scope === 'expiring' ? 'expiring' : 'all';
  const selectedIngredients = typeof req.query.ingredients === 'string'
    ? req.query.ingredients.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(startOfToday);
  targetDate.setDate(targetDate.getDate() + days);
  targetDate.setHours(23, 59, 59, 999);

  const allItems = await getUserKitchenItems(req.user._id);
  const expiringItems = allItems.filter(
    (item) => new Date(item.expiryDate) <= targetDate
  );

  if (allItems.length === 0 || (scope === 'expiring' && expiringItems.length === 0)) {
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'No matching kitchen items found',
      data: {
        recipes: [],
        expiringIngredientsCount: expiringItems.length,
        kitchenItemsCount: allItems.length,
      },
      recipes: [],
    });
  }

  const recipes = await getSmartKitchenSuggestions({
    allItems,
    expiringItems,
    selectedIngredients,
    scope,
  });

  return res.status(200).json({
    success: true,
    statusCode: 200,
    message: 'Recipe suggestions retrieved',
    data: {
      recipes,
      expiringIngredientsCount: expiringItems.length,
      kitchenItemsCount: allItems.length,
    },
    recipes,
  });
});

/**
 * GET /api/recipes/kitchen-plan?days=5&scope=all|expiring&ingredients=...
 * Returns expiring items, all kitchen items, food-saving tips, and smart recipe suggestions
 */
const getKitchenPlan = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 5;
  const scope = req.query.scope === 'expiring' ? 'expiring' : 'all';
  const selectedIngredients = typeof req.query.ingredients === 'string'
    ? req.query.ingredients.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(startOfToday);
  targetDate.setDate(targetDate.getDate() + days);
  targetDate.setHours(23, 59, 59, 999);

  const allItems = await getUserKitchenItems(req.user._id);
  const expiringItems = allItems.filter(
    (item) => new Date(item.expiryDate) <= targetDate
  );

  const recipes = await getSmartKitchenSuggestions({
    allItems,
    expiringItems,
    selectedIngredients,
    scope,
  });

  const quickTips = generateFoodSavingTips(expiringItems);

  return ApiResponse.success(
    res,
    {
      expiringItems,
      kitchenItems: allItems,
      recipes,
      quickTips,
    },
    'Kitchen food & recipe plan retrieved'
  );
});

/**
 * GET /api/recipes/:id/details
 * Retrieve full step-by-step cooking instructions & ingredients for a recipe
 */
const getRecipeDetails = asyncHandler(async (req, res) => {
  const details = await getRecipeDetailsById(req.params.id);
  if (!details) {
    throw ApiError.notFound('Recipe details not available right now');
  }
  return ApiResponse.success(res, { recipe: details }, 'Recipe details retrieved');
});

module.exports = {
  getRecipeSuggestions,
  getKitchenPlan,
  getRecipeDetails,
};
