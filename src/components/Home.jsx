import RecommendationCard from './RecommendationCard.jsx'

const cookingOptions = [
  {
    id: 'pantry',
    title: 'Use what I have',
    icon: 'M4 7h16v13H4z M3 4h18v3H3z M9 12h6',
  },
  {
    id: 'shopping',
    title: "I'll go grocery shopping",
    icon: 'M3 9h18l-2 10H5z M8 9l4-5 4 5 M9 13v3 M15 13v3',
  },
  {
    id: 'new',
    title: 'Something new',
    icon: 'M11 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z M19 15v6 M16 18h6',
  },
]

const Home = ({ ingredients, mode, round, eligibleMatches, isFamiliarFallback, onSelectMode, onSuggestionAction, onOpenPantry, renderRecipeActions }) => {
  const currentMatch = eligibleMatches.find((match) => match.recipe.id === round?.currentId)
  const hasMore = eligibleMatches.some((match) => !round.suggestedIds.includes(match.recipe.id))

  let emptyMessage = 'No recipes available.'

  if (mode === 'pantry') {
    if (ingredients.length === 0) {
      emptyMessage = 'Your pantry is empty.'
    } else if (!ingredients.some((ingredient) => ingredient.isAvailable === true)) {
      emptyMessage = 'All pantry ingredients are out of stock.'
    } else {
      emptyMessage = 'No recipes match your pantry.'
    }
  }

  const isExhausted = eligibleMatches.length > 0 && !hasMore
  const canRestart = isExhausted && (eligibleMatches.length > 1 || !currentMatch)
  let suggestionStatus = ''
  if (currentMatch && eligibleMatches.length === 1) {
    suggestionStatus = 'Only one dish available in this mode.'
  } else if (isExhausted) {
    suggestionStatus = 'You’ve seen all the recipes in this round.'
  }

  const showEmptyState = !currentMatch && eligibleMatches.length === 0
  const fallbackMessage = isFamiliarFallback ? 'All recipes are marked familiar. Showing the full catalog.' : ''
  let announcement = ''
  if (currentMatch) {
    announcement = `${currentMatch.recipe.name}. ${suggestionStatus}`
  } else if (mode && showEmptyState) {
    announcement = emptyMessage
  } else if (suggestionStatus) {
    announcement = suggestionStatus
  }
  const statusAnnouncement = [announcement, fallbackMessage].filter(Boolean).join(' ')

  return (
    <div className="home-layout">
      <section aria-labelledby="home-heading">
        <h1 id="home-heading" tabIndex={-1}>What should I <em>cook</em> today?</h1>
        <ul className="option-list">
          {cookingOptions.map((option) => (
            <li key={option.id}>
              <button
                className={`option-card option-${option.id}`}
                type="button"
                aria-pressed={mode === option.id}
                onClick={() => onSelectMode(option.id)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={option.icon} />
                </svg>
                <span>{option.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="visually-hidden" role="status">{statusAnnouncement}</p>
      {!mode && (
        <div className="suggestion-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10h18M7 10V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M12 6V4m-7 6v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6M2 13h3m14 0h3" />
          </svg>
          <p>What's cooking?</p>
        </div>
      )}
      {mode && (
        <div className="suggestion-panel">
          {currentMatch && <RecommendationCard match={currentMatch} recipeActions={renderRecipeActions(currentMatch)} />}
          {fallbackMessage && <p className="suggestion-status">{fallbackMessage}</p>}
          {showEmptyState && (
            <div className="suggestion-empty">
              <p>{emptyMessage}</p>
              {mode === 'pantry' && (
                <div className="pantry-actions">
                  <button className="pantry-button" type="button" onClick={onOpenPantry}>Open Pantry</button>
                  <button className="pantry-button" type="button" onClick={() => onSelectMode('shopping')}>
                    Try grocery mode
                  </button>
                </div>
              )}
            </div>
          )}
          {suggestionStatus && <p className="suggestion-status">{suggestionStatus}</p>}
          {(hasMore || canRestart) && (
            <button
              className="pantry-button pantry-primary suggestion-action"
              type="button"
              onClick={() => onSuggestionAction(canRestart)}
            >
              {hasMore ? 'Suggest another' : 'Restart suggestions'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default Home
