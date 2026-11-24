import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { test } from 'node:test'
import builtInRecipes from '../src/data/recipes.js'
import {
  loadMyDishes,
  mergeRecoveredPersonalRecipes,
  preparePersonalRecipe,
  saveMyDishes,
  validatePersonalRecipe,
} from '../src/utils/myDishes.js'

const key = 'lutong-ina-my-dishes'
const example = {
  id: 'personal-1',
  name: 'Chicken Adobo',
  description: '',
  cuisine: 'Filipino',
  cookingTime: 50,
  difficulty: 'Easy',
  servings: 2,
  ingredients: [{ name: 'Soy sauce', quantity: 0.5, unit: 'cup' }],
  instructions: ['Simmer until done.'],
}
const libraryEntries = [{ recipeId: 'chicken-adobo', metadata: { saved: true } }]

const installStorage = (context, storage) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  context.after(() => {
    if (previous) {
      Object.defineProperty(globalThis, 'localStorage', previous)
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })
}

test('normalizes a draft, accepts decimal quantities, and keeps repeated rows in order', () => {
  const draft = {
    ...example, name: ' Chicken Adobo ', description: ' Tangy ', cuisine: ' Filipino ', cookingTime: '50', servings: '2',
    ingredients: [{ name: ' Soy sauce ', quantity: '0.5', unit: ' cup ' }, { name: 'Soy sauce', quantity: '1', unit: 'tbsp' }],
    instructions: [' First step. ', ' Second step. '],
  }
  const original = structuredClone(draft)
  const { recipe } = validatePersonalRecipe(draft)
  assert.deepEqual(recipe, {
    name: 'Chicken Adobo', description: 'Tangy', cuisine: 'Filipino', cookingTime: 50, difficulty: 'Easy', servings: 2,
    ingredients: [{ name: 'Soy sauce', quantity: 0.5, unit: 'cup' }, { name: 'Soy sauce', quantity: 1, unit: 'tbsp' }],
    instructions: ['First step.', 'Second step.'],
  })
  assert.deepEqual(draft, original)
})

test('rejects blank required fields, missing rows, invalid difficulty and numeric values', () => {
  const ingredient = example.ingredients[0]
  const cases = [
    [{ name: '  ' }, /recipe name/], [{ cuisine: '' }, /cuisine/],
    [{ steps: [], instructions: [] }, /instructions/], [{ instructions: ['  '] }, /Step 1/],
    [{ ingredients: [] }, /ingredients/], [{ ingredients: [{ ...ingredient, name: '' }] }, /needs a name/],
    [{ ingredients: [{ ...ingredient, unit: '  ' }] }, /needs a unit/],
    [{ difficulty: 'Unknown' }, /difficulty/],
    [{ cookingTime: '0' }, /cooking time/], [{ cookingTime: '1441' }, /cooking time/],
    [{ cookingTime: '1.5' }, /cooking time/], [{ servings: '101' }, /serving count/],
    [{ servings: '1.5' }, /serving count/], [{ servings: NaN }, /serving count/],
  ]
  for (const quantity of [0, -1, 'Infinity', Infinity, NaN, '0x10', false, '']) {
    cases.push([{ ingredients: [{ ...ingredient, quantity }] }, /quantity/])
  }
  for (const [changes, message] of cases) {
    assert.match(validatePersonalRecipe({ ...example, ...changes }).error, message)
  }
})

test('accepts maximum values and rejects excess fields and row counts', () => {
  const ingredient = { name: 'a'.repeat(80), quantity: 0.01, unit: 'b'.repeat(30) }
  const limits = {
    ...example, name: 'n'.repeat(100), description: 'd'.repeat(500), cuisine: 'c'.repeat(50), cookingTime: 1440, servings: 100,
    ingredients: Array(50).fill(ingredient), instructions: Array(30).fill('s'.repeat(1000)),
  }
  assert.ok(validatePersonalRecipe(limits).recipe)
  for (const changes of [
    { name: 'n'.repeat(101) }, { description: 'd'.repeat(501) }, { cuisine: 'c'.repeat(51) },
    { ingredients: Array(51).fill(ingredient) }, { instructions: Array(31).fill('step') },
    { ingredients: [{ ...ingredient, name: 'a'.repeat(81) }] },
    { ingredients: [{ ...ingredient, unit: 'b'.repeat(31) }] },
    { instructions: ['s'.repeat(1001)] },
  ]) {
    assert.ok(validatePersonalRecipe({ ...limits, ...changes }).error)
  }
})

test('allows built-in names, avoids ID collisions, rejects normalized personal duplicates, and preserves edit IDs', (context) => {
  const occupied = [builtInRecipes[0].id, 'existing-id', webcrypto.randomUUID()]
  context.mock.method(globalThis.crypto, 'randomUUID', () => occupied.shift())
  const existing = { ...example, id: 'existing-id', name: ' Family  Soup ' }
  const created = preparePersonalRecipe(example, [existing]).recipe
  assert.match(created.id, /^[0-9a-f-]{36}$/)
  assert.equal(created.name, builtInRecipes[0].name)
  assert.match(preparePersonalRecipe({ ...example, name: 'family\t soup' }, [existing]).error, /already uses/)
  const edited = preparePersonalRecipe({ ...example, name: 'Family Soup' }, [existing], existing.id).recipe
  assert.equal(edited.id, existing.id)
  assert.equal(existing.name, ' Family  Soup ')
  assert.ok(preparePersonalRecipe(example, [existing], builtInRecipes[0].id).error)
  assert.equal(builtInRecipes[0].name, 'Chicken Adobo')
})

test('loads valid and recoverable entries without writing or discarding library entries', (context) => {
  let stored = null
  const setItem = context.mock.fn()
  installStorage(context, { getItem: (requestedKey) => {
    assert.equal(requestedKey, key)
    return stored
  }, setItem })
  assert.deepEqual(loadMyDishes(), { personalRecipes: [], libraryEntries: [], storageStatus: 'ready' })
  for (const raw of ['{broken', '[]', 'null', '{}']) {
    stored = raw
    assert.equal(loadMyDishes().storageStatus, 'invalid')
  }
  stored = JSON.stringify({ personalRecipes: [example], libraryEntries })
  assert.deepEqual(loadMyDishes(), { personalRecipes: [example], libraryEntries, storageStatus: 'ready' })
  stored = JSON.stringify({
    personalRecipes: [example, example, { ...example, id: builtInRecipes[0].id }, { ...example, id: 'bad', servings: '2' }],
    libraryEntries,
  })
  assert.deepEqual(loadMyDishes(), { personalRecipes: [example], libraryEntries, storageStatus: 'partial' })
  stored = JSON.stringify({ personalRecipes: null, libraryEntries })
  assert.deepEqual(loadMyDishes(), { personalRecipes: [], libraryEntries, storageStatus: 'partial' })
  assert.equal(setItem.mock.callCount(), 0)
})

test('blocks writes to unreadable storage and preserves library entries and unrelated keys when retrying', (context) => {
  const values = new Map([[key, '{broken'], ['unrelated', 'keep']])
  let readFailure = true
  let writeError = null
  const setItem = context.mock.fn((storageKey, value) => {
    if (writeError) {
      throw writeError
    }
    values.set(storageKey, value)
  })
  installStorage(context, {
    getItem: (storageKey) => {
      if (readFailure) {
        throw new DOMException('Blocked', 'SecurityError')
      }
      return values.get(storageKey)
    },
    setItem,
  })
  const recipes = { personalRecipes: [example], libraryEntries }
  assert.equal(loadMyDishes().storageStatus, 'read-failed')
  readFailure = false
  assert.equal(loadMyDishes().storageStatus, 'invalid')
  for (const storageStatus of ['read-failed', 'invalid', 'partial']) {
    assert.equal(saveMyDishes({ ...recipes, storageStatus }), storageStatus)
  }
  assert.equal(setItem.mock.callCount(), 0)
  for (const [failure, expected] of [['SecurityError', 'write-failed'], ['QuotaExceededError', 'quota-exceeded']]) {
    writeError = new DOMException('Storage failure', failure)
    assert.equal(saveMyDishes(recipes), expected)
    assert.equal(values.get(key), '{broken')
  }
  writeError = null
  assert.equal(saveMyDishes({ ...recipes, storageStatus: 'quota-exceeded' }), 'ready')
  assert.deepEqual(JSON.parse(values.get(key)), recipes)
  assert.equal(values.get('unrelated'), 'keep')
  assert.ok(setItem.mock.calls.every((call) => call.arguments[0] === key))
})

test('keeps recovered and session recipes, assigning a new session ID only on a collision', (context) => {
  const id = webcrypto.randomUUID()
  context.mock.method(globalThis.crypto, 'randomUUID', () => id)
  const sessionRecipe = { ...example, name: 'Session adobo' }
  const recovered = mergeRecoveredPersonalRecipes([example], [sessionRecipe])
  assert.deepEqual(recovered, [example, { ...sessionRecipe, id }])
  assert.equal(sessionRecipe.id, example.id)
  assert.equal(saveMyDishes({
    personalRecipes: [example, { ...example, id }], libraryEntries, storageStatus: 'ready',
  }), 'duplicate-names')
})
