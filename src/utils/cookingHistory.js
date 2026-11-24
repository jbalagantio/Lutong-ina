import { recipeLimits } from './myDishes.js'

const storageKey = 'lutong-ina-cooking-history'

export const cookingHistoryWarnings = {
  'read-failed': 'Could not open saved cooking history.',
  invalid: 'Saved cooking history is unreadable.',
  partial: 'Some cooking records could not be recovered.',
  'write-failed': 'Could not save cooking history.',
  'quota-exceeded': 'Browser storage is full. Cooking history could not be saved.',
}

export const historyUnsavedWarning = 'Unsaved history changes may be lost on refresh.'
export const pendingRecipeHistoryWarning = 'Save My Dishes to persist cooking records for new personal recipes.'

const isNonblank = (value) => typeof value === 'string' && value.trim().length > 0

export const needsHistoryReplacement = (status) => status === 'invalid' || status === 'partial'

const isValidTimestamp = (value) => {
  if (typeof value !== 'string') return false
  const parts = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d{1,3})?(?:Z|\+00:00)$/.exec(value)
  if (!parts || !Number.isFinite(Date.parse(value))) return false
  // Date.parse can accept out-of-range days by rolling them into the next month.
  return new Date(value).toISOString().slice(0, 19) === parts[1]
}

const hasValidRecipe = (recipeId, recipeName) => (
  isNonblank(recipeId) && isNonblank(recipeName) && recipeName.trim().length <= recipeLimits.name
)

export const isValidCookingRecord = (record) => (
  isNonblank(record?.id) && hasValidRecipe(record.recipeId, record.recipeName) && isValidTimestamp(record.cookedAt)
)

const uniqueRecordId = (usedIds) => {
  let id = crypto.randomUUID()
  while (usedIds.has(id)) id = crypto.randomUUID()
  return id
}

export const createCookingRecord = (records, recipe, cookedAt = new Date().toISOString()) => {
  if (!hasValidRecipe(recipe?.id, recipe?.name) || !isValidTimestamp(cookedAt)) return null
  return {
    id: uniqueRecordId(new Set(records.map((record) => record.id))),
    recipeId: recipe.id,
    recipeName: recipe.name,
    cookedAt,
  }
}

export const removeCookingRecord = (records, id) => {
  if (!records.some((record) => record.id === id)) return records
  return records.filter((record) => record.id !== id)
}

export const searchCookingHistory = (records, search) => {
  const term = search.trim().toLowerCase()
  return records.filter((record) => record.recipeName.toLowerCase().includes(term))
    .sort((first, second) => {
      const byTime = Date.parse(second.cookedAt) - Date.parse(first.cookedAt)
      if (byTime !== 0) return byTime
      if (first.id === second.id) return 0
      return first.id < second.id ? -1 : 1
    })
}

export const countCookedDishes = (records) => new Set(records.map((record) => record.recipeId)).size

export const getLatestCookingTimes = (records) => {
  const latestByRecipe = new Map()
  for (const record of records) {
    if (!isValidCookingRecord(record)) continue
    const cookedAt = Date.parse(record.cookedAt)
    if (!latestByRecipe.has(record.recipeId) || cookedAt > latestByRecipe.get(record.recipeId)) {
      latestByRecipe.set(record.recipeId, cookedAt)
    }
  }
  return latestByRecipe
}

const localCalendarDay = (date) => {
  // Compare local date labels on a UTC scale so daylight-saving days still count as one day.
  const day = new Date(0)
  day.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate())
  return day.getTime() / (24 * 60 * 60 * 1000)
}

export const getDaysSinceCooking = (cookedAt, referenceDate = new Date()) => {
  if (cookedAt === undefined) return null
  return Math.max(0, localCalendarDay(referenceDate) - localCalendarDay(new Date(cookedAt)))
}

export const recoverCookingRecords = (savedRecords, sessionRecords) => {
  const savedIds = new Set(savedRecords.map((record) => record.id))
  const usedIds = new Set([...savedIds, ...sessionRecords.map((record) => record.id)])
  const remappedIds = new Map()
  const additions = sessionRecords.map((record) => {
    if (!savedIds.has(record.id)) return record
    const id = uniqueRecordId(usedIds)
    usedIds.add(id)
    remappedIds.set(record.id, id)
    return { ...record, id }
  })
  return { records: [...savedRecords, ...additions], remappedIds }
}

export const remapSessionCookingRecipes = (records, sessionRecordIds, remappedRecipes) => {
  let changed = false
  const nextRecords = records.map((record) => {
    if (!sessionRecordIds.has(record.id)) return record
    const recipe = remappedRecipes.get(record.recipeId)
    if (!recipe) return record
    changed = true
    return { ...record, recipeId: recipe.id }
  })
  return changed ? nextRecords : records
}

export const loadCookingHistory = () => {
  let raw
  try {
    raw = localStorage.getItem(storageKey)
  } catch {
    return { records: [], storageStatus: 'read-failed' }
  }
  if (raw === null) return { records: [], storageStatus: 'ready' }

  let savedRecords
  try {
    savedRecords = JSON.parse(raw)
  } catch {
    return { records: [], storageStatus: 'invalid' }
  }
  if (!Array.isArray(savedRecords)) return { records: [], storageStatus: 'invalid' }

  const records = []
  const usedIds = new Set()
  for (const record of savedRecords) {
    if (!isValidCookingRecord(record) || usedIds.has(record.id)) continue
    const { id, recipeId, recipeName, cookedAt } = record
    records.push({ id, recipeId, recipeName, cookedAt })
    usedIds.add(id)
  }
  return { records, storageStatus: records.length === savedRecords.length ? 'ready' : 'partial' }
}

export const saveCookingHistory = ({ records, storageStatus }) => {
  if (storageStatus === 'read-failed' || needsHistoryReplacement(storageStatus)) return storageStatus
  try {
    localStorage.setItem(storageKey, JSON.stringify(records))
    return 'ready'
  } catch (error) {
    return error?.name === 'QuotaExceededError' ? 'quota-exceeded' : 'write-failed'
  }
}
