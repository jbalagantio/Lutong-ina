import assert from 'node:assert/strict'
import { test } from 'node:test'
import recipes from '../src/data/recipes.js'
import {
  getIngredientMatchName,
  loadPantry,
  matchesIngredientSearch,
  normalizeIngredientName,
  wouldDuplicateIngredient,
} from '../src/utils/pantry.js'

const expectedAliases = [
  ['bay leaf', ['bay leaves', 'dahon ng laurel']],
  ['bitter melon', ['ampalaya', 'bitter gourd']],
  ['black peppercorns', ['black peppercorn', 'whole black peppercorns']],
  ['cabbage', ['repolyo', 'cabbages']],
  ['calamansi juice', ['kalamansi juice', 'calamondin juice']],
  ['cane vinegar', ['sukang tubo', 'sugarcane vinegar']],
  ['carrot', ['carrots', 'karot']],
  ['chicken', ['manok']],
  ['coconut milk', ['gata']],
  ['cooked rice', ['kanin']],
  ['cooking oil', ['mantika']],
  ['egg', ['eggs', 'itlog']],
  ['eggplant', ['talong', 'eggplants', 'aubergine', 'aubergines']],
  ['fish sauce', ['patis']],
  ['garlic', ['bawang']],
  ['ginger', ['luya']],
  ['green papaya', ['papayang hilaw', 'unripe papaya']],
  ['long beans', ['sitaw', 'sitao', 'yardlong bean', 'yardlong beans', 'long bean']],
  ['moringa leaves', ['malunggay', 'moringa leaf']],
  ['mung beans', ['monggo', 'munggo', 'mung bean', 'mungbean', 'mungbeans']],
  ['pechay', ['petsay', 'bok choy', 'pak choi']],
  ['pork belly', ['liempo']],
  ['pork liver', ['atay ng baboy']],
  ['pork ribs', ['tadyang ng baboy', 'pork rib']],
  ['pork shoulder', ['kasim']],
  ['potato', ['potatoes', 'patatas']],
  ['radish', ['labanos', 'radishes']],
  ['red bell pepper', ['red bell peppers']],
  ['red onion', ['sibuyas na pula', 'red onions']],
  ['salt', ['asin']],
  ['soy sauce', ['toyo']],
  ['squash', ['kalabasa']],
  ['tomato', ['kamatis', 'tomatoes']],
  ['water', ['tubig']],
  ['water spinach', ['kangkong']],
  ['yellow onion', ['yellow onions']],
]

test('every catalog name is canonical and every explicit alias resolves directly to it', () => {
  const catalogNames = new Set(recipes.flatMap((recipe) =>
    recipe.ingredients.map((ingredient) => normalizeIngredientName(ingredient.name)),
  ))
  assert.equal(recipes.length, 15)
  assert.equal(catalogNames.size, 42)

  for (const name of catalogNames) {
    assert.equal(getIngredientMatchName(name), name)
  }
  for (const [canonicalName, aliases] of expectedAliases) {
    assert.ok(catalogNames.has(canonicalName))
    for (const alias of aliases) {
      const matchName = getIngredientMatchName(alias)
      assert.equal(matchName, canonicalName, alias)
      assert.equal(getIngredientMatchName(matchName), matchName)
    }
  }
})

test('normalizes whitespace and case without changing punctuation, accents or unknown plurals', () => {
  const normalized = normalizeIngredientName(' \t KāFFIR-LEAVES\n  (DRIED) ')
  assert.equal(normalized, 'kāffir-leaves (dried)')
  assert.equal(normalizeIngredientName(normalized), normalized)
  assert.equal(getIngredientMatchName(normalized), normalized)
  assert.equal(getIngredientMatchName(' \t KALAMANSI\n   JUICE '), 'calamansi juice')
  assert.throws(() => getIngredientMatchName(null), TypeError)
  assert.throws(() => getIngredientMatchName(42), TypeError)
})

test('only rejects creation or editing that introduces a duplicate', () => {
  const chicken = { id: '1', name: 'Chicken', isAvailable: false }
  const manok = { id: '2', name: 'Manok', isAvailable: true }
  const carrot = { id: '3', name: 'Carrot', isAvailable: true }
  const ingredients = [chicken, manok, carrot]

  assert.equal(wouldDuplicateIngredient(' manok ', ingredients), true)
  assert.equal(wouldDuplicateIngredient('manok', ingredients, carrot), true)
  assert.equal(wouldDuplicateIngredient('Carrots', ingredients, carrot), false)
  assert.equal(wouldDuplicateIngredient('Manok', ingredients, manok), false)
  assert.equal(wouldDuplicateIngredient('MANOK', ingredients, chicken), false)
  assert.equal(wouldDuplicateIngredient('unlisted spice', ingredients), false)
})

test('loading preserves legacy aliases, display names, and each availability status', (context) => {
  const ingredients = [
    { id: '1', name: ' Water  spinach ', category: 'Vegetables', isAvailable: false },
    { id: '2', name: 'KANGKONG', category: 'Others', isAvailable: true },
  ]
  const storage = {
    getItem: context.mock.fn(() => JSON.stringify(ingredients)),
    setItem: context.mock.fn(),
  }
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  context.after(() => {
    if (previousStorage) {
      Object.defineProperty(globalThis, 'localStorage', previousStorage)
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })
  const result = loadPantry()
  assert.deepEqual(result.ingredients, ingredients)
  assert.equal(result.loadWarning, '')
  assert.equal(storage.setItem.mock.callCount(), 0)
})

test('search finds saved, canonical and alias substrings in both directions', () => {
  const positives = [
    ['Water spinach', 'Kangkong'],
    ['KANGKONG', '  Water\t spinach '],
    ['Chicken', 'Manok'],
    ['Manok', 'Chicken'],
    ['Water spinach', 'kang'],
    ['Water spinach', 'spin'],
    ['Pechay', 'choi'],
    ['Kāffir-leaves', 'leaves'],
    ['Kāffir-leaves', ''],
  ]
  for (const [name, query] of positives) {
    assert.equal(matchesIngredientSearch(name, normalizeIngredientName(query)), true)
  }
  assert.equal(matchesIngredientSearch('Pork shoulder', 'liempo'), false)
  assert.equal(matchesIngredientSearch('Red onion', 'yellow'), false)
})
