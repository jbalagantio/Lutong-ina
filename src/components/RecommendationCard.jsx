import RecipeImage from './RecipeImage.jsx'

const RecommendationCard = ({ match, recipeActions }) => {
  const { recipe, matchedIngredients, missingIngredients, matchedCount, trackedCount, matchPercentage } = match
  const { daysSinceCooked, cookedInFuture } = match
  let historyLabel = ''
  if (daysSinceCooked != null && !cookedInFuture) {
    if (daysSinceCooked === 0) historyLabel = 'Cooked today'
    else if (daysSinceCooked === 1) historyLabel = 'Cooked yesterday'
    else historyLabel = `Last cooked ${daysSinceCooked} days ago`
  }

  return (
    <article className="recommendation-card" aria-labelledby="recipe-heading">
      <RecipeImage recipe={recipe} eager showCredit />
      <h2 id="recipe-heading">{recipe.name}</h2>
      <ul className="recipe-meta" aria-label="Recipe information">
        <li>{recipe.cookingTime} min</li>
        <li>{recipe.difficulty}</li>
        <li>{recipe.servings} servings</li>
        {historyLabel && <li>{historyLabel}</li>}
      </ul>
      <p>{recipe.description}</p>
      {trackedCount > 0 ? (
        <p className="recommendation-match">
          {matchedCount} of {trackedCount} ingredients<span className="visually-hidden"> available</span>
          {' · '}<strong>{Math.round(matchPercentage)}%<span className="visually-hidden"> match</span></strong>
        </p>
      ) : (
        <p>No tracked ingredients.</p>
      )}
      <div className="recommendation-ingredients">
        <div>
          <h3>Available</h3>
          {matchedIngredients.length > 0 ? (
            <ul>{matchedIngredients.map((ingredient) => <li key={ingredient.name}>{ingredient.name}</li>)}</ul>
          ) : (
            <p>None</p>
          )}
        </div>
        <div>
          <h3>Missing</h3>
          {missingIngredients.length > 0 ? (
            <ul>{missingIngredients.map((ingredient) => <li key={ingredient.name}>{ingredient.name}</li>)}</ul>
          ) : (
            <p>None</p>
          )}
        </div>
      </div>
      {recipeActions}
    </article>
  )
}

export default RecommendationCard
