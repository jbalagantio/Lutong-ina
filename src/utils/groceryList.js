import { pantryCategories, pantryNameLimit } from './pantry.js'

const storageKey = 'lutong-ina-grocery-list'

export const loadGroceryList = () => {
  let raw
  try {
    raw = localStorage.getItem(storageKey)
  } catch {
    return { items: [], storageStatus: 'read-failed' }
  }

  if (raw === null) return { items: [], storageStatus: 'ready' }

  let savedItems
  try {
    savedItems = JSON.parse(raw)
  } catch {
    return { items: [], storageStatus: 'invalid' }
  }

  if (!Array.isArray(savedItems)) return { items: [], storageStatus: 'invalid' }

  const items = []
  const usedIds = new Set()
  for (const item of savedItems) {
    if (
      typeof item?.id !== 'string' || !item.id.trim() || usedIds.has(item.id) ||
      typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > pantryNameLimit ||
      !pantryCategories.includes(item.category) || typeof item.isPurchased !== 'boolean'
    ) {
      continue
    }

    const { id, name, category, isPurchased } = item
    items.push({ id, name, category, isPurchased })
    usedIds.add(id)
  }

  const storageStatus = items.length === savedItems.length ? 'ready' : 'partial'
  return { items, storageStatus }
}

export const saveGroceryList = ({ items, storageStatus }) => {
  if (storageStatus === 'read-failed' || storageStatus === 'invalid' || storageStatus === 'partial') {
    return storageStatus
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(items))
    return 'ready'
  } catch (error) {
    return error?.name === 'QuotaExceededError' ? 'quota-exceeded' : 'write-failed'
  }
}
