import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { test } from 'node:test'
import builtInRecipes from '../src/data/recipes.js'
import {
  deletePersonalRecipe,
  filterRecipeCollection,
  getRecipeCollection,
  hasDuplicateRecipeNames,
  loadMyDishes,
  mergeLibraryEntries,
  mergeRecoveredPersonalRecipes,
  preparePersonalRecipe,
  removeLibraryEntry,
  saveBuiltInRecipe,
  saveMyDishes,
  toggleRecipePreference,
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
const libraryEntries = [{ recipeId: 'chicken-adobo', isFavorite: true, isFamiliar: false }]

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

test('reports loaded duplicates, retains both records, and saves after a rename', (context) => {
  const duplicate = { ...example, id: 'second', name: ' CHICKEN\t  ADOBO ' }
  const original = JSON.stringify({ personalRecipes: [example, duplicate], libraryEntries })
  let stored = original
  installStorage(context, {
    getItem: () => stored,
    setItem: (storageKey, value) => {
      assert.equal(storageKey, key)
      stored = value
    },
  })

  const loaded = loadMyDishes()
  assert.equal(loaded.storageStatus, 'duplicate-names')
  assert.deepEqual(loaded.personalRecipes, [example, duplicate])
  assert.equal(saveMyDishes(loaded), 'duplicate-names')
  assert.equal(stored, original)

  const renamed = preparePersonalRecipe({ ...duplicate, name: 'Family Adobo' }, loaded.personalRecipes, duplicate.id)
  assert.equal(renamed.recipe.id, duplicate.id)
  assert.equal(saveMyDishes({ ...loaded, personalRecipes: [example, renamed.recipe] }), 'ready')
  assert.deepEqual(JSON.parse(stored), { personalRecipes: [example, renamed.recipe], libraryEntries })
})

test('recovered duplicates stay protected after deletion until replacement is confirmed', (context) => {
  const duplicate = { ...example, id: 'second', name: 'chicken   adobo' }
  const original = JSON.stringify({ personalRecipes: [example, duplicate, null], libraryEntries })
  let stored = original
  installStorage(context, {
    getItem: () => stored,
    setItem: (storageKey, value) => {
      assert.equal(storageKey, key)
      stored = value
    },
  })

  const recovered = loadMyDishes()
  assert.equal(recovered.storageStatus, 'partial')
  assert.deepEqual(recovered.personalRecipes, [example, duplicate])
  assert.equal(hasDuplicateRecipeNames(recovered.personalRecipes), true)
  const afterDelete = { ...recovered, personalRecipes: [example] }
  assert.equal(saveMyDishes(afterDelete), 'partial')
  assert.equal(stored, original)
  assert.equal(saveMyDishes({ ...afterDelete, storageStatus: 'ready' }), 'ready')
  assert.deepEqual(JSON.parse(stored), { personalRecipes: [example], libraryEntries })
})

test('an editor with a stale recipe reference cannot overwrite a saved ID after recovery', (context) => {
  const reassignedId = webcrypto.randomUUID()
  context.mock.method(globalThis.crypto, 'randomUUID', () => reassignedId)
  const session = { ...example, name: 'Session Adobo' }
  const draft = { ...session, name: 'Updated Session Adobo' }
  const recovered = mergeRecoveredPersonalRecipes([example], [session])

  assert.match(preparePersonalRecipe(draft, recovered, session.id, session).error, /no longer available/)
  const remapped = recovered[1]
  const edited = preparePersonalRecipe(draft, recovered, remapped.id, remapped).recipe
  assert.equal(edited.id, reassignedId)
  assert.equal(edited.name, draft.name)
  assert.deepEqual(recovered[0], example)
})

test('saves catalog recipes by ID once and removes only their library metadata', () => {
  const originalCatalog = structuredClone(builtInRecipes)
  const entries = saveBuiltInRecipe([], 'chicken-adobo')
  assert.deepEqual(entries, [{ recipeId: 'chicken-adobo', isFavorite: false, isFamiliar: false }])
  assert.equal(saveBuiltInRecipe(entries, 'chicken-adobo'), entries)
  assert.equal(saveBuiltInRecipe(entries, example.id), entries)
  assert.deepEqual(removeLibraryEntry(toggleRecipePreference(entries, 'chicken-adobo', 'isFavorite'), 'chicken-adobo'), [])
  assert.deepEqual(builtInRecipes, originalCatalog)
})

test('personal recipes default to unmarked and both preferences toggle independently', () => {
  const unmarked = getRecipeCollection([example], [])
  assert.deepEqual(unmarked, [{ recipe: example, isPersonal: true, isFavorite: false, isFamiliar: false }])
  const favorites = toggleRecipePreference([], example.id, 'isFavorite')
  const familiar = toggleRecipePreference(favorites, example.id, 'isFamiliar')
  assert.deepEqual(favorites, [{ recipeId: example.id, isFavorite: true, isFamiliar: false }])
  assert.deepEqual(familiar, [{ recipeId: example.id, isFavorite: true, isFamiliar: true }])
  assert.deepEqual(toggleRecipePreference(familiar, example.id, 'isFavorite'), [
    { recipeId: example.id, isFavorite: false, isFamiliar: true },
  ])
  assert.deepEqual(toggleRecipePreference(familiar, example.id, 'isFamiliar'), favorites)
})

test('derives both recipe sources and combines name search with every collection filter', () => {
  const entries = [
    ...libraryEntries,
    { recipeId: 'pork-adobo', isFavorite: false, isFamiliar: true },
    { recipeId: example.id, isFavorite: false, isFamiliar: true },
  ]
  const collection = getRecipeCollection([example], entries)
  const ids = (filter, query) => filterRecipeCollection(collection, filter, query).map(({ recipe }) => recipe.id)
  assert.deepEqual(ids('all', 'adobo'), [example.id, 'chicken-adobo', 'pork-adobo'])
  assert.deepEqual(ids('favorites', 'adobo'), ['chicken-adobo'])
  assert.deepEqual(ids('familiar', 'pork'), ['pork-adobo'])
  assert.deepEqual(ids('personal', 'chicken ad'), [example.id])
  assert.deepEqual(ids('saved', 'chicken'), ['chicken-adobo'])
  assert.deepEqual(ids('favorites', 'pork'), [])
  assert.equal(collection[1].recipe, builtInRecipes[0])
})

test('personal deletion cleans up metadata and guards against stale and built-in records', () => {
  const personalEntry = { recipeId: example.id, isFavorite: true, isFamiliar: true }
  const dishes = { personalRecipes: [example], libraryEntries: [...libraryEntries, personalEntry] }
  assert.equal(deletePersonalRecipe(dishes, { ...example }), dishes)
  assert.equal(deletePersonalRecipe(dishes, builtInRecipes[0]), dishes)
  assert.deepEqual(deletePersonalRecipe(dishes, example), { personalRecipes: [], libraryEntries })
  assert.equal(dishes.libraryEntries.length, 2)
})

test('recovers valid preferences, preserves recipes, and protects storage with malformed library entries', (context) => {
  const personalEntry = { recipeId: example.id, isFavorite: false, isFamiliar: true }
  const invalidEntries = [
    null, { recipeId: '' }, { recipeId: ' ' }, { recipeId: 'missing', isFavorite: true, isFamiliar: true },
    { recipeId: example.id, isFavorite: true }, { ...personalEntry, isFamiliar: 'true' },
    { ...libraryEntries[0], isFavorite: false, isFamiliar: true },
  ]
  const raw = JSON.stringify({ personalRecipes: [example], libraryEntries: [...libraryEntries, personalEntry, ...invalidEntries] })
  const setItem = context.mock.fn()
  installStorage(context, { getItem: () => raw, setItem })
  const recovered = loadMyDishes()
  assert.deepEqual(recovered, {
    personalRecipes: [example],
    libraryEntries: [{ ...libraryEntries[0], isFamiliar: true }, personalEntry],
    storageStatus: 'partial',
  })
  assert.equal(saveMyDishes(recovered), 'partial')
  assert.equal(setItem.mock.callCount(), 0)
})

test('recovery keeps saved and remapped personal metadata separate and combines built-in flags', (context) => {
  const replacementId = webcrypto.randomUUID()
  context.mock.method(globalThis.crypto, 'randomUUID', () => replacementId)
  const sessionRecipe = { ...example, name: 'Session Adobo' }
  const personalRecipes = mergeRecoveredPersonalRecipes([example], [sessionRecipe])
  const saved = [...libraryEntries, { recipeId: example.id, isFavorite: false, isFamiliar: true }]
  const session = [
    { recipeId: 'chicken-adobo', isFavorite: false, isFamiliar: true },
    { recipeId: example.id, isFavorite: true, isFamiliar: false },
  ]
  const remapped = new Map([[example.id, personalRecipes[1]]])
  assert.deepEqual(mergeLibraryEntries(saved, session, remapped), [
    { recipeId: 'chicken-adobo', isFavorite: true, isFamiliar: true },
    saved[1],
    { recipeId: replacementId, isFavorite: true, isFamiliar: false },
  ])
  assert.equal(session[1].recipeId, example.id)
})
