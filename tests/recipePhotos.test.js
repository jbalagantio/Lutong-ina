import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { test } from 'node:test'
import recipes from '../src/data/recipes.js'
import { recipeImages } from '../src/data/recipeImages.js'
import { mergeRecoveredPersonalRecipes } from '../src/utils/myDishes.js'
import { getOrphanedPhotoIds, getPhotoFileError, getPhotoType, getUnusedPhotoIds, photoSizeLimit } from '../src/utils/recipePhotos.js'

test('external photos have HTTPS sources and credits and remain optional', () => {
  const recipeIds = new Set(recipes.map((recipe) => recipe.id))
  for (const [id, image] of Object.entries(recipeImages)) {
    assert.ok(recipeIds.has(id), id)
    for (const link of [image.url, image.sourceUrl, image.licenseUrl]) {
      assert.equal(new URL(link).protocol, 'https:')
    }
    assert.ok(image.alt && image.creator && image.title && image.license)
  }
  assert.equal(recipeImages['personal-without-a-photo'], undefined)
})

test('photo validation uses image bytes and enforces the upload size limit', () => {
  assert.equal(getPhotoType([255, 216, 255]), 'image/jpeg')
  assert.equal(getPhotoType([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png')
  assert.equal(getPhotoType([...Buffer.from('RIFF0000WEBP')]), 'image/webp')
  assert.equal(getPhotoType([...Buffer.from('GIF89a')]), '')
  assert.equal(getPhotoType([...Buffer.from('<svg>')]), '')
  assert.ok(getPhotoFileError({ size: 0 }))
  assert.ok(getPhotoFileError({ size: photoSizeLimit + 1 }))
  assert.equal(getPhotoFileError({ size: photoSizeLimit }), '')
})

test('photo replacement, removal and deletion retire only unreferenced keys', () => {
  const queued = new Set(['superseded-photo', 'removed-photo', 'deleted-photo', 'shared-photo'])
  const currentRecipes = [
    { id: 'replaced', photoId: 'new-photo' },
    { id: 'removed' },
    { id: 'still-using-old-photo', photoId: 'shared-photo' },
  ]
  assert.deepEqual(getUnusedPhotoIds(queued, currentRecipes), ['superseded-photo', 'removed-photo', 'deleted-photo'])
})

test('recipe ID recovery keeps each photo associated with its own recipe', () => {
  const saved = { id: 'collision', photoId: 'saved-photo' }
  const session = { id: 'collision', photoId: 'session-photo' }
  const [recovered, remapped] = mergeRecoveredPersonalRecipes([saved], [session])
  assert.equal(recovered, saved)
  assert.notEqual(remapped.id, recovered.id)
  assert.equal(remapped.photoId, session.photoId)
  assert.deepEqual(getUnusedPhotoIds(new Set([saved.photoId, session.photoId]), [recovered, remapped]), [])
})

test('photo reconciliation retains references from both saved and active recipes', () => {
  const saved = { storageStatus: 'ready', personalRecipes: [{ photoId: 'saved-only' }] }
  const active = { storageStatus: 'ready', personalRecipes: [{ photoId: 'session-only' }] }
  const keys = ['saved-only', 'session-only', 'orphan', 123]
  assert.deepEqual(getOrphanedPhotoIds(keys, saved, active), ['orphan'])
})

test('photo reconciliation requires ready storage and a saved snapshot', () => {
  const ready = { storageStatus: 'ready', personalRecipes: [] }
  const keys = ['photo']
  assert.deepEqual(getOrphanedPhotoIds(keys, null, ready), [])
  assert.deepEqual(getOrphanedPhotoIds(keys, ready, null), [])
  for (const storageStatus of ['read-failed', 'invalid', 'partial', 'duplicate-names', 'write-failed', 'quota-exceeded']) {
    const protectedDishes = { ...ready, storageStatus }
    assert.deepEqual(getOrphanedPhotoIds(keys, protectedDishes, ready), [])
    assert.deepEqual(getOrphanedPhotoIds(keys, ready, protectedDishes), [])
  }
  assert.deepEqual(getOrphanedPhotoIds(keys, ready, ready), ['photo'])
})
