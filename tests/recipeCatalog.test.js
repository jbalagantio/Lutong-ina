import assert from 'node:assert/strict'
import { test } from 'node:test'
import recipes from '../src/data/recipes.js'
import { recipeImages } from '../src/data/recipeImages.js'
import { validatePersonalRecipe } from '../src/utils/myDishes.js'
import { addMissingGroceryItems } from '../src/utils/groceryList.js'
import { getRecipeMatches } from '../src/utils/recommendations.js'

test('the built-in catalog keeps its recipe identities, valid instructions, and matching integration', () => {
  const expectedIds = [
    'chicken-adobo', 'pork-adobo', 'sinigang-na-baboy', 'tinolang-manok', 'ginisang-monggo',
    'tortang-talong', 'pork-menudo', 'chicken-afritada', 'bistek-tagalog', 'ginisang-ampalaya',
    'garlic-fried-rice', 'chicken-sopas', 'ensaladang-talong', 'ginataang-kalabasa', 'ginisang-pechay',
  ]
  assert.deepEqual(recipes.map((recipe) => recipe.id), expectedIds)
  assert.deepEqual(Object.keys(recipeImages).sort(), [...expectedIds].sort())
  for (const recipe of recipes) {
    assert.equal(validatePersonalRecipe(recipe).error, undefined, recipe.id)
    assert.ok(recipe.instructions.length > 0, recipe.id)
    assert.ok(recipe.instructions.every((step) => typeof step === 'string' && step.trim()), recipe.id)
    const [match] = getRecipeMatches([recipe], [])
    const grocery = addMissingGroceryItems([], match.missingIngredients, [])
    assert.equal(grocery.added.length, match.trackedCount, recipe.id)
  }
})
