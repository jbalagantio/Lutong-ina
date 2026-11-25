import assert from 'node:assert/strict'
import { test } from 'node:test'
import recipes from '../src/data/recipes.js'
import { getRecipeMatches } from '../src/utils/recommendations.js'
import { filterDiscoverRecipes, getDiscoverFilterOptions, getRecipeIngredientStatuses } from '../src/utils/discover.js'

const names = (results) => results.map((recipe) => recipe.name)

test('empty and whitespace-only searches return the full catalog in alphabetical order', () => {
  const expected = names(recipes).sort((first, second) => first.localeCompare(second, 'en'))
  assert.deepEqual(names(filterDiscoverRecipes(recipes)), expected)
  assert.deepEqual(names(filterDiscoverRecipes(recipes, { query: '   \t ' })), expected)
})

test('search matches partial recipe names independent of case and whitespace', () => {
  assert.deepEqual(names(filterDiscoverRecipes(recipes, { query: '  aDoB ' })), ['Chicken Adobo', 'Pork Adobo'])
  assert.deepEqual(names(filterDiscoverRecipes(recipes, { query: '  CHICKEN    ADOBO  ' })), ['Chicken Adobo'])
})

test('ingredient search uses partial English names and Filipino and English synonyms', () => {
  for (const [query, equivalent] of [
    ['bangus', 'milkfish'],
    ['talon', 'eggplant'],
    ['toyo', 'soy sauce'],
    ['bawang', 'garlic'],
    ['kangkong', 'water spinach'],
    ['aubergine', 'eggplant'],
  ]) {
    const matches = filterDiscoverRecipes(recipes, { query })
    assert.ok(matches.length > 0, query)
    assert.deepEqual(matches, filterDiscoverRecipes(recipes, { query: equivalent }), query)
  }
  assert.deepEqual(
    filterDiscoverRecipes(recipes, { query: ' WATER    SPINACH ' }),
    filterDiscoverRecipes(recipes, { query: 'water spinach' }),
  )
  const inasal = recipes.find((recipe) => recipe.id === 'chicken-inasal')
  const chickenResults = filterDiscoverRecipes(recipes, { query: 'chicken' })
  assert.ok(chickenResults.includes(inasal))
  assert.deepEqual(filterDiscoverRecipes(recipes, { query: 'manok' }), chickenResults.filter((recipe) => recipe !== inasal))
})

test('search treats special characters literally and handles no results', () => {
  assert.deepEqual(filterDiscoverRecipes(recipes, { query: '[.*' }), [])
  const recipe = { ...recipes[0], name: 'Dish [.*]' }
  assert.deepEqual(filterDiscoverRecipes([recipe], { query: '[.*' }), [recipe])
  assert.deepEqual(filterDiscoverRecipes(recipes, { query: 'definitely no dish' }), [])
})

test('cuisine and difficulty match the selected values independently', () => {
  assert.equal(filterDiscoverRecipes(recipes, { cuisine: 'Filipino' }).length, recipes.length)
  assert.deepEqual(filterDiscoverRecipes(recipes, { cuisine: 'Absent cuisine' }), [])
  const medium = filterDiscoverRecipes(recipes, { difficulty: 'Medium' })
  assert.ok(medium.length > 0 && medium.length < recipes.length)
  assert.ok(medium.every((recipe) => recipe.difficulty === 'Medium'))
})

test('maximum cooking time includes recipes exactly on each supported boundary', () => {
  for (const limit of [30, 60, 90]) {
    const boundary = { ...recipes[0], cookingTime: limit }
    const over = { ...recipes[1], cookingTime: limit + 1 }
    assert.deepEqual(filterDiscoverRecipes([over, boundary], { maxTime: String(limit) }), [boundary])
  }
})

test('search matches either name or ingredient and combines with all other filters', () => {
  const matching = { ...recipes[0], name: 'Herbed Stew', cookingTime: 60 }
  const wrongCuisine = { ...matching, cuisine: 'Other' }
  const tooSlow = { ...matching, cookingTime: 61 }
  const tooHard = { ...matching, difficulty: 'Hard' }
  const missingIngredient = { ...matching, ingredients: [{ name: 'Garlic' }] }
  const nameOnly = { ...missingIngredient, name: 'Manok Plate' }
  const input = Object.freeze([nameOnly, wrongCuisine, tooSlow, tooHard, missingIngredient, matching])
  const results = filterDiscoverRecipes(input, { query: 'Manok', cuisine: 'Filipino', maxTime: '60', difficulty: 'Easy' })
  assert.deepEqual(results, [matching, nameOnly])
  assert.equal(input[0], nameOnly)
  assert.equal(input.at(-1), matching)
})

test('options derive from the full catalog without duplicate or unsupported values', () => {
  assert.deepEqual(getDiscoverFilterOptions(recipes), {
    cuisines: ['Filipino'],
    difficulties: ['Easy', 'Medium', 'Hard'],
  })
  const copy = [
    { cuisine: 'Vietnamese', difficulty: 'Hard' },
    { cuisine: 'Filipino', difficulty: 'Easy' },
    { cuisine: 'Filipino', difficulty: 'Unknown' },
  ]
  assert.deepEqual(getDiscoverFilterOptions(copy), {
    cuisines: ['Filipino', 'Vietnamese'],
    difficulties: ['Easy', 'Hard'],
  })
})

test('ingredient rows agree with canonical coverage for aliases, duplicates, and unknown ingredients', () => {
  const ingredients = Object.freeze(['Chicken', 'Manok', 'Toyo', 'Water', 'Tubig', 'Local herb'].map((name) =>
    Object.freeze({ name, quantity: 0.33, unit: 'cup' }),
  ))
  const recipe = Object.freeze({ ingredients })
  const pantry = Object.freeze([
    Object.freeze({ name: 'Chicken', isAvailable: false }),
    Object.freeze({ name: 'Manok', isAvailable: true }),
    Object.freeze({ name: 'Soy sauce', isAvailable: false }),
    Object.freeze({ name: ' local   HERB ', isAvailable: true }),
  ])
  const [match] = getRecipeMatches([recipe], pantry)
  assert.equal(match.matchedCount, 2)
  assert.equal(match.trackedCount, 3)
  assert.equal(match.missingIngredients.length, 1)
  assert.deepEqual(getRecipeIngredientStatuses(match), [
    'Available', 'Available', 'Missing', 'Not tracked', 'Not tracked', 'Available',
  ])
  assert.equal(match.recipe, recipe)
  assert.equal(recipe.ingredients[0].quantity, 0.33)
})

test('an empty pantry and a fully stocked pantry give consistent row statuses', () => {
  const recipe = { ingredients: [{ name: 'Eggplant' }, { name: 'Tubig' }, { name: 'Garlic' }] }
  const [empty] = getRecipeMatches([recipe], [])
  assert.equal(empty.matchPercentage, 0)
  assert.deepEqual(getRecipeIngredientStatuses(empty), ['Missing', 'Not tracked', 'Missing'])

  const [full] = getRecipeMatches([recipe], [{ name: 'Talong', isAvailable: true }, { name: 'Bawang', isAvailable: true }])
  assert.equal(full.matchPercentage, 100)
  assert.deepEqual(getRecipeIngredientStatuses(full), ['Available', 'Not tracked', 'Available'])
})

test('water-only recipes have no tracked rows even when water is in the pantry', () => {
  const recipe = { ingredients: [{ name: 'Water' }, { name: ' TUBIG ' }] }
  const [match] = getRecipeMatches([recipe], [{ name: 'Tubig', isAvailable: true }])
  assert.equal(match.trackedCount, 0)
  assert.equal(match.matchPercentage, 0)
  assert.deepEqual(getRecipeIngredientStatuses(match), ['Not tracked', 'Not tracked'])
})
