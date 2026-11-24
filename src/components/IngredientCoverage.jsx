const IngredientCoverage = ({ match, showDetails = false }) => {
  const { recipe, matchedCount, trackedCount, matchPercentage, missingIngredients } = match

  if (trackedCount === 0) {
    return <p className="ingredient-coverage">No tracked ingredients.</p>
  }

  return (
    <div className="ingredient-coverage">
      {showDetails ? (
        <p>{Math.round(matchPercentage)}% coverage · {matchedCount} available · {missingIngredients.length} missing</p>
      ) : (
        <p>{matchedCount} of {trackedCount} ingredients available</p>
      )}
      <progress aria-label={`Ingredient coverage for ${recipe.name}`} value={matchedCount} max={trackedCount} />
    </div>
  )
}

export default IngredientCoverage
