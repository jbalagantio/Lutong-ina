import recipes from '../data/recipes.js'

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

const storageKey = 'lutong-ina-my-dishes'
const builtInIds = new Set(recipes.map((recipe) => recipe.id))

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

const createPersonalRecipeId = (reservedIds) => {
  let id
  do {
    id = crypto.randomUUID()
  } while (builtInIds.has(id) || reservedIds.has(id))
  return id
}

export const preparePersonalRecipe = (values, personalRecipes, editingId) => {
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
    if (!personalRecipes.some((recipe) => recipe.id === editingId)) {
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

export const loadMyDishes = () => {
  let raw
  try {
    raw = localStorage.getItem(storageKey)
  } catch {
    return emptyDishes('read-failed')
  }
  if (raw === null) {
    return emptyDishes('ready')
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

  const libraryEntries = hasLibrary ? saved.libraryEntries : []
  const isPartial = !hasRecipes || !hasLibrary || personalRecipes.length !== savedRecipes.length
  return { personalRecipes, libraryEntries, storageStatus: isPartial ? 'partial' : 'ready' }
}

export const saveMyDishes = ({ personalRecipes, libraryEntries, storageStatus }) => {
  if (storageStatus === 'read-failed' || storageStatus === 'invalid' || storageStatus === 'partial') {
    return storageStatus
  }

  const names = new Set(personalRecipes.map((recipe) => normalizeRecipeName(recipe.name)))
  if (names.size !== personalRecipes.length) {
    return 'duplicate-names'
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify({ personalRecipes, libraryEntries }))
    return 'ready'
  } catch (error) {
    return error?.name === 'QuotaExceededError' ? 'quota-exceeded' : 'write-failed'
  }
}
