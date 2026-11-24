import recipes from '../data/recipes.js'

export const myDishesStorageWarnings = {
  'read-failed': 'Could not open My Dishes. Changes stay in memory until saved.',
  invalid: 'Saved My Dishes data is unreadable. Changes stay in memory until you confirm replacement.',
  partial: 'Only some saved data could be recovered. Changes stay in memory until you confirm replacement.',
  'write-failed': 'Could not save My Dishes. Changes stay in memory.',
  'quota-exceeded': 'Browser storage is full. Changes stay in memory.',
  'duplicate-names': 'Some recipes share a name. Rename or delete the duplicates before saving.',
}

export const recipeDifficulties = ['Easy', 'Medium', 'Hard']
export const recipeLimits = {
  name: 100,
  description: 500,
  cuisine: 50,
  cookingTime: 1440,
  servings: 100,
  ingredients: 50,
  ingredientName: 80,
  ingredientUnit: 30,
  instructions: 30,
  instruction: 1000,
}

export const normalizeRecipeName = (name) => name.trim().toLowerCase().replace(/\s+/g, ' ')

export const hasDuplicateRecipeNames = (personalRecipes) => {
  const names = new Set(personalRecipes.map((recipe) => normalizeRecipeName(recipe.name)))
  return names.size < personalRecipes.length
}

const storageKey = 'lutong-ina-my-dishes'
const builtInIds = new Set(recipes.map((recipe) => recipe.id))

export const saveBuiltInRecipe = (libraryEntries, recipeId) => {
  if (!builtInIds.has(recipeId) || libraryEntries.some((entry) => entry.recipeId === recipeId)) {
    return libraryEntries
  }
  return [...libraryEntries, { recipeId, isFavorite: false, isFamiliar: false }]
}

export const removeLibraryEntry = (libraryEntries, recipeId) =>
  libraryEntries.filter((entry) => entry.recipeId !== recipeId)

export const toggleRecipePreference = (libraryEntries, recipeId, preference) => {
  if (preference !== 'isFavorite' && preference !== 'isFamiliar') {
    return libraryEntries
  }
  const existing = libraryEntries.find((entry) => entry.recipeId === recipeId)
  if (!existing) {
    return [...libraryEntries, { recipeId, isFavorite: false, isFamiliar: false, [preference]: true }]
  }
  return libraryEntries.map((entry) =>
    entry === existing ? { ...entry, [preference]: !entry[preference] } : entry,
  )
}

export const getRecipeCollection = (personalRecipes, libraryEntries) => {
  const entriesById = new Map(libraryEntries.map((entry) => [entry.recipeId, entry]))
  const personalIds = new Set(personalRecipes.map((recipe) => recipe.id))
  const savedRecipes = recipes.filter((recipe) => entriesById.has(recipe.id))
  return [...personalRecipes, ...savedRecipes].map((recipe) => {
    const entry = entriesById.get(recipe.id)
    return {
      recipe,
      isPersonal: personalIds.has(recipe.id),
      isFavorite: entry?.isFavorite ?? false,
      isFamiliar: entry?.isFamiliar ?? false,
    }
  })
}

export const filterRecipeCollection = (collection, filter, searchTerm) => {
  return collection.filter(({ recipe, isPersonal, isFavorite, isFamiliar }) => {
    if (!normalizeRecipeName(recipe.name).includes(searchTerm)) {
      return false
    }
    if (filter === 'favorites') return isFavorite
    if (filter === 'familiar') return isFamiliar
    if (filter === 'personal') return isPersonal
    if (filter === 'saved') return !isPersonal
    return true
  })
}

export const deletePersonalRecipe = (dishes, recipe) => {
  if (!dishes.personalRecipes.includes(recipe)) {
    return dishes
  }
  return {
    ...dishes,
    personalRecipes: dishes.personalRecipes.filter((item) => item !== recipe),
    libraryEntries: removeLibraryEntry(dishes.libraryEntries, recipe.id),
  }
}

export const mergeLibraryEntries = (savedEntries, sessionEntries, remappedRecipes = new Map()) => {
  const entriesById = new Map()
  const remappedEntries = sessionEntries.map((entry) => {
    const remapped = remappedRecipes.get(entry.recipeId)
    return remapped ? { ...entry, recipeId: remapped.id } : entry
  })
  for (const entry of [...savedEntries, ...remappedEntries]) {
    const existing = entriesById.get(entry.recipeId)
    if (existing) {
      // Duplicate stored records have no reliable ordering for their preferences.
      entriesById.set(entry.recipeId, {
        ...existing,
        isFavorite: existing.isFavorite || entry.isFavorite,
        isFamiliar: existing.isFamiliar || entry.isFamiliar,
      })
    } else {
      entriesById.set(entry.recipeId, entry)
    }
  }
  return [...entriesById.values()]
}

export const recordLibraryChange = (changes, recipeId, change) => {
  const previous = changes.get(recipeId)
  let nextChange = { ...previous, ...change }
  if (change.isSaved === false) {
    nextChange = { isSaved: false }
  } else if (change.isSaved === true && previous?.isSaved === false) {
    // Saving again starts fresh after explicitly removing the old entry.
    nextChange = { isSaved: true, isFavorite: false, isFamiliar: false }
  }
  return new Map(changes).set(recipeId, nextChange)
}

export const recoverLibraryEntries = (savedEntries, changes, remappedRecipes) => {
  const entriesById = new Map(savedEntries.map((entry) => [entry.recipeId, entry]))
  for (const [originalId, change] of changes) {
    const recipeId = remappedRecipes.get(originalId)?.id ?? originalId
    if (change.isSaved === false) {
      entriesById.delete(recipeId)
      continue
    }

    const saved = entriesById.get(recipeId)
    entriesById.set(recipeId, {
      recipeId,
      isFavorite: change.isFavorite ?? saved?.isFavorite ?? false,
      isFamiliar: change.isFamiliar ?? saved?.isFamiliar ?? false,
    })
  }
  return [...entriesById.values()]
}

const textValue = (value) => typeof value === 'string' ? value.trim() : ''
const numericValue = (value) => {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string' && /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) {
    return Number(value)
  }
  return NaN
}

export const validatePersonalRecipe = (values) => {
  const name = textValue(values?.name)
  const description = textValue(values?.description)
  const cuisine = textValue(values?.cuisine)
  const cookingTime = numericValue(values?.cookingTime)
  const servings = numericValue(values?.servings)
  const difficulty = values?.difficulty

  if (!name || name.length > recipeLimits.name) {
    return { error: `Enter a recipe name of 1–${recipeLimits.name} characters.` }
  }
  if ((values.description != null && typeof values.description !== 'string') || description.length > recipeLimits.description) {
    return { error: `Keep the description to ${recipeLimits.description} characters or fewer.` }
  }
  if (!cuisine || cuisine.length > recipeLimits.cuisine) {
    return { error: `Enter a cuisine of 1–${recipeLimits.cuisine} characters.` }
  }
  if (!Number.isInteger(cookingTime) || cookingTime < 1 || cookingTime > recipeLimits.cookingTime) {
    return { error: `Enter a whole cooking time from 1 to ${recipeLimits.cookingTime} minutes.` }
  }
  if (!recipeDifficulties.includes(difficulty)) {
    return { error: 'Choose a difficulty.' }
  }
  if (!Number.isInteger(servings) || servings < 1 || servings > recipeLimits.servings) {
    return { error: `Enter a whole serving count from 1 to ${recipeLimits.servings}.` }
  }
  if (!Array.isArray(values.ingredients) || values.ingredients.length < 1 || values.ingredients.length > recipeLimits.ingredients) {
    return { error: `Add 1–${recipeLimits.ingredients} ingredients.` }
  }
  if (!Array.isArray(values.instructions) || values.instructions.length < 1 || values.instructions.length > recipeLimits.instructions) {
    return { error: `Add 1–${recipeLimits.instructions} instructions.` }
  }

  const ingredients = []
  for (const [index, ingredient] of values.ingredients.entries()) {
    const ingredientName = textValue(ingredient?.name)
    const quantity = numericValue(ingredient?.quantity)
    const unit = textValue(ingredient?.unit)
    const label = `Ingredient ${index + 1}`
    if (!ingredientName || ingredientName.length > recipeLimits.ingredientName) {
      return { error: `${label} needs a name of 1–${recipeLimits.ingredientName} characters.` }
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: `${label} needs a quantity greater than zero.` }
    }
    if (!unit || unit.length > recipeLimits.ingredientUnit) {
      return { error: `${label} needs a unit of 1–${recipeLimits.ingredientUnit} characters.` }
    }
    ingredients.push({ name: ingredientName, quantity, unit })
  }

  const instructions = []
  for (const [index, instruction] of values.instructions.entries()) {
    const step = textValue(instruction)
    if (!step || step.length > recipeLimits.instruction) {
      return { error: `Step ${index + 1} needs 1–${recipeLimits.instruction} characters.` }
    }
    instructions.push(step)
  }

  return { recipe: { name, description, cuisine, cookingTime, difficulty, servings, ingredients, instructions } }
}

export const createPersonalRecipeId = (reservedIds) => {
  let id
  do {
    id = crypto.randomUUID()
  } while (builtInIds.has(id) || reservedIds.has(id))
  return id
}

export const preparePersonalRecipe = (values, personalRecipes, editingId, expectedRecipe) => {
  const result = validatePersonalRecipe(values)
  if (result.error) {
    return result
  }

  const name = normalizeRecipeName(result.recipe.name)
  const duplicate = personalRecipes.some((recipe) => recipe.id !== editingId && normalizeRecipeName(recipe.name) === name)
  if (duplicate) {
    return { error: 'A personal recipe already uses that name.' }
  }

  let id = editingId
  if (editingId) {
    const currentRecipe = personalRecipes.find((recipe) => recipe.id === editingId)
    if (!currentRecipe || (expectedRecipe && currentRecipe !== expectedRecipe)) {
      return { error: 'This recipe is no longer available.' }
    }
  } else {
    const reservedIds = new Set(personalRecipes.map((recipe) => recipe.id))
    id = createPersonalRecipeId(reservedIds)
  }

  return { recipe: { id, ...result.recipe } }
}

export const mergeRecoveredPersonalRecipes = (savedRecipes, sessionRecipes) => {
  const reservedIds = new Set([...savedRecipes, ...sessionRecipes].map((recipe) => recipe.id))
  const savedIds = new Set(savedRecipes.map((recipe) => recipe.id))
  const recoveredSessionRecipes = sessionRecipes.map((recipe) => {
    if (!savedIds.has(recipe.id)) {
      return recipe
    }

    const id = createPersonalRecipeId(reservedIds)
    reservedIds.add(id)
    return { ...recipe, id }
  })
  return [...savedRecipes, ...recoveredSessionRecipes]
}

const emptyDishes = (storageStatus) => ({ personalRecipes: [], libraryEntries: [], storageStatus })

export const loadMyDishes = ({ requireSnapshot = false } = {}) => {
  let raw
  try {
    raw = localStorage.getItem(storageKey)
  } catch {
    return emptyDishes('read-failed')
  }
  if (raw === null) {
    return requireSnapshot ? null : emptyDishes('ready')
  }

  let saved
  try {
    saved = JSON.parse(raw)
  } catch {
    return emptyDishes('invalid')
  }
  const hasRecipes = Array.isArray(saved?.personalRecipes)
  const hasLibrary = Array.isArray(saved?.libraryEntries)
  if (!hasRecipes && !hasLibrary) {
    return emptyDishes('invalid')
  }

  const personalRecipes = []
  const savedIds = new Set(builtInIds)
  const savedRecipes = hasRecipes ? saved.personalRecipes : []
  for (const recipe of savedRecipes) {
    if (
      typeof recipe?.id !== 'string' || !recipe.id.trim() || savedIds.has(recipe.id) ||
      typeof recipe.description !== 'string' ||
      typeof recipe.cookingTime !== 'number' || typeof recipe.servings !== 'number' ||
      !Array.isArray(recipe.ingredients) || recipe.ingredients.some((item) => typeof item?.quantity !== 'number') ||
      validatePersonalRecipe(recipe).error
    ) {
      continue
    }
    savedIds.add(recipe.id)
    personalRecipes.push(recipe)
  }

  const savedEntries = hasLibrary ? saved.libraryEntries : []
  const validEntries = savedEntries.filter((entry) =>
    typeof entry?.recipeId === 'string' && entry.recipeId.trim() && savedIds.has(entry.recipeId) &&
    typeof entry.isFavorite === 'boolean' && typeof entry.isFamiliar === 'boolean',
  )
  const libraryEntries = mergeLibraryEntries(validEntries, [])
  const isPartial = !hasRecipes || !hasLibrary || personalRecipes.length !== savedRecipes.length ||
    libraryEntries.length !== savedEntries.length
  let storageStatus = 'ready'
  if (isPartial) {
    storageStatus = 'partial'
  } else if (hasDuplicateRecipeNames(personalRecipes)) {
    storageStatus = 'duplicate-names'
  }
  return { personalRecipes, libraryEntries, storageStatus }
}

export const saveMyDishes = ({ personalRecipes, libraryEntries, storageStatus }) => {
  if (storageStatus === 'read-failed' || storageStatus === 'invalid' || storageStatus === 'partial') {
    return storageStatus
  }

  if (hasDuplicateRecipeNames(personalRecipes)) {
    return 'duplicate-names'
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify({ personalRecipes, libraryEntries }))
    return 'ready'
  } catch (error) {
    return error?.name === 'QuotaExceededError' ? 'quota-exceeded' : 'write-failed'
  }
}
