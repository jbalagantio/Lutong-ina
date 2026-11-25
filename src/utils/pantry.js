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
  ['all purpose flour', 'all-purpose flour'],
  ['ap flour', 'all-purpose flour'],
  ['atsuete powder', 'annatto powder'],
  ['achiote powder', 'annatto powder'],
  ['bone-in beef shanks', 'bone-in beef shank'],
  ['beef shank with bone', 'bone-in beef shank'],
  ['asukal na pula', 'brown sugar'],
  ['chicken leg quarter', 'chicken leg quarters'],
  ['kakang gata', 'coconut cream'],
  ['whole corn cob', 'corn on the cob'],
  ['whole corn cobs', 'corn on the cob'],
  ['corn starch', 'cornstarch'],
  ['dried gabi leaves', 'dried taro leaves'],
  ['pinatuyong dahon ng gabi', 'dried taro leaves'],
  ['green olive', 'green olives'],
  ['green pea', 'green peas'],
  ['minced pork', 'ground pork'],
  ['giniling na baboy', 'ground pork'],
  ['tanglad', 'lemongrass'],
  ['lemon grass', 'lemongrass'],
  ['siling haba na berde', 'long green chili'],
  ['long green chilli', 'long green chili'],
  ['lumpia wrapper', 'lumpia wrappers'],
  ['balat ng lumpia', 'lumpia wrappers'],
  ['bangus', 'milkfish'],
  ['milk fish', 'milkfish'],
  ['lady\'s fingers', 'okra'],
  ['beef oxtail', 'oxtail'],
  ['buntot ng baka', 'oxtail'],
  ['pork ear', 'pork ears'],
  ['tainga ng baboy', 'pork ears'],
  ['red bird\'s-eye chilli', 'red bird\'s eye chili'],
  ['pulang siling labuyo', 'red bird\'s eye chili'],
  ['harina ng bigas', 'rice flour'],
  ['sautéed shrimp paste', 'sauteed shrimp paste'],
  ['ginisang bagoong alamang', 'sauteed shrimp paste'],
  ['shrimps', 'shrimp'],
  ['hipon', 'shrimp'],
  ['tilapias', 'tilapia'],
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

export const createPantryIngredientId = (usedIds) => {
  let id = crypto.randomUUID()
  while (usedIds.has(id)) id = crypto.randomUUID()
  return id
}

export const recoverPantryIngredients = (saved, session) => {
  const savedIds = new Set(saved.map((ingredient) => ingredient.id))
  const usedIds = new Set([...savedIds, ...session.map((ingredient) => ingredient.id)])
  const remappedIds = new Map()
  const additions = session.map((ingredient) => {
    if (!savedIds.has(ingredient.id)) return ingredient
    const id = createPantryIngredientId(usedIds)
    usedIds.add(id)
    remappedIds.set(ingredient.id, id)
    return { ...ingredient, id }
  })
  return { ingredients: [...saved, ...additions], remappedIds }
}

export const loadPantry = () => {
  const ingredients = []
  let savedPantry

  try {
    savedPantry = localStorage.getItem(storageKey)
  } catch {
    return { ingredients, storageStatus: 'read-failed' }
  }

  if (savedPantry === null) {
    return { ingredients, storageStatus: 'ready' }
  }

  let savedIngredients
  try {
    savedIngredients = JSON.parse(savedPantry)
  } catch {
    return { ingredients, storageStatus: 'invalid' }
  }
  if (!Array.isArray(savedIngredients)) {
    return { ingredients, storageStatus: 'invalid' }
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

  const storageStatus = ingredients.length < savedIngredients.length ? 'partial' : 'ready'
  return { ingredients, storageStatus }
}

export const savePantry = ({ ingredients, storageStatus }) => {
  if (storageStatus === 'read-failed' || storageStatus === 'invalid' || storageStatus === 'partial') {
    return storageStatus
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(ingredients))
    return 'ready'
  } catch (error) {
    if (error?.name === 'QuotaExceededError') {
      return 'quota-exceeded'
    }
    return 'write-failed'
  }
}
