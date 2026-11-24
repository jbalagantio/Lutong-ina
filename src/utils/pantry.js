export const pantryCategories = [
  'Meat',
  'Seafood',
  'Vegetables',
  'Fruits',
  'Grains and Staples',
  'Dairy and Eggs',
  'Seasonings',
  'Others',
]

export const pantryNameLimit = 80
export const normalizeIngredientName = (name) => name.trim().toLowerCase().replace(/\s+/g, ' ')

const ingredientAliases = new Map([
  ['kangkong', 'water spinach'],
  ['ampalaya', 'bitter melon'],
  ['sitaw', 'long beans'],
  ['talong', 'eggplant'],
  ['bawang', 'garlic'],
  ['luya', 'ginger'],
  ['kamatis', 'tomato'],
  ['monggo', 'mung beans'],
  ['malunggay', 'moringa leaves'],
  ['patis', 'fish sauce'],
  ['toyo', 'soy sauce'],
  ['eggs', 'egg'],
  ['potatoes', 'potato'],
  ['carrots', 'carrot'],
])

export const getIngredientMatchName = (name) => {
  const normalizedName = normalizeIngredientName(name)
  return ingredientAliases.get(normalizedName) ?? normalizedName
}

const storageKey = 'lutong-ina-pantry'

export const loadPantry = () => {
  const ingredients = []
  let savedPantry
  let loadWarning = ''

  try {
    savedPantry = localStorage.getItem(storageKey)
  } catch {
    return {
      ingredients,
      hasChanges: false,
      canSave: false,
      loadWarning: 'Your saved pantry could not be loaded. Changes will stay in this session only.',
    }
  }

  try {
    const savedIngredients = savedPantry === null ? [] : JSON.parse(savedPantry)

    if (!Array.isArray(savedIngredients)) {
      throw new Error('Expected a pantry list.')
    }

    const savedIds = new Set()
    for (const ingredient of savedIngredients) {
      if (
        !ingredient ||
        typeof ingredient.id !== 'string' ||
        !ingredient.id.trim() ||
        typeof ingredient.name !== 'string' ||
        !pantryCategories.includes(ingredient.category) ||
        typeof ingredient.isAvailable !== 'boolean'
      ) {
        continue
      }

      const name = ingredient.name.trim()
      if (!name || name.length > pantryNameLimit || savedIds.has(ingredient.id)) {
        continue
      }

      ingredients.push({
        id: ingredient.id,
        name,
        category: ingredient.category,
        isAvailable: ingredient.isAvailable,
      })
      savedIds.add(ingredient.id)
    }

    if (ingredients.length < savedIngredients.length) {
      loadWarning = 'Some saved pantry entries could not be loaded. Valid entries are shown below.'
    }
  } catch {
    loadWarning = 'The saved pantry could not be read. You can start a new pantry here.'
  }

  return { ingredients, hasChanges: false, canSave: true, loadWarning }
}

export const savePantry = (ingredients) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(ingredients))
    return true
  } catch {
    return false
  }
}
