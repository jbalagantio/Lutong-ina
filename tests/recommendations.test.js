import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  advanceRecommendationSession,
  compareRecipeIngredients,
  getAvailableIngredientNames,
  getEligibleRecommendations,
  getRecipeMatches,
  rankPantryRecommendations,
  refreshPantryRound,
  selectCookingMode,
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

test('new aliases match both ways and deduplicate conflicting pantry and recipe entries', () => {
  const pantry = [
    { name: 'Chicken', isAvailable: false },
    { name: 'Manok', isAvailable: true },
    { name: 'Tubig', isAvailable: true },
  ]
  const ingredients = ['Chicken', 'Manok', 'Water', 'Tubig']
  const match = compare(ingredients, pantry)
  assert.deepEqual([...getAvailableIngredientNames(pantry)], ['chicken', 'water'])
  assert.equal(match.matchedCount, 1)
  assert.equal(match.trackedCount, 1)
  assert.equal(match.matchPercentage, 100)

  const reverseMatch = compare(['Manok', 'Tubig'], available('Chicken'))
  assert.equal(reverseMatch.matchedCount, 1)
  assert.deepEqual(reverseMatch.missingIngredients, [])

  const outOfStock = pantry.map((item) => ({ ...item, isAvailable: false }))
  const missing = compare(ingredients, outOfStock)
  assert.equal(missing.matchedCount, 0)
  assert.deepEqual(missing.missingIngredients.map((item) => item.name), ['Chicken'])
})

test('generic, differently prepared, and materially different ingredients remain distinct', () => {
  const distinctPairs = [
    ['Pork', 'Pork belly'], ['Liempo', 'Kasim'], ['Kasim', 'Pork ribs'],
    ['Beef', 'Beef sirloin'], ['Onion', 'Yellow onion'], ['Sibuyas', 'Red onion'],
    ['Red onion', 'Yellow onion'], ['White onion', 'Yellow onion'],
    ['Garlic powder', 'Garlic'], ['Tomato', 'Tomato sauce'], ['Vinegar', 'Cane vinegar'],
    ['Calamansi', 'Calamansi juice'], ['Tamarind paste', 'Tamarind pulp'],
    ['Tamarind concentrate', 'Tamarind pulp'], ['Black peppercorns', 'Ground black pepper'],
    ['Uncooked rice', 'Cooked rice'], ['Rice', 'Cooked rice'],
    ['Coconut cream', 'Coconut milk'], ['Evaporated milk', 'Coconut milk'],
    ['Beans', 'Long beans'], ['Beans', 'Mung beans'], ['Long beans', 'Mung beans'],
    ['Pechay Baguio', 'Pechay'],
  ]
  for (const [pantryName, recipeName] of distinctPairs) {
    assert.equal(compare([recipeName], available(pantryName)).matchedCount, 0, pantryName)
    assert.equal(compare([pantryName], available(recipeName)).matchedCount, 0, recipeName)
  }
})

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
  assert.equal(selectNextRecommendation(matches, []), matches[0])
  assert.equal(selectNextRecommendation(matches, ['first']), matches[1])
  assert.equal(selectNextRecommendation(matches, ['first', 'third'], 0.75), matches[1])
  assert.equal(selectNextRecommendation(matches, ['first', 'second', 'third'], 0.75), null)
  assert.equal(selectNextRecommendation([matches[0]], ['first']), null)
})

const newSession = () => ({ mode: null, rounds: {} })
const sessionRecipes = [
  makeRecipe('Adobo', ['Garlic', 'Soy sauce'], 40),
  makeRecipe('Omelette', ['Egg'], 15),
  makeRecipe('Soup', ['Garlic', 'Ginger', 'Cabbage'], 25),
]

test('first selection starts an independent round and revisiting a mode restores it', () => {
  const matches = getRecipeMatches(sessionRecipes, available('Egg', 'Garlic'))
  const pantry = selectCookingMode(newSession(), 'pantry', matches, 0.99)
  assert.deepEqual(pantry.rounds.pantry, { currentId: 'omelette', suggestedIds: ['omelette'] })
  const shopping = selectCookingMode(pantry, 'shopping', matches, 0)
  const nextShopping = advanceRecommendationSession(shopping, matches, 0.9, false)
  const exploration = selectCookingMode(nextShopping, 'new', matches, 0.4)
  assert.deepEqual(exploration.rounds.new, { currentId: 'omelette', suggestedIds: ['omelette'] })
  assert.deepEqual(exploration.rounds.shopping, { currentId: 'soup', suggestedIds: ['adobo', 'soup'] })
  assert.equal(selectCookingMode(exploration, 'pantry', matches, 0).rounds.pantry, pantry.rounds.pantry)
  assert.equal(selectCookingMode(exploration, 'shopping', matches, 0).rounds.shopping, nextShopping.rounds.shopping)
  assert.equal(selectCookingMode(exploration, 'new', matches, 0), exploration)
})

test('queued actions using the same draw select distinct recipes, and randomized restart skips the last dish', () => {
  const matches = getRecipeMatches(sessionRecipes, [])
  for (const mode of ['shopping', 'new']) {
    const initial = selectCookingMode(newSession(), mode, matches, 0.99)
    const advance = (session) => advanceRecommendationSession(session, matches, 0, false)
    const exhausted = [advance, advance, advance].reduce((session, action) => action(session), initial)
    assert.deepEqual(exhausted.rounds[mode], { currentId: 'omelette', suggestedIds: ['soup', 'adobo', 'omelette'] })
    assert.equal(advance(exhausted), exhausted)
    const restarted = advanceRecommendationSession(exhausted, matches, 0.99, true)
    assert.deepEqual(restarted.rounds[mode], { currentId: 'soup', suggestedIds: ['soup'] })
    assert.equal(advanceRecommendationSession(restarted, matches, 0, true), restarted)
  }
})

test('eligible current recipes keep their IDs while percentages and ingredient lists update', () => {
  const initialMatches = getRecipeMatches(sessionRecipes, available('Garlic'))
  const updatedMatches = getRecipeMatches(sessionRecipes, available('Garlic', 'Soy sauce', 'Egg'))
  const pantry = selectCookingMode(newSession(), 'pantry', initialMatches, 0)
  assert.equal(initialMatches[0].matchPercentage, 50)
  assert.equal(updatedMatches[0].matchPercentage, 100)
  assert.deepEqual(updatedMatches[0].missingIngredients, [])
  assert.equal(refreshPantryRound(pantry, updatedMatches), pantry)
  const shopping = selectCookingMode(pantry, 'shopping', initialMatches, 0)
  const exploration = selectCookingMode(shopping, 'new', initialMatches, 0.99)
  const allUnavailable = getRecipeMatches(sessionRecipes, [])
  const refreshed = refreshPantryRound(exploration, allUnavailable)
  assert.equal(refreshed.rounds.shopping, shopping.rounds.shopping)
  assert.equal(refreshed.rounds.new, exploration.rounds.new)
  assert.equal(allUnavailable[0].matchPercentage, 0)
})

test('pantry changes select the next unseen eligible dish and keep the previous round history', () => {
  const onlyEggs = getRecipeMatches(sessionRecipes, available('Egg'))
  const onlyGarlic = getRecipeMatches(sessionRecipes, available('Garlic'))
  const pantry = selectCookingMode(newSession(), 'pantry', onlyEggs, 0)
  const shopping = selectCookingMode(pantry, 'shopping', onlyEggs, 0)
  const returned = selectCookingMode(shopping, 'pantry', onlyGarlic, 0.99)
  assert.deepEqual(returned.rounds.pantry, { currentId: 'adobo', suggestedIds: ['omelette', 'adobo'] })
  assert.equal(returned.rounds.shopping, shopping.rounds.shopping)
  const exhausted = refreshPantryRound(returned, onlyEggs)
  assert.deepEqual(exhausted.rounds.pantry, { currentId: null, suggestedIds: ['omelette', 'adobo'] })
  const restarted = advanceRecommendationSession(exhausted, onlyEggs, 0.99, true)
  assert.deepEqual(restarted.rounds.pantry, { currentId: 'omelette', suggestedIds: ['omelette'] })
  assert.equal(restarted.rounds.shopping, shopping.rounds.shopping)
})

test('pantry handles zero and one eligible dish and accepts newly eligible unseen recipes', () => {
  for (const ingredients of [[], [{ name: 'Egg', isAvailable: false }], available('Chocolate')]) {
    const matches = getRecipeMatches(sessionRecipes, ingredients)
    assert.deepEqual(getEligibleRecommendations('pantry', matches), [])
    const session = selectCookingMode(newSession(), 'pantry', matches, 0.8)
    assert.deepEqual(session.rounds.pantry, { currentId: null, suggestedIds: [] })
    assert.equal(advanceRecommendationSession(session, matches, 0.8, true), session)
    const onlyEggs = getRecipeMatches(sessionRecipes, available('Egg'))
    const recovered = refreshPantryRound(session, onlyEggs)
    assert.deepEqual(recovered.rounds.pantry, { currentId: 'omelette', suggestedIds: ['omelette'] })
    assert.equal(advanceRecommendationSession(recovered, onlyEggs, 0.8, false), recovered)
    assert.equal(advanceRecommendationSession(recovered, onlyEggs, 0.8, true), recovered)
    const expanded = getRecipeMatches(sessionRecipes, available('Egg', 'Garlic'))
    assert.equal(refreshPantryRound(recovered, expanded), recovered)
    const next = advanceRecommendationSession(recovered, expanded, 0.99, false)
    assert.deepEqual(next.rounds.pantry, { currentId: 'adobo', suggestedIds: ['omelette', 'adobo'] })
    const end = advanceRecommendationSession(next, expanded, 0.99, false)
    assert.equal(end.rounds.pantry.currentId, 'soup')
    assert.equal(advanceRecommendationSession(end, expanded, 0.99, true).rounds.pantry.currentId, 'omelette')
  }
})
