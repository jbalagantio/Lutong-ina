import { getIngredientMatchName, matchesIngredientSearch, normalizeIngredientName, pantryCategories, pantryNameLimit, wouldDuplicateIngredient } from './pantry.js'

const storageKey = 'lutong-ina-grocery-list'

export const groceryStorageWarnings = {
  'read-failed': 'Could not open the saved grocery list.',
  invalid: 'The saved grocery list is unreadable.',
  partial: 'Some saved grocery items could not be recovered.',
  'write-failed': 'Could not save the grocery list.',
  'quota-exceeded': 'Browser storage is full. Grocery items could not be saved.',
}

export const groceryUnsavedWarning = 'Changes are only in memory and may be lost on refresh.'

const ingredientsByCategory = {
  Meat: ['beef sirloin', 'chicken', 'pork belly', 'pork liver', 'pork ribs', 'pork shoulder'],
  Vegetables: [
    'bitter melon', 'cabbage', 'carrot', 'eggplant', 'garlic', 'ginger', 'long beans', 'moringa leaves',
    'pechay', 'potato', 'radish', 'red bell pepper', 'red onion', 'squash', 'tomato', 'water spinach', 'yellow onion',
  ],
  Fruits: ['green papaya'],
  'Grains and Staples': ['coconut milk', 'cooked rice', 'cooking oil', 'elbow macaroni', 'mung beans'],
  'Dairy and Eggs': ['egg', 'evaporated milk'],
  Seasonings: [
    'bay leaf', 'black peppercorns', 'calamansi juice', 'cane vinegar', 'fish sauce', 'ground black pepper',
    'salt', 'soy sauce', 'tamarind pulp', 'tomato sauce',
  ],
}

export const resolveGroceryCategory = (name, pantry) => {
  const matchName = getIngredientMatchName(name)
  // Pantry order breaks ties, including when a matching ingredient is out of stock.
  const match = pantry.find((ingredient) => (
    pantryCategories.includes(ingredient.category) && getIngredientMatchName(ingredient.name) === matchName
  ))
  if (match) return match.category

  return pantryCategories.find((category) => ingredientsByCategory[category]?.includes(matchName)) ?? 'Others'
}

const makeUniqueId = (usedIds) => {
  let id = crypto.randomUUID()
  while (usedIds.has(id)) id = crypto.randomUUID()
  return id
}

const getNameError = (name) => {
  if (!name) return 'Enter an item name.'
  if (name.length > pantryNameLimit) return `Use ${pantryNameLimit} characters or fewer for the item name.`
  return null
}

export const prepareGroceryItem = (items, values, id = null) => {
  const current = items.find((item) => item.id === id)
  if (id !== null && !current) return { error: 'This grocery item is no longer available.' }

  const name = typeof values.name === 'string' ? values.name.trim() : ''
  const nameError = getNameError(name)
  if (nameError) return { field: 'name', error: nameError }
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

export const planGroceryAddition = (items, missingIngredients) => {
  const listedNames = new Set(items.map((item) => getIngredientMatchName(item.name)))
  const seenNames = new Set()
  const names = []
  const alreadyListed = []
  const skipped = []
  for (const ingredient of missingIngredients) {
    const name = typeof ingredient?.name === 'string' ? ingredient.name.trim() : ''
    if (getNameError(name)) {
      skipped.push(ingredient)
      continue
    }

    const matchName = getIngredientMatchName(name)
    if (matchName === 'water' || seenNames.has(matchName)) {
      skipped.push(ingredient)
      continue
    }
    seenNames.add(matchName)
    if (listedNames.has(matchName)) alreadyListed.push(name)
    else names.push(name)
  }
  return { names, alreadyListed, skipped }
}

export const addMissingGroceryItems = (items, missingIngredients, pantry) => {
  const { names, alreadyListed, skipped } = planGroceryAddition(items, missingIngredients)
  const added = []
  let nextItems = items
  for (const name of names) {
    const category = resolveGroceryCategory(name, pantry)
    const result = prepareGroceryItem(nextItems, { name, category })
    if (result.error) {
      skipped.push({ name })
      continue
    }
    nextItems = result.items
    added.push(result.item)
  }
  return { items: nextItems, added, alreadyListed, skipped }
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
