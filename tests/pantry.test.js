import assert from 'node:assert/strict'
import { test } from 'node:test'
import recipes from '../src/data/recipes.js'
import {
  getIngredientMatchName,
  loadPantry,
  matchesIngredientSearch,
  normalizeIngredientName,
  savePantry,
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

const pantryKey = 'lutong-ina-pantry'
const savedIngredients = [
  { id: '1', name: ' Water  spinach ', category: 'Vegetables', isAvailable: false },
  { id: '2', name: 'KANGKONG', category: 'Others', isAvailable: true },
]

const installStorage = (context, storage) => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  context.after(() => {
    if (previousStorage) {
      Object.defineProperty(globalThis, 'localStorage', previousStorage)
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })
}

test('loads missing, empty, valid, malformed and non-array data without writing', (context) => {
  const setItem = context.mock.fn()
  const loadCases = [
    [null, [], 'ready'],
    ['[]', [], 'ready'],
    [JSON.stringify(savedIngredients), savedIngredients, 'ready'],
    ['{malformed', [], 'invalid'],
    ['{"ingredients":[]}', [], 'invalid'],
    ['null', [], 'invalid'],
  ]
  let storedValue
  const getItem = context.mock.fn(() => storedValue)
  installStorage(context, { getItem, setItem })

  for (const [rawData, ingredients, storageStatus] of loadCases) {
    storedValue = rawData
    assert.deepEqual(loadPantry(), { ingredients, storageStatus })
  }
  assert.ok(getItem.mock.calls.every((call) => call.arguments[0] === pantryKey))
  assert.equal(setItem.mock.callCount(), 0)
})

test('recovers valid entries with their names and stock statuses and skips duplicate IDs', (context) => {
  const storedValue = JSON.stringify([
    null,
    { ...savedIngredients[0], name: ' ' },
    ...savedIngredients,
    { ...savedIngredients[0], name: 'Changed' },
    { id: '3', name: 'Salt', category: 'Seasonings', isAvailable: 'true' },
  ])
  const setItem = context.mock.fn()
  installStorage(context, { getItem: () => storedValue, setItem })

  assert.deepEqual(loadPantry(), { ingredients: savedIngredients, storageStatus: 'partial' })
  assert.equal(setItem.mock.callCount(), 0)
})

test('blocked reads and invalid or partial data prevent saving until storage is recovered or replacement is acknowledged', (context) => {
  let blocked = true
  const setItem = context.mock.fn()
  const getItem = () => {
    if (blocked) {
      throw new DOMException('Read blocked', 'SecurityError')
    }
    return JSON.stringify(savedIngredients)
  }
  installStorage(context, { getItem, setItem })
  assert.deepEqual(loadPantry(), { ingredients: [], storageStatus: 'read-failed' })

  for (const storageStatus of ['read-failed', 'invalid', 'partial']) {
    assert.equal(savePantry({ ingredients: savedIngredients, storageStatus }), storageStatus)
  }
  assert.equal(setItem.mock.callCount(), 0)
  blocked = false
  assert.deepEqual(loadPantry(), { ingredients: savedIngredients, storageStatus: 'ready' })
  assert.equal(setItem.mock.callCount(), 0)
})

test('reports write and quota failures, retries successfully, and writes only the pantry key', (context) => {
  const original = JSON.stringify(savedIngredients)
  const values = new Map([[pantryKey, original], ['unrelated', 'keep']])
  let writeError = new DOMException('Write blocked', 'SecurityError')
  const setItem = context.mock.fn((key, value) => {
    if (writeError) {
      throw writeError
    }
    values.set(key, value)
  })
  installStorage(context, { setItem })

  const pantry = { ingredients: [], storageStatus: 'ready' }
  const writeFailure = savePantry(pantry)
  assert.equal(writeFailure, 'write-failed')
  assert.equal(values.get(pantryKey), original)
  writeError = new DOMException('Full storage', 'QuotaExceededError')
  const quotaFailure = savePantry({ ...pantry, storageStatus: writeFailure })
  assert.equal(quotaFailure, 'quota-exceeded')
  assert.equal(values.get(pantryKey), original)
  writeError = null
  assert.equal(savePantry({ ...pantry, storageStatus: quotaFailure }), 'ready')
  assert.equal(values.get(pantryKey), '[]')
  assert.equal(values.get('unrelated'), 'keep')
  assert.ok(setItem.mock.calls.every((call) => call.arguments[0] === pantryKey))
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
