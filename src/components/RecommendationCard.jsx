const RecommendationCard = ({ match, mode }) => {
  const { recipe, matchedIngredients, missingIngredients, matchedCount, trackedCount, matchPercentage } = match
  let explanation = 'Try something different today.'

  if (mode === 'shopping') {
    explanation = 'Plan your grocery trip around the ingredients marked as missing.'
  } else if (mode === 'pantry') {
    if (matchedCount === trackedCount) {
      explanation = 'Your pantry lists all the tracked ingredients as available.'
    } else {
      explanation = 'This dish uses ingredients you have, and the list below shows what you still need.'
    }
  }

  return (
    <article className="recommendation-card" aria-label={recipe.name}>
      <h3>{recipe.name}</h3>
      <p>{recipe.description}</p>
      <ul className="recipe-meta" aria-label="Recipe information">
        <li>{recipe.cookingTime} min</li>
        <li>{recipe.difficulty}</li>
        <li>{recipe.servings} servings</li>
      </ul>
      {trackedCount > 0 ? (
        <p className="recommendation-match">
          <strong>{Math.round(matchPercentage)}% ingredient match</strong>
          <span>{matchedCount} of {trackedCount} tracked ingredients available</span>
        </p>
      ) : (
        <p>No tracked ingredients to match (0 available of 0 tracked).</p>
      )}
      <p>{explanation}</p>
      <div className="recommendation-ingredients">
        <div>
          <h4>Available ingredients</h4>
          {matchedIngredients.length > 0 ? (
            <ul>{matchedIngredients.map((ingredient) => <li key={ingredient.name}>{ingredient.name}</li>)}</ul>
          ) : (
            <p>None marked available.</p>
          )}
        </div>
        <div>
          <h4>Missing ingredients</h4>
          {missingIngredients.length > 0 ? (
            <ul>{missingIngredients.map((ingredient) => <li key={ingredient.name}>{ingredient.name}</li>)}</ul>
          ) : (
            <p>No tracked ingredients missing.</p>
          )}
        </div>
      </div>
    </article>
  )
}

export default RecommendationCard
