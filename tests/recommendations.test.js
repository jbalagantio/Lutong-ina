import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  compareRecipeIngredients,
  getAvailableIngredientNames,
  rankPantryRecommendations,
  selectNextRecommendation,
} from '../src/utils/recommendations.js'

const makeRecipe = (name, ingredientNames, cookingTime = 30) => ({
  id: name.toLowerCase(),
  name,
  cookingTime,
  ingredients: ingredientNames.map((ingredient) => ({ name: ingredient, quantity: 1, unit: 'cup' })),
})

const available = (...names) => names.map((name) => ({ name, isAvailable: true }))

const compare = (ingredientNames, pantry) => {
  const recipe = makeRecipe('Test dish', ingredientNames)
  return compareRecipeIngredients(recipe, getAvailableIngredientNames(pantry))
}

test('matches exact names, case, surrounding and repeated internal whitespace', () => {
  const match = compare(['Garlic', 'Fish sauce', 'Tomato', 'Soy sauce'], available(
    'Garlic', 'FISH SAUCE', '  Tomato  ', 'Soy \t  sauce',
  ))
  assert.equal(match.matchedCount, 4)
  assert.equal(match.matchPercentage, 100)
  assert.deepEqual(match.missingIngredients, [])
})

test('matches Filipino and English aliases and explicit plurals in both directions', () => {
  const match = compare(
    ['Water spinach', 'Bitter melon', 'Sitaw', 'Eggplant', 'Garlic', 'Ginger', 'Tomato',
      'Mung beans', 'Moringa leaves', 'Fish sauce', 'Soy sauce', 'Egg', 'Potato', 'Carrot'],
    available('Kangkong', 'Ampalaya', 'Long beans', 'Talong', 'Bawang', 'Luya', 'Kamatis',
      'Monggo', 'Malunggay', 'Patis', 'Toyo', 'Eggs', 'Potatoes', 'Carrots'),
  )
  assert.equal(match.matchedCount, 14)
  assert.equal(match.matchPercentage, 100)
})

test('rejects unavailable ingredients and distinct meat, onion, and pepper variants', () => {
  const pantry = [
    ...available('Pork', 'Pork shoulder', 'Red onion', 'Ground black pepper'),
    { name: 'Garlic', isAvailable: false },
    { name: 'Egg', isAvailable: 'true' },
  ]
  const match = compare(['Pork belly', 'Pork ribs', 'Yellow onion', 'Black peppercorns', 'Garlic', 'Egg'], pantry)
  assert.equal(match.matchedCount, 0)
  assert.equal(match.matchPercentage, 0)
  assert.equal(match.missingIngredients.length, 6)
})

test('deduplicates both sides, ignores water, and keeps fractional match percentages', () => {
  const match = compare(
    ['Water', 'Garlic', 'Bawang', 'Fish sauce', 'Tomato'],
    available('Garlic', 'Bawang', ' GARLIC '),
  )
  assert.equal(match.trackedCount, 3)
  assert.equal(match.matchedCount, 1)
  assert.equal(match.matchPercentage, (1 / 3) * 100)
  assert.deepEqual(match.matchedIngredients.map((item) => item.name), ['Garlic'])
  assert.deepEqual(match.missingIngredients.map((item) => item.name), ['Fish sauce', 'Tomato'])
})

test('returns a safe zero score for empty and water-only recipes', () => {
  for (const ingredientNames of [[], ['Water']]) {
    const match = compare(ingredientNames, available('Water'))
    assert.equal(match.trackedCount, 0)
    assert.equal(match.matchPercentage, 0)
    assert.deepEqual(match.missingIngredients, [])
  }
})

test('ranks by raw coverage, missing count, time, then name, without mutating inputs', () => {
  const pantry = available('Garlic', 'Fish sauce')
  const recipes = [
    makeRecipe('Zero', ['Egg'], 1),
    makeRecipe('More missing', ['Garlic', 'Fish sauce', 'Tomato', 'Potato'], 2),
    makeRecipe('Zulu', ['Garlic', 'Potato'], 10),
    makeRecipe('Slow', ['Garlic', 'Tomato'], 25),
    makeRecipe('Alpha', ['Garlic', 'Tomato'], 10),
    makeRecipe('Best', ['Garlic', 'Fish sauce', 'Tomato'], 60),
  ]
  const originalPantry = structuredClone(pantry)
  const originalRecipes = structuredClone(recipes)
  const matches = recipes.map((recipe) => compareRecipeIngredients(recipe, getAvailableIngredientNames(pantry)))
  const ranked = rankPantryRecommendations(matches)

  assert.deepEqual(ranked.map((match) => match.recipe.name), [
    'Best', 'Alpha', 'Zulu', 'Slow', 'More missing',
  ])
  assert.deepEqual(pantry, originalPantry)
  assert.deepEqual(recipes, originalRecipes)
  assert.deepEqual(matches.map((match) => match.recipe), originalRecipes)

  const closeScores = [
    { ...ranked[0], matchPercentage: 66.51 },
    { ...ranked[1], matchPercentage: 66.52 },
  ]
  assert.equal(rankPantryRecommendations(closeScores)[0], closeScores[1])
})

test('selects only unseen recipes, preserves rank when requested, and stops when exhausted', () => {
  const matches = ['First', 'Second', 'Third'].map((name) =>
    compareRecipeIngredients(makeRecipe(name, ['Garlic']), getAvailableIngredientNames(available('Garlic'))),
  )
  assert.equal(selectNextRecommendation(matches, [], false), matches[0])
  assert.equal(selectNextRecommendation(matches, ['first'], false), matches[1])
  assert.equal(selectNextRecommendation(matches, ['first', 'third'], true), matches[1])
  assert.equal(selectNextRecommendation(matches, ['first', 'second', 'third'], true), null)
  assert.equal(selectNextRecommendation([matches[0]], ['first'], false), null)
})
