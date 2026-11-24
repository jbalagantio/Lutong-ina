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
  ['bay leaves', 'bay leaf'],
  ['dahon ng laurel', 'bay leaf'],
  ['ampalaya', 'bitter melon'],
  ['bitter gourd', 'bitter melon'],
  ['black peppercorn', 'black peppercorns'],
  ['whole black peppercorns', 'black peppercorns'],
  ['repolyo', 'cabbage'],
  ['cabbages', 'cabbage'],
  ['kalamansi juice', 'calamansi juice'],
  ['calamondin juice', 'calamansi juice'],
  ['sukang tubo', 'cane vinegar'],
  ['sugarcane vinegar', 'cane vinegar'],
  ['carrots', 'carrot'],
  ['karot', 'carrot'],
  ['manok', 'chicken'],
  ['gata', 'coconut milk'],
  ['kanin', 'cooked rice'],
  ['mantika', 'cooking oil'],
  ['eggs', 'egg'],
  ['itlog', 'egg'],
  ['talong', 'eggplant'],
  ['eggplants', 'eggplant'],
  ['aubergine', 'eggplant'],
  ['aubergines', 'eggplant'],
  ['patis', 'fish sauce'],
  ['bawang', 'garlic'],
  ['luya', 'ginger'],
  ['papayang hilaw', 'green papaya'],
  ['unripe papaya', 'green papaya'],
  ['sitaw', 'long beans'],
  ['sitao', 'long beans'],
  ['yardlong bean', 'long beans'],
  ['yardlong beans', 'long beans'],
  ['long bean', 'long beans'],
  ['malunggay', 'moringa leaves'],
  ['moringa leaf', 'moringa leaves'],
  ['monggo', 'mung beans'],
  ['munggo', 'mung beans'],
  ['mung bean', 'mung beans'],
  ['mungbean', 'mung beans'],
  ['mungbeans', 'mung beans'],
  ['petsay', 'pechay'],
  ['bok choy', 'pechay'],
  ['pak choi', 'pechay'],
  ['liempo', 'pork belly'],
  ['atay ng baboy', 'pork liver'],
  ['tadyang ng baboy', 'pork ribs'],
  ['pork rib', 'pork ribs'],
  ['kasim', 'pork shoulder'],
  ['potatoes', 'potato'],
  ['patatas', 'potato'],
  ['labanos', 'radish'],
  ['radishes', 'radish'],
  ['red bell peppers', 'red bell pepper'],
  ['sibuyas na pula', 'red onion'],
  ['red onions', 'red onion'],
  ['asin', 'salt'],
  ['toyo', 'soy sauce'],
  ['kalabasa', 'squash'],
  ['kamatis', 'tomato'],
  ['tomatoes', 'tomato'],
  ['tubig', 'water'],
  ['kangkong', 'water spinach'],
  ['yellow onions', 'yellow onion'],
])

export const getIngredientMatchName = (name) => {
  const normalizedName = normalizeIngredientName(name)
  return ingredientAliases.get(normalizedName) ?? normalizedName
}

export const matchesIngredientSearch = (name, searchTerm) => {
  const displayName = normalizeIngredientName(name)
  const matchName = getIngredientMatchName(name)
  if (displayName.includes(searchTerm) || matchName.includes(searchTerm)) {
    return true
  }

  for (const [alias, canonicalName] of ingredientAliases) {
    if (canonicalName === matchName && alias.includes(searchTerm)) {
      return true
    }
  }

  return false
}

export const wouldDuplicateIngredient = (name, ingredients, currentIngredient) => {
  const matchName = getIngredientMatchName(name)
  // An edit within the same alias group does not add a new duplicate.
  if (currentIngredient && getIngredientMatchName(currentIngredient.name) === matchName) {
    return false
  }

  return ingredients.some((ingredient) =>
    ingredient.id !== currentIngredient?.id && getIngredientMatchName(ingredient.name) === matchName,
  )
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

      const name = ingredient.name
      const trimmedName = name.trim()
      if (!trimmedName || trimmedName.length > pantryNameLimit || savedIds.has(ingredient.id)) {
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
