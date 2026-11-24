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
export const normalizeIngredientName = (name) => name.trim().toLowerCase()

const storageKey = 'lutong-ina-pantry'

export const loadPantry = () => {
  const ingredients = []

  try {
    const savedPantry = localStorage.getItem(storageKey)
    const savedIngredients = savedPantry === null ? [] : JSON.parse(savedPantry)

    if (Array.isArray(savedIngredients)) {
      const savedIds = new Set()
      const savedNames = new Set()

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
        const normalizedName = normalizeIngredientName(name)

        if (!name || name.length > pantryNameLimit || savedIds.has(ingredient.id) || savedNames.has(normalizedName)) {
          continue
        }

        ingredients.push({
          id: ingredient.id,
          name,
          category: ingredient.category,
          isAvailable: ingredient.isAvailable,
        })
        savedIds.add(ingredient.id)
        savedNames.add(normalizedName)
      }
    }
  } catch (error) {
    console.warn('Lutong Ina could not load the saved pantry.', error)
  }

  return { ingredients, hasChanges: false }
}

export const savePantry = (ingredients) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(ingredients))
  } catch (error) {
    console.warn('Lutong Ina could not save the pantry to this browser.', error)
  }
}
