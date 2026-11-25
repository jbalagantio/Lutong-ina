import assert from 'node:assert/strict'
import { test } from 'node:test'
import recipes from '../src/data/recipes.js'
import { recipeImages } from '../src/data/recipeImages.js'
import { preparePersonalRecipe, saveBuiltInRecipe, validatePersonalRecipe } from '../src/utils/myDishes.js'
import { addMissingGroceryItems, resolveGroceryCategory } from '../src/utils/groceryList.js'
import { addCookingRecency, getRecommendationCatalog, getRecipeMatches, selectCookingMode } from '../src/utils/recommendations.js'
import { filterDiscoverRecipes } from '../src/utils/discover.js'

test('the built-in catalog keeps its recipe identities, valid instructions, and matching integration', () => {
  const expectedIds = [
    'chicken-adobo', 'pork-adobo', 'sinigang-na-baboy', 'tinolang-manok', 'ginisang-monggo',
    'tortang-talong', 'pork-menudo', 'chicken-afritada', 'bistek-tagalog', 'ginisang-ampalaya',
    'garlic-fried-rice', 'chicken-sopas', 'ensaladang-talong', 'ginataang-kalabasa', 'ginisang-pechay',
  ]
  const newIds = [
    'pork-sisig', 'kare-kare', 'beef-caldereta', 'pork-binagoongan', 'bicol-express', 'lumpiang-shanghai',
    'pork-giniling', 'nilagang-baka', 'bulalo', 'chicken-inasal', 'paksiw-na-bangus', 'sinigang-na-hipon',
    'escabeche', 'pinakbet', 'laing',
  ]
  assert.equal(recipes.length, 30)
  assert.equal(new Set(recipes.map((recipe) => recipe.id)).size, 30)
  assert.deepEqual(recipes.map((recipe) => recipe.id), [...expectedIds, ...newIds])
  assert.deepEqual(Object.keys(recipeImages).sort(), [...expectedIds, ...newIds].sort())
  for (const recipe of recipes) {
    assert.equal(validatePersonalRecipe(recipe).error, undefined, recipe.id)
    assert.ok(recipe.instructions.length > 0, recipe.id)
    assert.ok(recipe.instructions.every((step) => typeof step === 'string' && step.trim()), recipe.id)
    const [match] = getRecipeMatches([recipe], [])
    const grocery = addMissingGroceryItems([], match.missingIngredients, [])
    assert.equal(grocery.added.length, match.trackedCount, recipe.id)
  }
})

test('new built-ins use aliases and categories without breaking personal recipes or cooking-history ranking', () => {
  const bangus = recipes.find((recipe) => recipe.id === 'paksiw-na-bangus')
  const filters = { query: 'bangus', cuisine: 'Filipino', maxTime: '60', difficulty: 'Easy' }
  assert.deepEqual(filterDiscoverRecipes(recipes, filters), [bangus])
  assert.equal(saveBuiltInRecipe([], bangus.id)[0].recipeId, bangus.id)
  const { recipe: personal } = preparePersonalRecipe({ ...bangus, name: 'Family paksiw' }, [])
  const catalog = getRecommendationCatalog([bangus], [personal])
  const pantry = [{ name: 'Bangus', isAvailable: true }]
  const matches = getRecipeMatches(catalog, pantry)
  assert.equal(matches[0].matchedIngredients[0].name, 'Milkfish')
  assert.equal(matches[1].matchPercentage, matches[0].matchPercentage)
  const cookedAt = '2026-11-25T00:00:00.000Z'
  const history = [{ id: 'meal', recipeId: bangus.id, recipeName: bangus.name, cookedAt }]
  const ranked = addCookingRecency(matches, history, new Date(cookedAt))
  const session = selectCookingMode({ rounds: {} }, 'pantry', ranked, 0)
  assert.equal(session.rounds.pantry.currentId, personal.id)
  for (const [name, category] of [
    ['Hipon', 'Seafood'], ['Giniling na baboy', 'Meat'], ["Lady's fingers", 'Vegetables'],
    ['Kakang gata', 'Grains and Staples'], ['Tanglad', 'Seasonings'],
  ]) assert.equal(resolveGroceryCategory(name, []), category)
})
