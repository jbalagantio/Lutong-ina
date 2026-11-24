import { useState } from 'react'
import recipes from '../data/recipes.js'
import {
  compareRecipeIngredients,
  getAvailableIngredientNames,
  rankPantryRecommendations,
  selectNextRecommendation,
} from '../utils/recommendations.js'
import RecommendationCard from './RecommendationCard.jsx'

const cookingOptions = [
  {
    id: 'pantry',
    title: 'Use what I have',
    description: 'Find the best match for your pantry.',
    symbol: '\u25a4',
  },
  {
    id: 'shopping',
    title: "I'll go grocery shopping",
    description: 'Find a dish you can shop for.',
    symbol: '+',
  },
  {
    id: 'new',
    title: 'Something new',
    description: 'Explore dishes from the recipe collection.',
    symbol: '\u2726',
  },
]

const Home = ({ ingredients, onOpenPantry }) => {
  const [mode, setMode] = useState(null)
  const [suggestedIds, setSuggestedIds] = useState([])

  const availableNames = getAvailableIngredientNames(ingredients)
  const recipeMatches = recipes.map((recipe) => compareRecipeIngredients(recipe, availableNames))
  const pantryMatches = rankPantryRecommendations(recipeMatches)
  const eligibleMatches = mode === 'pantry' ? pantryMatches : recipeMatches
  const currentId = suggestedIds.at(-1)
  const currentMatch = eligibleMatches.find((match) => match.recipe.id === currentId)
  const hasMore = eligibleMatches.some((match) => !suggestedIds.includes(match.recipe.id))

  const handleSelectMode = (nextMode) => {
    if (nextMode === mode) {
      return
    }

    const matches = nextMode === 'pantry' ? pantryMatches : recipeMatches
    const firstMatch = selectNextRecommendation(matches, [], nextMode !== 'pantry')
    setMode(nextMode)
    setSuggestedIds(firstMatch ? [firstMatch.recipe.id] : [])
  }

  const handleNextSuggestion = () => {
    const nextMatch = selectNextRecommendation(eligibleMatches, suggestedIds, mode !== 'pantry')
    if (nextMatch) {
      setSuggestedIds((previousIds) => [...previousIds, nextMatch.recipe.id])
    }
  }

  const handleRestart = () => {
    // Random modes start a new round with a dish different from the one on screen.
    const excludedIds = mode === 'pantry' ? [] : [currentId]
    const firstMatch = selectNextRecommendation(eligibleMatches, excludedIds, mode !== 'pantry')
    setSuggestedIds(firstMatch ? [firstMatch.recipe.id] : [])
  }

  let emptyTitle = 'How would you like to cook today?'
  let emptyMessage = 'Choose a cooking mode to get a recipe suggestion.'

  if (mode === 'pantry') {
    emptyTitle = 'No suitable pantry recipes found'
    if (ingredients.length === 0) {
      emptyMessage = 'Your pantry is empty. Add ingredients or try grocery shopping mode.'
    } else if (availableNames.size === 0) {
      emptyMessage = 'Everything in your pantry is out of stock. Update availability or try grocery shopping mode.'
    } else {
      emptyMessage = 'None of your available ingredients match a recipe. Add ingredients or try grocery shopping mode.'
    }
  } else if (mode) {
    emptyTitle = 'No recipes available'
    emptyMessage = 'The recipe collection has no dishes to suggest.'
  }

  let suggestionStatus = ''
  if (currentMatch && eligibleMatches.length === 1) {
    suggestionStatus = 'This is the only eligible dish for this mode.'
  } else if (mode && eligibleMatches.length > 0 && !hasMore) {
    suggestionStatus = 'You’ve seen every eligible dish in this round.'
  }

  return (
    <div className="home-layout">
      <section aria-labelledby="home-heading">
        <h1 id="home-heading">What should I <em>cook</em> today?</h1>
        <p className="intro-text">
          Choose a cooking mode to find a dish for today.
        </p>
        <ul className="option-list">
          {cookingOptions.map((option) => (
            <li key={option.id}>
              <button
                className={`option-card option-${option.id}`}
                type="button"
                aria-pressed={mode === option.id}
                onClick={() => handleSelectMode(option.id)}
              >
                <span className="option-symbol" aria-hidden="true">{option.symbol}</span>
                <span className="option-title">{option.title}</span>
                <span className="option-description">{option.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="suggestion-panel" aria-labelledby="suggestion-heading">
        <h2 id="suggestion-heading">Today&rsquo;s Suggestion</h2>
        <p className="suggestion-announcement" role="status">
          {currentMatch ? `${currentMatch.recipe.name}. ${suggestionStatus}` : `${emptyTitle}. ${emptyMessage}`}
        </p>
        {currentMatch && <RecommendationCard match={currentMatch} mode={mode} />}
        {!currentMatch && (mode !== 'pantry' || eligibleMatches.length === 0) && (
          <div className="suggestion-empty">
            <span className="empty-mark" aria-hidden="true">&#9832;</span>
            <p className="empty-title">{emptyTitle}</p>
            <p>{emptyMessage}</p>
            {mode === 'pantry' && (
              <button className="suggestion-action" type="button" onClick={onOpenPantry}>Open Pantry</button>
            )}
          </div>
        )}
        {suggestionStatus && <p className="suggestion-status">{suggestionStatus}</p>}
        {mode && (eligibleMatches.length > 1 || (!currentMatch && hasMore)) && (
          <button
            className="suggestion-action"
            type="button"
            onClick={hasMore ? handleNextSuggestion : handleRestart}
          >
            {hasMore ? 'Suggest another dish' : 'Restart suggestions'}
          </button>
        )}
      </section>
    </div>
  )
}

export default Home
