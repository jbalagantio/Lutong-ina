import { recipeDifficulties } from './myDishes.js'
import { getIngredientMatchName, matchesIngredientSearch, normalizeIngredientName } from './pantry.js'

// These parent terms broaden Discover only. Pantry still matches the specific ingredient.
const ingredientSearchParents = new Map([
  ['chicken leg quarters', 'chicken'],
])

const matchesDiscoverIngredient = (name, searchTerm) => {
  if (matchesIngredientSearch(name, searchTerm)) return true
  const parent = ingredientSearchParents.get(getIngredientMatchName(name))
  return Boolean(parent && matchesIngredientSearch(parent, searchTerm))
}

export const getDiscoverFilterOptions = (recipes) => {
  const cuisines = [...new Set(recipes.map((recipe) => recipe.cuisine))]
  cuisines.sort((first, second) => first.localeCompare(second, 'en'))
  const difficulties = recipeDifficulties.filter((difficulty) =>
    recipes.some((recipe) => recipe.difficulty === difficulty),
  )
  return { cuisines, difficulties }
}

export const filterDiscoverRecipes = (recipes, { query = '', cuisine = '', maxTime = '', difficulty = '' } = {}) => {
  const searchTerm = normalizeIngredientName(query)
  const timeLimit = maxTime === '' ? Infinity : Number(maxTime)
  return recipes.filter((recipe) => {
    if (cuisine && recipe.cuisine !== cuisine) return false
    if (recipe.cookingTime > timeLimit) return false
    if (difficulty && recipe.difficulty !== difficulty) return false

    return !searchTerm ||
      normalizeIngredientName(recipe.name).includes(searchTerm) ||
      recipe.ingredients.some((ingredient) => matchesDiscoverIngredient(ingredient.name, searchTerm))
  }).sort((first, second) => first.name.localeCompare(second.name, 'en'))
}

export const getRecipeIngredientStatuses = ({ recipe, matchedIngredients, missingIngredients }) => {
  const statuses = new Map()
  for (const ingredient of matchedIngredients) {
    statuses.set(getIngredientMatchName(ingredient.name), 'Available')
  }
  for (const ingredient of missingIngredients) {
    statuses.set(getIngredientMatchName(ingredient.name), 'Missing')
  }

  // The shared matcher omits water. Repeated rows use the status of their canonical ingredient.
  return recipe.ingredients.map((ingredient) =>
    statuses.get(getIngredientMatchName(ingredient.name)) ?? 'Not tracked',
  )
}
