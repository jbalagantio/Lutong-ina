import { recipeDifficulties } from './myDishes.js'
import { matchesIngredientSearch, normalizeIngredientName } from './pantry.js'

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
      recipe.ingredients.some((ingredient) => matchesIngredientSearch(ingredient.name, searchTerm))
  }).sort((first, second) => first.name.localeCompare(second.name, 'en'))
}
