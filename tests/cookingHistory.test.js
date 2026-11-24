import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  countCookedDishes, createCookingRecord, isValidCookingRecord, loadCookingHistory, recoverCookingRecords,
  remapSessionCookingRecipes, removeCookingRecord, saveCookingHistory, searchCookingHistory,
} from '../src/utils/cookingHistory.js'
import { recipeLimits } from '../src/utils/myDishes.js'

const key = 'lutong-ina-cooking-history'
const timestamp = '2026-11-25T04:00:00.000Z'
const adobo = { id: 'adobo', name: 'Chicken Adobo' }
const first = { id: 'first', recipeId: adobo.id, recipeName: adobo.name, cookedAt: timestamp }

const installStorage = (context, raw = null) => {
  const values = new Map([['unrelated', 'keep']])
  if (raw !== null) values.set(key, raw)
  const storage = {
    getItem: context.mock.fn((requestedKey) => values.get(requestedKey) ?? null),
    setItem: context.mock.fn((requestedKey, value) => values.set(requestedKey, value)),
  }
  context.mock.method(globalThis, 'localStorage', () => storage, { getter: true })
  return { storage, values }
}

test('creates distinct cooking events for the same recipe and timestamp, preserving name snapshots', (context) => {
  context.mock.method(crypto, 'randomUUID', () => 'new-id')
  crypto.randomUUID.mock.mockImplementationOnce(() => first.id)
  const current = [first]
  const renamed = { ...adobo, name: 'Sunday Adobo' }
  assert.deepEqual(createCookingRecord(current, renamed, timestamp), {
    id: 'new-id', recipeId: adobo.id, recipeName: renamed.name, cookedAt: timestamp,
  })
  assert.equal(crypto.randomUUID.mock.callCount(), 2)
  assert.deepEqual(current, [first])
})

test('validates recipe identity, name snapshots, and real UTC calendar timestamps', () => {
  for (const recipe of [null, { ...adobo, id: ' ' }, { ...adobo, name: ' ' },
    { ...adobo, name: 'x'.repeat(recipeLimits.name + 1) }]) {
    assert.equal(createCookingRecord([], recipe, timestamp), null)
  }
  for (const cookedAt of ['today', '2026-02-30T04:00:00Z', '2026-11-25T24:00:00Z', '2026-11-25', '2026-11-25T04:00:00', 1]) {
    assert.equal(isValidCookingRecord({ ...first, cookedAt }), false)
    assert.equal(createCookingRecord([], adobo, cookedAt), null)
  }
  assert.equal(isValidCookingRecord({ ...first, id: '' }), false)
  assert.equal(isValidCookingRecord({ ...first, cookedAt: '2024-02-29T04:00:00Z' }), true)
  assert.equal(isValidCookingRecord({ ...first, cookedAt: '2026-11-25T04:00:00+00:00' }), true)
})

test('sorts newest first, breaks timestamp ties by ID, searches names, and counts IDs across name changes', () => {
  const older = { ...first, id: 'old', cookedAt: '2026-11-24T04:00:00Z' }
  const renamed = { ...first, id: 'earlier-id', recipeName: 'Sunday Adobo' }
  const deleted = { ...first, id: 'deleted', recipeId: 'deleted-recipe', recipeName: 'Old family recipe' }
  const records = [first, older, renamed, deleted]
  assert.deepEqual(searchCookingHistory(records, '  ADOBO  '), [renamed, first, older])
  assert.deepEqual(searchCookingHistory(records, ''), [deleted, renamed, first, older])
  assert.deepEqual(records, [first, older, renamed, deleted])
  assert.equal(countCookedDishes(records), 2)
  assert.equal(countCookedDishes([]), 0)
})

test('removes only the selected event and preserves the original list on a no-op', () => {
  const second = { ...first, id: 'second' }
  const records = [first, second]
  assert.deepEqual(removeCookingRecord(records, first.id), [second])
  assert.equal(removeCookingRecord(records, 'missing'), records)
  assert.deepEqual(records, [first, second])
})

test('loads missing and empty history without writes and persists historical recipes independently', (context) => {
  const { storage, values } = installStorage(context)
  assert.deepEqual(loadCookingHistory(), { records: [], storageStatus: 'ready' })
  values.set(key, '[]')
  assert.deepEqual(loadCookingHistory(), { records: [], storageStatus: 'ready' })
  assert.equal(storage.setItem.mock.callCount(), 0)
  const records = [first, { ...first, id: 'deleted', recipeId: 'no-longer-in-catalog' }]
  assert.equal(saveCookingHistory({ records, storageStatus: 'ready' }), 'ready')
  assert.deepEqual(loadCookingHistory(), { records, storageStatus: 'ready' })
  assert.deepEqual([...values.keys()].sort(), [key, 'unrelated'])
})

test('protects invalid JSON, invalid root data and partial recovery without dropping valid distinct events', (context) => {
  const { storage, values } = installStorage(context)
  const second = { ...first, id: 'second' }
  for (const raw of ['{broken', 'null', '{}']) {
    values.set(key, raw)
    const history = loadCookingHistory()
    assert.deepEqual(history, { records: [], storageStatus: 'invalid' })
    assert.equal(saveCookingHistory(history), 'invalid')
    assert.equal(values.get(key), raw)
  }
  const raw = JSON.stringify([first, { ...first, recipeName: 'Duplicate' }, null, second])
  values.set(key, raw)
  const partial = loadCookingHistory()
  assert.deepEqual(partial, { records: [first, second], storageStatus: 'partial' })
  assert.equal(saveCookingHistory(partial), 'partial')
  assert.equal(values.get(key), raw)
  assert.equal(storage.setItem.mock.callCount(), 0)
  assert.equal(saveCookingHistory({ ...partial, storageStatus: 'ready' }), 'ready')
  assert.deepEqual(loadCookingHistory().records, [first, second])
})

test('recovers a blocked read and remaps colliding record IDs while keeping recipe ownership distinct', (context) => {
  const raw = JSON.stringify([first])
  const { storage, values } = installStorage(context, raw)
  context.mock.method(storage, 'getItem', () => { throw new Error('blocked') })
  const blocked = loadCookingHistory()
  assert.deepEqual(blocked, { records: [], storageStatus: 'read-failed' })
  const session = { ...first, recipeName: 'Session Adobo' }
  const removed = { ...session, id: 'removed' }
  const survivors = removeCookingRecord([session, removed], removed.id)
  assert.equal(saveCookingHistory({ ...blocked, records: survivors }), 'read-failed')
  assert.equal(values.get(key), raw)
  storage.getItem.mock.restore()
  context.mock.method(crypto, 'randomUUID', () => 'new-record-id')
  const recovered = recoverCookingRecords(loadCookingHistory().records, survivors)
  assert.deepEqual(recovered.remappedIds, new Map([[session.id, 'new-record-id']]))
  const records = remapSessionCookingRecipes(
    recovered.records, new Set(recovered.remappedIds.values()), new Map([[adobo.id, { id: 'new-recipe-id' }]]),
  )
  assert.deepEqual(records, [first, { ...session, id: 'new-record-id', recipeId: 'new-recipe-id' }])
  assert.deepEqual(recovered.records, [first, { ...session, id: 'new-record-id' }])
  assert.equal(storage.setItem.mock.callCount(), 0)
})

test('distinguishes write and quota failures and preserves original storage until retry succeeds', (context) => {
  const raw = JSON.stringify([first])
  const { storage, values } = installStorage(context, raw)
  const next = { records: [first, { ...first, id: 'next' }], storageStatus: 'ready' }
  for (const [error, status] of [[new Error('blocked'), 'write-failed'], [new DOMException('Full', 'QuotaExceededError'), 'quota-exceeded']]) {
    context.mock.method(storage, 'setItem', () => { throw error })
    assert.equal(saveCookingHistory(next), status)
    assert.equal(values.get(key), raw)
    storage.setItem.mock.restore()
  }
  assert.equal(saveCookingHistory({ ...next, storageStatus: 'quota-exceeded' }), 'ready')
  assert.deepEqual(loadCookingHistory(), next)
  assert.equal(values.get('unrelated'), 'keep')
})
