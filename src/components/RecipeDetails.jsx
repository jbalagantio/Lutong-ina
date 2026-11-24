import { getRecipeIngredientStatuses } from '../utils/discover.js'
import IngredientCoverage from './IngredientCoverage.jsx'
import RecipeImage from './RecipeImage.jsx'

const RecipeDetails = ({ recipe, match, headingRef }) => {
  const ingredientStatuses = getRecipeIngredientStatuses(match)

  return (
    <article className="recipe-details" aria-labelledby="recipe-detail-heading">
      <div className="recipe-detail-overview">
        <header>
          <h1 id="recipe-detail-heading" ref={headingRef} tabIndex={-1}>{recipe.name}</h1>
          <ul className="recipe-meta" aria-label="Recipe information">
            <li>{recipe.cuisine}</li>
            <li>{recipe.cookingTime} min</li>
            <li>{recipe.difficulty}</li>
            <li>{recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}</li>
          </ul>
          {recipe.description && <p>{recipe.description}</p>}
        </header>
        <RecipeImage recipe={recipe} eager showCredit />
      </div>
      <div className="recipe-detail-body">
        <section aria-labelledby="recipe-detail-ingredients">
          <h2 id="recipe-detail-ingredients">Ingredients</h2>
          <IngredientCoverage match={match} showDetails />
          <p className="recipe-detail-availability-note">Availability checks whether an ingredient is in stock, regardless of quantity.</p>
          <ul className="recipe-detail-ingredients" role="list">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index}>
                <span>{ingredient.quantity} {ingredient.unit}</span>{' '}
                <span>{ingredient.name}</span>
                <span className="ingredient-status" data-status={ingredientStatuses[index]}>{ingredientStatuses[index]}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="recipe-detail-instructions">
          <h2 id="recipe-detail-instructions">Instructions</h2>
          <ol className="recipe-detail-instructions">
            {recipe.instructions.map((step, index) => <li key={index}>{step}</li>)}
          </ol>
        </section>
      </div>
    </article>
  )
}

export default RecipeDetails
