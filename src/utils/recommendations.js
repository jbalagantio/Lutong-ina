import { getIngredientMatchName } from './pantry.js'
import { getDaysSinceCooking, getLatestCookingTimes } from './cookingHistory.js'

export const addCookingRecency = (matches, history, referenceDate = new Date()) => {
  const latestByRecipe = getLatestCookingTimes(history)
  return matches.map((match) => {
    const cookedAt = latestByRecipe.get(match.recipe.id)
    return {
      ...match,
      daysSinceCooked: getDaysSinceCooking(cookedAt, referenceDate),
      cookedInFuture: cookedAt > referenceDate.getTime(),
    }
  })
}

const recencyPriority = (match) => {
  const days = match.daysSinceCooked
  if (days == null) return 0
  if (days >= 7) return 1
  if (days >= 3) return 2
  if (days >= 1) return 3
  return 4
}

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
    const byRecency = recencyPriority(first) - recencyPriority(second)
    if (byRecency !== 0) return byRecency
    if (first.recipe.cookingTime !== second.recipe.cookingTime) {
      return first.recipe.cookingTime - second.recipe.cookingTime
    }
    return first.recipe.name.localeCompare(second.recipe.name, 'en')
  })
}

export const getRecipeMatches = (recipes, ingredients) => {
  const availableNames = getAvailableIngredientNames(ingredients)
  return recipes.map((recipe) => compareRecipeIngredients(recipe, availableNames))
}

export const getRecommendationCatalog = (builtInRecipes, personalRecipes) => [...builtInRecipes, ...personalRecipes]

export const getSomethingNewPool = (matches, libraryEntries) => {
  const familiarIds = new Set(libraryEntries.filter((entry) => entry.isFamiliar === true).map((entry) => entry.recipeId))
  const unmarked = matches.filter((match) => !familiarIds.has(match.recipe.id))
  if (unmarked.length === 0 && matches.length > 0) {
    return { matches, isFallback: true }
  }
  return { matches: unmarked, isFallback: false }
}

export const getEligibleRecommendations = (mode, matches, libraryEntries = []) => {
  if (mode === 'pantry') return rankPantryRecommendations(matches)
  if (mode === 'new') return getSomethingNewPool(matches, libraryEntries).matches
  return matches
}

export const selectNextRecommendation = (matches, suggestedIds, randomValue = 0) => {
  const remainingMatches = matches.filter((match) => !suggestedIds.includes(match.recipe.id))
  if (remainingMatches.length === 0) {
    return null
  }
  const bestPriority = remainingMatches.reduce((best, match) => Math.min(best, recencyPriority(match)), Infinity)
  const pool = remainingMatches.filter((match) => recencyPriority(match) === bestPriority)
  return pool[Math.floor(randomValue * pool.length)]
}

const selectForMode = (mode, eligible, suggestedIds, randomValue) => {
  if (mode === 'pantry') return eligible.find((match) => !suggestedIds.includes(match.recipe.id))
  return selectNextRecommendation(eligible, suggestedIds, randomValue)
}

const updateRound = (session, mode, round) => ({
  ...session,
  rounds: { ...session.rounds, [mode]: round },
})

const appendSuggestion = (suggestedIds, match) => {
  if (!match) {
    return { currentId: null, suggestedIds }
  }

  const currentId = match.recipe.id
  return { currentId, suggestedIds: [...suggestedIds, currentId] }
}

export const selectCookingMode = (session, mode, matches, randomValue, libraryEntries = []) => {
  if (mode === session.mode) {
    return session
  }

  const nextSession = { ...session, mode }
  if (session.rounds[mode]) {
    if (mode === 'pantry') {
      return refreshPantryRound(nextSession, matches)
    }
    return refreshRecommendationRound(nextSession, mode, matches, randomValue, libraryEntries)
  }

  const eligible = getEligibleRecommendations(mode, matches, libraryEntries)
  const match = selectForMode(mode, eligible, [], randomValue)
  return updateRound(nextSession, mode, appendSuggestion([], match))
}

export const advanceRecommendationSession = (session, matches, randomValue, restart, libraryEntries = []) => {
  const { mode } = session
  const round = session.rounds[mode]
  if (!round) {
    return session
  }

  const eligible = getEligibleRecommendations(mode, matches, libraryEntries)
  if (!restart) {
    const nextMatch = selectForMode(mode, eligible, round.suggestedIds, randomValue)
    return nextMatch ? updateRound(session, mode, appendSuggestion(round.suggestedIds, nextMatch)) : session
  }

  const hasUnseen = eligible.some((match) => !round.suggestedIds.includes(match.recipe.id))
  if (hasUnseen || eligible.length === 0 || (eligible.length === 1 && round.currentId)) {
    return session
  }

  const excludedIds = eligible.length > 1 ? [round.currentId] : []
  const firstMatch = selectForMode(mode, eligible, excludedIds, randomValue)
  return updateRound(session, mode, appendSuggestion([], firstMatch))
}

export const refreshRecommendationRound = (session, mode, matches, randomValue, libraryEntries) => {
  const round = session.rounds[mode]
  if (!round) {
    return session
  }

  const eligible = getEligibleRecommendations(mode, matches, libraryEntries)
  if (eligible.some((match) => match.recipe.id === round.currentId)) {
    return session
  }

  const nextMatch = selectForMode(mode, eligible, round.suggestedIds, randomValue)
  if (!nextMatch && round.currentId === null) {
    return session
  }

  return updateRound(session, mode, appendSuggestion(round.suggestedIds, nextMatch))
}

export const refreshPantryRound = (session, matches) =>
  refreshRecommendationRound(session, 'pantry', matches, 0)

export const reconcileRecipeIds = (session, catalog, remappedRecipes) => {
  const validIds = new Set(catalog.map((recipe) => recipe.id))
  const resolveId = (id) => {
    const resolvedId = remappedRecipes?.get(id)?.id ?? id
    return validIds.has(resolvedId) ? resolvedId : null
  }

  let nextSession = session
  for (const [mode, round] of Object.entries(session.rounds)) {
    const currentId = resolveId(round.currentId)
    const suggestedIds = round.suggestedIds.map(resolveId).filter((id) => id !== null)
    if (currentId !== round.currentId || suggestedIds.length !== round.suggestedIds.length ||
        suggestedIds.some((id, index) => id !== round.suggestedIds[index])) {
      nextSession = updateRound(nextSession, mode, { currentId, suggestedIds })
    }
  }
  return nextSession
}
