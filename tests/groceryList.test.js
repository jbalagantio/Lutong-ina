import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadGroceryList, saveGroceryList } from '../src/utils/groceryList.js'
import { pantryCategories, pantryNameLimit } from '../src/utils/pantry.js'

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
