import { getIngredientMatchName } from './pantry.js'

export const getAvailableIngredientNames = (pantryIngredients) => {
  const availableNames = new Set()

  for (const ingredient of pantryIngredients) {
    if (ingredient.isAvailable === true) {
      availableNames.add(getIngredientMatchName(ingredient.name))
    }
  }

  return availableNames
}

export const compareRecipeIngredients = (recipe, availableNames) => {
  const matchedIngredients = []
  const missingIngredients = []
  const trackedNames = new Set()

  for (const ingredient of recipe.ingredients) {
    const name = getIngredientMatchName(ingredient.name)
    if (name === 'water' || trackedNames.has(name)) {
      continue
    }

    trackedNames.add(name)
    if (availableNames.has(name)) {
      matchedIngredients.push(ingredient)
    } else {
      missingIngredients.push(ingredient)
    }
  }

  const matchedCount = matchedIngredients.length
  const trackedCount = trackedNames.size
  const matchPercentage = trackedCount === 0 ? 0 : (matchedCount / trackedCount) * 100

  return { recipe, matchedIngredients, missingIngredients, matchedCount, trackedCount, matchPercentage }
}

export const rankPantryRecommendations = (matches) => {
  return matches.filter((match) => match.matchedCount > 0).sort((first, second) => {
    if (first.matchPercentage !== second.matchPercentage) {
      return second.matchPercentage - first.matchPercentage
    }
    if (first.missingIngredients.length !== second.missingIngredients.length) {
      return first.missingIngredients.length - second.missingIngredients.length
    }
    if (first.recipe.cookingTime !== second.recipe.cookingTime) {
      return first.recipe.cookingTime - second.recipe.cookingTime
    }
    return first.recipe.name.localeCompare(second.recipe.name, 'en')
  })
}

export const selectNextRecommendation = (matches, suggestedIds, randomize) => {
  const remainingMatches = matches.filter((match) => !suggestedIds.includes(match.recipe.id))
  if (remainingMatches.length === 0) {
    return null
  }
  if (!randomize) {
    return remainingMatches[0]
  }

  const randomIndex = Math.floor(Math.random() * remainingMatches.length)
  return remainingMatches[randomIndex]
}
