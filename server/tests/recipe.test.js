const assert = require('assert');
const {
  slugify,
  cleanIngredientName,
  generateCacheKey,
  getSuggestionsForIngredients,
  recipeCache,
  clearCache,
} = require('../src/services/recipe.service');

async function testRecipeService() {
  console.log('🧪 Testing Recipe Service & Caching Logic...\n');

  // 1. Test slugify
  console.log('➡️ Testing slugify helper...');
  const slug = slugify('Creamy Spinach & Feta Omelette 101!');
  assert.strictEqual(slug, 'creamy-spinach-feta-omelette-101');
  console.log('  ✅ Slugify passed:', slug);

  // 2. Test cleanIngredientName
  console.log('➡️ Testing cleanIngredientName...');
  const clean1 = cleanIngredientName('Organic Whole Milk');
  const clean2 = cleanIngredientName('Fresh Spinach Leaves');
  assert.strictEqual(clean1, 'milk');
  assert.strictEqual(clean2, 'spinach leaves');
  console.log('  ✅ cleanIngredientName passed');

  // 3. Test generateCacheKey (deterministic sorting)
  console.log('➡️ Testing generateCacheKey sorting...');
  const key1 = generateCacheKey(['Spinach', 'Milk', 'Eggs']);
  const key2 = generateCacheKey(['eggs', 'spinach', 'milk']);
  assert.strictEqual(key1, key2);
  assert.strictEqual(key1, 'eggs,milk,spinach');
  console.log('  ✅ Cache key normalization passed:', key1);

  // 4. Test In-Memory Caching with TTL
  console.log('➡️ Testing in-memory cache mechanism...');
  clearCache();
  const mockKey = generateCacheKey(['eggs', 'milk']);
  const mockRecipes = [
    {
      id: 999,
      title: 'Scrambled Eggs with Milk',
      image: 'https://spoonacular.com/recipeImages/999-312x231.jpg',
      sourceUrl: 'https://spoonacular.com/recipes/scrambled-eggs-with-milk-999',
      usedIngredients: ['egg', 'milk'],
      missedIngredients: ['butter'],
      usedCount: 2,
      missedCount: 1,
    },
  ];

  recipeCache.set(mockKey, {
    data: mockRecipes,
    expiresAt: Date.now() + 1000 * 60 * 60, // 1 hour
  });

  const suggestions = await getSuggestionsForIngredients(['Milk', 'Eggs']);
  assert.strictEqual(suggestions.length, 1);
  assert.strictEqual(suggestions[0].id, 999);
  assert.strictEqual(suggestions[0].sourceUrl, 'https://spoonacular.com/recipes/scrambled-eggs-with-milk-999');
  console.log('  ✅ Cache hit verified without external API call!');

  // 5. Test empty ingredients
  console.log('➡️ Testing empty ingredients array...');
  const emptyRes = await getSuggestionsForIngredients([]);
  assert.deepStrictEqual(emptyRes, []);
  console.log('  ✅ Empty ingredients returns empty array immediately');

  // 6. Test missing API key graceful fallback
  console.log('➡️ Testing missing/invalid API key fallback (no unhandled error)...');
  clearCache();
  // Without Spoonacular key in env, it should return [] safely
  const fallbackRes = await getSuggestionsForIngredients(['carrots', 'potatoes']);
  assert.deepStrictEqual(fallbackRes, []);
  console.log('  ✅ Graceful quota/key fallback verified');

  console.log('\n🎉 ALL RECIPE SERVICE TESTS PASSED!\n');
}

testRecipeService().catch((err) => {
  console.error('❌ Recipe test failed:', err);
  process.exit(1);
});
