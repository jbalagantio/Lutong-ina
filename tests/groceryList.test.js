import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addMissingGroceryItems, filterGroceryItems, loadGroceryList, planGroceryAddition, prepareGroceryItem,
  recoverGroceryItems, removeGroceryItem, resolveGroceryCategory, saveGroceryList,
} from '../src/utils/groceryList.js'
import { pantryCategories, pantryNameLimit } from '../src/utils/pantry.js'
import { getRecipeMatches } from '../src/utils/recommendations.js'
import recipes from '../src/data/recipes.js'

const key = 'lutong-ina-grocery-list'
const garlic = { id: 'garlic', name: '  Garlic  ', category: pantryCategories[0], isPurchased: false }
const bawang = { ...garlic, id: 'bawang', name: 'Bawang', isPurchased: true }

const installStorage = (context, raw) => {
  const values = new Map([['unrelated', 'keep']])
  if (raw !== null) values.set(key, raw)
  const storage = {
    getItem: context.mock.fn((requestedKey) => values.get(requestedKey) ?? null),
    setItem: context.mock.fn((requestedKey, value) => values.set(requestedKey, value)),
  }
  context.mock.method(globalThis, 'localStorage', () => storage, { getter: true })
  return { storage, values }
}

test('missing and saved empty lists load empty without writing', (context) => {
  const { storage, values } = installStorage(context, null)
  assert.deepEqual(loadGroceryList(), { items: [], storageStatus: 'ready' })
  assert.equal(values.has(key), false)
  values.set(key, '[]')
  assert.deepEqual(loadGroceryList(), { items: [], storageStatus: 'ready' })
  assert.equal(storage.setItem.mock.callCount(), 0)
})

test('loads purchased and unpurchased records, preserving original names and alias equivalents', (context) => {
  const { storage } = installStorage(context, JSON.stringify([garlic, bawang]))
  assert.deepEqual(loadGroceryList(), { items: [garlic, bawang], storageStatus: 'ready' })
  assert.equal(storage.setItem.mock.callCount(), 0)
})

test('malformed JSON and invalid top-level data are protected', (context) => {
  const { storage, values } = installStorage(context, null)
  for (const raw of ['{broken', '{}', 'null', '"groceries"', '42']) {
    values.set(key, raw)
    assert.deepEqual(loadGroceryList(), { items: [], storageStatus: 'invalid' })
    assert.equal(saveGroceryList({ items: [], storageStatus: 'invalid' }), 'invalid')
    assert.equal(values.get(key), raw)
  }
  assert.equal(storage.setItem.mock.callCount(), 0)
})

test('partial recovery keeps valid entries and the first valid record for a duplicate ID', (context) => {
  const raw = JSON.stringify([
    null, { ...garlic, id: ' ' }, { ...garlic, id: 3 }, { ...garlic, name: '' },
    { ...garlic, name: 'x'.repeat(pantryNameLimit + 1) },
    { ...garlic, category: 'Invalid' }, { ...garlic, isPurchased: 'false' },
    garlic, { ...garlic, name: 'Later record' }, bawang,
  ])
  const { storage, values } = installStorage(context, raw)
  const recovered = loadGroceryList()
  assert.deepEqual(recovered, { items: [garlic, bawang], storageStatus: 'partial' })
  assert.equal(saveGroceryList(recovered), 'partial')
  assert.equal(values.get(key), raw)
  assert.equal(storage.setItem.mock.callCount(), 0)
  assert.equal(saveGroceryList({ ...recovered, storageStatus: 'ready' }), 'ready')
  assert.deepEqual(JSON.parse(values.get(key)), [garlic, bawang])
  assert.equal(values.get('unrelated'), 'keep')
})

test('read failures protect data and a later successful load leaves storage untouched', (context) => {
  const raw = JSON.stringify([garlic])
  const { storage, values } = installStorage(context, raw)
  context.mock.method(storage, 'getItem', () => { throw new Error('Blocked') })
  const failed = loadGroceryList()
  assert.deepEqual(failed, { items: [], storageStatus: 'read-failed' })
  assert.equal(saveGroceryList(failed), 'read-failed')
  storage.getItem.mock.restore()
  assert.deepEqual(loadGroceryList(), { items: [garlic], storageStatus: 'ready' })
  assert.equal(values.get(key), raw)
  assert.equal(storage.setItem.mock.callCount(), 0)
})

test('write and quota failures leave prior data intact and a retry writes only the grocery key', (context) => {
  const raw = JSON.stringify([garlic])
  const { storage, values } = installStorage(context, raw)
  const draft = { items: [bawang], storageStatus: 'ready' }
  for (const [error, status] of [
    [new Error('Blocked'), 'write-failed'],
    [new DOMException('Full', 'QuotaExceededError'), 'quota-exceeded'],
  ]) {
    context.mock.method(storage, 'setItem', () => { throw error })
    assert.equal(saveGroceryList(draft), status)
    assert.equal(values.get(key), raw)
    storage.setItem.mock.restore()
  }
  assert.equal(saveGroceryList({ ...draft, storageStatus: 'quota-exceeded' }), 'ready')
  assert.deepEqual(JSON.parse(values.get(key)), [bawang])
  assert.deepEqual([...values.keys()].sort(), [key, 'unrelated'])
})

test('creates trimmed grocery items with unique IDs, accepting names outside the alias dictionary', (context) => {
  const generatedId = '00000000-0000-4000-8000-000000000001'
  context.mock.method(crypto, 'randomUUID', () => generatedId)
  crypto.randomUUID.mock.mockImplementationOnce(() => garlic.id)
  const original = [garlic]
  const values = { name: '  Black garlic jam  ', category: garlic.category, isPurchased: true }
  const { item, items } = prepareGroceryItem(original, values)
  assert.deepEqual(item, { id: generatedId, name: 'Black garlic jam', category: garlic.category, isPurchased: false })
  assert.deepEqual(items, [garlic, item])
  assert.deepEqual(original, [garlic])
  assert.equal(crypto.randomUUID.mock.callCount(), 2)
})

test('validates name type, whitespace, length and category before a grocery mutation', () => {
  for (const name of [null, 12, '', ' \t ', 'x'.repeat(pantryNameLimit + 1)]) {
    assert.equal(prepareGroceryItem([], { name, category: garlic.category }).field, 'name')
  }
  const name = 'x'.repeat(pantryNameLimit)
  assert.equal(prepareGroceryItem([], { name: ` ${name} `, category: garlic.category }).item.name, name)
  assert.equal(prepareGroceryItem([], { name, category: 'Invalid' }).field, 'category')
})

test('prevents new alias duplicates but preserves existing alias groups, purchase state and order during edits', () => {
  const other = { ...garlic, id: 'chicken', name: 'Chicken' }
  const original = [garlic, bawang, other]
  for (const name of [' BAWANG ', 'Manok']) {
    assert.equal(prepareGroceryItem(original, { ...garlic, name }).field, 'name')
  }
  const { items, item } = prepareGroceryItem(original, { ...bawang, name: ' Garlic ', isPurchased: false }, bawang.id)
  assert.deepEqual(item, { ...bawang, name: 'Garlic' })
  assert.deepEqual(items, [garlic, item, other])
  assert.equal(prepareGroceryItem(original, { ...bawang, name: 'Manok' }, bawang.id).field, 'name')
})

test('stale IDs cannot edit or remove items, and removing a valid ID leaves other entries untouched', () => {
  const original = [garlic, bawang]
  for (const id of ['unknown', '', 1]) {
    assert.match(prepareGroceryItem(original, garlic, id).error, /no longer available/)
    assert.equal(removeGroceryItem(original, id), original)
  }
  assert.equal(removeGroceryItem(original, null), original)
  assert.deepEqual(removeGroceryItem(original, garlic.id), [bawang])
  assert.deepEqual(original, [garlic, bawang])
})

test('search combines literal, normalized names and partial aliases with category filtering', () => {
  const soy = { ...garlic, id: 'soy', name: 'Toyo', category: 'Seasonings' }
  const pepper = { ...garlic, id: 'pepper', name: 'Pepper (ground)' }
  const items = [garlic, bawang, soy, pepper]
  assert.deepEqual(filterGroceryItems(items, '  BAW  ', ''), [garlic, bawang])
  assert.deepEqual(filterGroceryItems(items, '  SOY   sau ', 'Seasonings'), [soy])
  assert.deepEqual(filterGroceryItems(items, 'toyo', garlic.category), [])
  assert.deepEqual(filterGroceryItems(items, '(ground)', garlic.category), [pepper])
  assert.deepEqual(filterGroceryItems(items, '.*', ''), [])
})

test('recovery keeps saved aliases and edited session items, remaps collisions, and excludes removed session items', (context) => {
  let session = prepareGroceryItem([], { ...garlic, name: 'Bawang' }).items
  const id = session[0].id
  session = prepareGroceryItem(session, { ...garlic, name: 'Garlic' }, id).items
  const added = prepareGroceryItem(session, { ...garlic, name: 'Manok' })
  session = removeGroceryItem(added.items, added.item.id)
  const saved = [{ ...bawang, id }]
  const remappedId = '00000000-0000-4000-8000-000000000002'
  context.mock.method(crypto, 'randomUUID', () => remappedId)
  const result = recoverGroceryItems(saved, session)
  assert.deepEqual(result.items, [saved[0], { ...session[0], id: remappedId }])
  assert.deepEqual(result.remappedIds, new Map([[id, remappedId]]))
  assert.deepEqual(recoverGroceryItems(saved, []).items, saved)
})

test('repeated read failures retain session data and invalid or partial recovery requires replacement', (context) => {
  const { storage, values } = installStorage(context, '{invalid')
  const session = prepareGroceryItem([], { ...garlic, name: 'Manok' }).items
  context.mock.method(storage, 'getItem', () => { throw new Error('Blocked') })
  for (let retry = 0; retry < 2; retry += 1) {
    const { storageStatus } = loadGroceryList()
    assert.equal(saveGroceryList({ items: session, storageStatus }), 'read-failed')
  }
  storage.getItem.mock.restore()
  for (const [raw, expected] of [['{invalid', 'invalid'], [JSON.stringify([bawang, null]), 'partial']]) {
    values.set(key, raw)
    const recovered = loadGroceryList()
    const { items } = recoverGroceryItems(recovered.items, session)
    assert.deepEqual(items, [...recovered.items, ...session])
    assert.equal(saveGroceryList({ items, storageStatus: recovered.storageStatus }), expected)
    assert.equal(values.get(key), raw)
  }
  assert.equal(storage.setItem.mock.callCount(), 0)
  assert.equal(values.get('unrelated'), 'keep')
})

const ingredient = (name) => ({ name })

test('recipe matching supplies unique missing ingredients, with out-of-stock items and unknown personal names', () => {
  const recipe = {
    ingredients: ['Manok', 'Chicken', 'Bawang', 'Garlic', 'Tubig', 'Water', 'Lemon jam', 'Talong'].map(ingredient),
  }
  const pantry = [
    { name: 'Chicken', category: 'Meat', isAvailable: true },
    { name: 'Garlic', category: 'Seasonings', isAvailable: false },
  ]
  const originalRecipe = structuredClone(recipe)
  const originalPantry = structuredClone(pantry)
  const [match] = getRecipeMatches([recipe], pantry)
  const result = addMissingGroceryItems([], match.missingIngredients, pantry)
  assert.deepEqual(result.added.map(({ name, category, isPurchased }) => [name, category, isPurchased]), [
    ['Bawang', 'Seasonings', false], ['Lemon jam', 'Others', false], ['Talong', 'Vegetables', false],
  ])
  assert.equal(new Set(result.added.map((item) => item.id)).size, 3)
  assert.deepEqual(recipe, originalRecipe)
  assert.deepEqual(pantry, originalPantry)
  const [waterOnly] = getRecipeMatches([{ ingredients: ['Water', 'Tubig'].map(ingredient) }], pantry)
  assert.equal(waterOnly.trackedCount, 0)
  assert.equal(addMissingGroceryItems(result.items, waterOnly.missingIngredients, pantry).items, result.items)
})

test('bulk planning skips purchased, unpurchased, repeated, invalid and untracked entries without editing legacy rows', () => {
  const chicken = { ...garlic, id: 'chicken', name: 'Chicken' }
  const items = [garlic, bawang, chicken]
  const missing = [
    ...['Garlic', 'Bawang', 'Manok', 'Toyo', 'Soy sauce', 'Tubig', ' ', 'x'.repeat(pantryNameLimit + 1)].map(ingredient),
    null, { name: 4 },
  ]
  const original = structuredClone(missing)
  const preview = planGroceryAddition(items, missing)
  assert.deepEqual(preview.names, ['Toyo'])
  assert.deepEqual(preview.alreadyListed, ['Garlic', 'Manok'])
  assert.equal(preview.skipped.length, 7)
  const result = addMissingGroceryItems(items, missing, [])
  assert.deepEqual(result.added.map((item) => item.name), preview.names)
  assert.deepEqual(result.items, [...items, ...result.added])
  assert.deepEqual(items, [garlic, bawang, chicken])
  assert.deepEqual(missing, original)
  const repeated = addMissingGroceryItems(result.items, missing, [])
  assert.deepEqual(repeated.added, [])
  assert.equal(repeated.items, result.items)
  assert.deepEqual(repeated.alreadyListed, ['Garlic', 'Manok', 'Toyo'])
})

test('category resolution uses the first valid pantry match, falls back to catalog categories and covers all tracked built-ins', () => {
  const pantry = [
    { name: 'Garlic', category: 'Invalid' },
    { name: 'Bawang', category: 'Seasonings', isAvailable: false },
    { name: 'Garlic', category: 'Vegetables', isAvailable: true },
  ]
  assert.equal(resolveGroceryCategory('Garlic', pantry), 'Seasonings')
  assert.equal(resolveGroceryCategory('Itlog', []), 'Dairy and Eggs')
  assert.equal(resolveGroceryCategory('Ginger jelly', []), 'Others')
  for (const { missingIngredients } of getRecipeMatches(recipes, [])) {
    for (const { name } of missingIngredients) {
      const category = resolveGroceryCategory(name, [])
      assert.ok(pantryCategories.includes(category) && category !== 'Others', name)
    }
  }
})

test('bulk additions survive a blocked read and preserve protected storage and unrelated data', (context) => {
  const { storage, values } = installStorage(context, null)
  context.mock.method(storage, 'getItem', () => { throw new Error('Blocked') })
  const blocked = loadGroceryList()
  const bulk = addMissingGroceryItems(blocked.items, ['Toyo', 'Egg'].map(ingredient), [])
  assert.equal(saveGroceryList({ ...blocked, items: bulk.items }), 'read-failed')
  storage.getItem.mock.restore()
  for (const [raw, status] of [['{broken', 'invalid'], [JSON.stringify([bawang, null]), 'partial']]) {
    values.set(key, raw)
    const recovered = loadGroceryList()
    const { items } = recoverGroceryItems(recovered.items, bulk.items)
    assert.deepEqual(items, [...recovered.items, ...bulk.added])
    assert.equal(saveGroceryList({ ...recovered, items }), status)
    assert.equal(values.get(key), raw)
  }
  assert.equal(storage.setItem.mock.callCount(), 0)
  assert.equal(values.get('unrelated'), 'keep')
})
