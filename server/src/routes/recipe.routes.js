const express = require('express');
const verifyJWT = require('../middleware/auth.middleware');
const {
  getRecipeSuggestions,
  getKitchenPlan,
  getRecipeDetails,
} = require('../controllers/recipe.controller');

const router = express.Router();

// Protect all recipe routes with JWT
router.use(verifyJWT);

// GET /recipes/suggestions?days=3 (primary endpoint per spec)
router.get('/suggestions', getRecipeSuggestions);

// GET /recipes/suggest (alias)
router.get('/suggest', getRecipeSuggestions);

// GET /recipes/kitchen-plan?days=5&scope=all|expiring&ingredients=...
router.get('/kitchen-plan', getKitchenPlan);

// GET /recipes/:id/details
router.get('/:id/details', getRecipeDetails);

module.exports = router;
