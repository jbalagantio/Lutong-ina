import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { test } from 'node:test'
import { getDaysSinceCooking, getLatestCookingTimes, remapSessionCookingRecipes } from '../src/utils/cookingHistory.js'
import {
  addCookingRecency, advanceRecommendationSession, rankPantryRecommendations, reconcileRecipeIds,
  refreshRecommendationRound, selectCookingMode,
} from '../src/utils/recommendations.js'

const reference = new Date(2026, 0, 3, 12)
const meal = (id, recipeId, days, recipeName = 'Same name') => ({
  id, recipeId, recipeName, cookedAt: new Date(2026, 0, 3 - days, 8).toISOString(),
})
const match = (id, matchPercentage = 100, missingCount = 0, cookingTime = 20, name = id) => ({
  recipe: { id, name, cookingTime },
  matchPercentage,
  matchedCount: matchPercentage > 0 ? 1 : 0,
  missingIngredients: Array(missingCount).fill({ name: 'Garlic' }),
})
const newSession = () => ({ mode: null, rounds: {} })
const withHistory = (matches, records) => addCookingRecency(matches, records, reference)

test('finds the latest valid event per exact recipe ID from unsorted history and keeps deleted recipes independent', () => {
  const latest = meal('1', 'first', 1, 'Renamed dish')
  const older = meal('2', 'first', 8)
  const another = meal('3', 'second', 3)
  const deleted = meal('4', 'deleted', 5)
  const records = [latest, older, another, deleted, { ...meal('5', 'first', 0), cookedAt: 'invalid' }, null]
  const original = structuredClone(records)
  assert.deepEqual(getLatestCookingTimes([]), new Map())
  assert.deepEqual(getLatestCookingTimes(records), new Map([
    ['first', Date.parse(latest.cookedAt)], ['second', Date.parse(another.cookedAt)], ['deleted', Date.parse(deleted.cookedAt)],
  ]))
  assert.deepEqual(records, original)
  assert.equal(withHistory([match('first')], records)[0].daysSinceCooked, 1)
  assert.equal(withHistory([match('first')], records.slice(1))[0].daysSinceCooked, 8)
})

test('uses local calendar dates around midnight and across month and year boundaries', () => {
  const midnight = new Date(2026, 0, 1, 0, 1)
  const previousDay = new Date(2025, 11, 31, 23, 59)
  assert.equal(getDaysSinceCooking(previousDay.getTime(), midnight), 1)
  assert.equal(getDaysSinceCooking(undefined, midnight), null)
  assert.equal(getDaysSinceCooking(new Date(2026, 0, 2, 0).getTime(), midnight), 0)
  for (const days of [0, 1, 2, 3, 6, 7, 22]) {
    assert.equal(withHistory([match('dish')], [meal('1', 'dish', days)])[0].daysSinceCooked, days)
  }
  const [future] = withHistory([match('dish')], [meal('1', 'dish', -1)])
  assert.equal(future.daysSinceCooked, 0)
  assert.equal(future.cookedInFuture, true)
})

test('counts a local daylight-saving boundary as one calendar day', () => {
  const moduleUrl = new URL('../src/utils/cookingHistory.js', import.meta.url).href
  const script = `
    import { getDaysSinceCooking } from ${JSON.stringify(moduleUrl)}
    const cooked = new Date('2026-03-08T05:30:00Z')
    const nextDay = new Date('2026-03-09T04:30:00Z')
    console.log(JSON.stringify([cooked.getDate(), nextDay.getDate(), getDaysSinceCooking(cooked.getTime(), nextDay)]))
  `
  const output = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
    env: { ...process.env, TZ: 'America/New_York' },
    encoding: 'utf8',
  })
  assert.deepEqual(JSON.parse(output), [8, 9, 1])
})

test('pantry keeps coverage and missing count ahead of history, then uses time and name to resolve ties', () => {
  const matches = [
    match('unmatched', 0), match('weaker', 74.9, 1), match('more-missing', 75, 2),
    match('recent', 75, 1, 5), match('older-b', 75, 1, 20, 'Beta'), match('older-a', 75, 1, 20, 'Alpha'),
    match('older-slow', 75, 1, 30),
  ]
  const records = [meal('1', 'recent', 0), ...['older-a', 'older-b', 'older-slow'].map((id) => meal(id, id, 7))]
  assert.deepEqual(rankPantryRecommendations(withHistory(matches, records)).map(({ recipe }) => recipe.id),
    ['older-a', 'older-b', 'older-slow', 'recent', 'more-missing', 'weaker'])
  assert.deepEqual(rankPantryRecommendations(withHistory(matches, [])), rankPantryRecommendations(matches).map((item) => ({
    ...item, daysSinceCooked: null, cookedInFuture: false,
  })))
  const selected = selectCookingMode(newSession(), 'pantry', withHistory(matches, records), 0.99)
  assert.equal(selected.rounds.pantry.currentId, 'older-a')
})

test('shopping randomly selects within the best unseen group and eventually reaches all recent recipes', () => {
  const matches = ['today', 'yesterday', 'two', 'three', 'six', 'seven', 'future', 'new-a', 'new-b'].map((id) => match(id))
  const records = [
    meal('1', 'today', 0), meal('2', 'yesterday', 1), meal('3', 'two', 2), meal('4', 'three', 3),
    meal('5', 'six', 6), meal('6', 'seven', 7), meal('7', 'future', -1),
  ]
  const candidates = withHistory(matches, records)
  let session = selectCookingMode(newSession(), 'shopping', candidates, 0.99)
  for (let draw = 1; draw < matches.length; draw += 1) {
    session = advanceRecommendationSession(session, candidates, 0, false)
  }
  assert.deepEqual(session.rounds.shopping.suggestedIds,
    ['new-b', 'new-a', 'seven', 'three', 'six', 'yesterday', 'two', 'today', 'future'])
  const emptyHistory = selectCookingMode(newSession(), 'shopping', withHistory(matches, []), 0.99)
  assert.equal(emptyHistory.rounds.shopping.currentId, 'new-b')
})

test('Something new applies recency inside the unfamiliar pool and inside the full familiar fallback', () => {
  const matches = ['familiar', 'cooked', 'unrecorded'].map((id) => match(id))
  const candidates = withHistory(matches, [meal('1', 'cooked', 0)])
  const library = [{ recipeId: 'familiar', isFamiliar: true }]
  const selected = selectCookingMode(newSession(), 'new', candidates, 0, library)
  assert.equal(selected.rounds.new.currentId, 'unrecorded')
  const next = advanceRecommendationSession(selected, candidates, 0, false, library)
  assert.equal(next.rounds.new.currentId, 'cooked')
  assert.deepEqual(library, [{ recipeId: 'familiar', isFamiliar: true }])
  const allFamiliar = matches.map(({ recipe }) => ({ recipeId: recipe.id, isFamiliar: true }))
  assert.equal(selectCookingMode(newSession(), 'new', candidates, 0, allFamiliar).rounds.new.currentId, 'familiar')
})

test('history updates preserve rounds, exclude earlier suggestions, and guide later draws after recipe remapping', () => {
  const matches = ['a', 'b', 'c'].map((id) => match(id))
  const initial = selectCookingMode(newSession(), 'shopping', withHistory(matches, []), 0)
  const records = [meal('1', 'a', 0), meal('2', 'b', 0)]
  const refreshed = refreshRecommendationRound(initial, 'shopping', withHistory(matches, records), 0)
  assert.equal(refreshed, initial)
  const next = advanceRecommendationSession(refreshed, withHistory(matches, records), 0, false)
  assert.deepEqual(next.rounds.shopping.suggestedIds, ['a', 'c'])
  const replacement = match('remapped')
  const remaps = new Map([['a', replacement.recipe]])
  const catalog = [replacement, ...matches.slice(1)]
  const rebased = reconcileRecipeIds(next, catalog.map(({ recipe }) => recipe), remaps)
  const remappedHistory = remapSessionCookingRecipes(records, new Set(['1']), remaps)
  const eligible = withHistory(catalog, remappedHistory)
  assert.equal(eligible[0].daysSinceCooked, 0)
  const exhausted = advanceRecommendationSession(rebased, eligible, 0, false)
  assert.deepEqual(exhausted.rounds.shopping.suggestedIds, ['remapped', 'c', 'b'])
  const restarted = advanceRecommendationSession(exhausted, eligible, 0, true)
  assert.equal(restarted.rounds.shopping.currentId, 'c')
  const pantry = { mode: 'pantry', rounds: { pantry: { currentId: 'c', suggestedIds: ['a', 'b', 'c'] } } }
  assert.equal(advanceRecommendationSession(pantry, matches, 0, true).rounds.pantry.currentId, 'a')
})
