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

export const getRecipeMatches = (recipes, ingredients) => {
  const availableNames = getAvailableIngredientNames(ingredients)
  return recipes.map((recipe) => compareRecipeIngredients(recipe, availableNames))
}

export const getEligibleRecommendations = (mode, matches) => {
  return mode === 'pantry' ? rankPantryRecommendations(matches) : matches
}

export const selectNextRecommendation = (matches, suggestedIds, randomValue = 0) => {
  const remainingMatches = matches.filter((match) => !suggestedIds.includes(match.recipe.id))
  if (remainingMatches.length === 0) {
    return null
  }
  const randomIndex = Math.floor(randomValue * remainingMatches.length)
  return remainingMatches[randomIndex]
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

export const selectCookingMode = (session, mode, matches, randomValue) => {
  if (mode === session.mode) {
    return session
  }

  const nextSession = { ...session, mode }
  if (session.rounds[mode]) {
    if (mode === 'pantry') {
      return refreshPantryRound(nextSession, matches)
    }
    return nextSession
  }

  const eligible = getEligibleRecommendations(mode, matches)
  const match = selectNextRecommendation(eligible, [], mode === 'pantry' ? 0 : randomValue)
  return updateRound(nextSession, mode, appendSuggestion([], match))
}

export const advanceRecommendationSession = (session, matches, randomValue, restart) => {
  const { mode } = session
  const round = session.rounds[mode]
  if (!round) {
    return session
  }

  const eligible = getEligibleRecommendations(mode, matches)
  const selectionValue = mode === 'pantry' ? 0 : randomValue
  if (!restart) {
    const nextMatch = selectNextRecommendation(eligible, round.suggestedIds, selectionValue)
    return nextMatch ? updateRound(session, mode, appendSuggestion(round.suggestedIds, nextMatch)) : session
  }

  const hasUnseen = eligible.some((match) => !round.suggestedIds.includes(match.recipe.id))
  if (hasUnseen || eligible.length === 0 || (eligible.length === 1 && round.currentId)) {
    return session
  }

  const excludedIds = mode !== 'pantry' && eligible.length > 1 ? [round.currentId] : []
  const firstMatch = selectNextRecommendation(eligible, excludedIds, selectionValue)
  return updateRound(session, mode, appendSuggestion([], firstMatch))
}

export const refreshPantryRound = (session, matches) => {
  const round = session.rounds.pantry
  if (!round) {
    return session
  }

  const eligible = rankPantryRecommendations(matches)
  if (eligible.some((match) => match.recipe.id === round.currentId)) {
    return session
  }

  const nextMatch = selectNextRecommendation(eligible, round.suggestedIds)
  if (!nextMatch && round.currentId === null) {
    return session
  }

  return updateRound(session, 'pantry', appendSuggestion(round.suggestedIds, nextMatch))
}
