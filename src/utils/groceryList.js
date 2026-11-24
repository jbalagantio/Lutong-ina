import { matchesIngredientSearch, normalizeIngredientName, pantryCategories, pantryNameLimit, wouldDuplicateIngredient } from './pantry.js'

const storageKey = 'lutong-ina-grocery-list'

const makeUniqueId = (usedIds) => {
  let id = crypto.randomUUID()
  while (usedIds.has(id)) id = crypto.randomUUID()
  return id
}

export const prepareGroceryItem = (items, values, id = null) => {
  const current = items.find((item) => item.id === id)
  if (id !== null && !current) return { error: 'This grocery item is no longer available.' }

  const name = typeof values.name === 'string' ? values.name.trim() : ''
  if (!name) return { field: 'name', error: 'Enter an item name.' }
  if (name.length > pantryNameLimit) {
    return { field: 'name', error: `Use ${pantryNameLimit} characters or fewer for the item name.` }
  }
  if (!pantryCategories.includes(values.category)) return { field: 'category', error: 'Select a valid category.' }
  if (wouldDuplicateIngredient(name, items, current)) {
    return { field: 'name', error: 'That item is already on your grocery list.' }
  }

  const item = {
    id: current?.id ?? makeUniqueId(new Set(items.map((entry) => entry.id))),
    name,
    category: values.category,
    isPurchased: current?.isPurchased ?? false,
  }
  const nextItems = current
    ? items.map((entry) => entry === current ? item : entry)
    : [...items, item]
  return { item, items: nextItems }
}

export const removeGroceryItem = (items, id) => {
  if (!items.some((item) => item.id === id)) return items
  return items.filter((item) => item.id !== id)
}

export const filterGroceryItems = (items, search, category) => {
  const term = normalizeIngredientName(search)
  return items.filter((item) => (
    (!category || item.category === category) && matchesIngredientSearch(item.name, term)
  ))
}

export const recoverGroceryItems = (recoveredItems, sessionItems) => {
  const recoveredIds = new Set(recoveredItems.map((item) => item.id))
  const usedIds = new Set([...recoveredIds, ...sessionItems.map((item) => item.id)])
  const remappedIds = new Map()
  const recoveredSessionItems = sessionItems.map((item) => {
    if (!recoveredIds.has(item.id)) return item
    const id = makeUniqueId(usedIds)
    usedIds.add(id)
    remappedIds.set(item.id, id)
    return { ...item, id }
  })
  return { items: [...recoveredItems, ...recoveredSessionItems], remappedIds }
}

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
