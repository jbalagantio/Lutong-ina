import { recipeImages } from '../data/recipeImages.js'
import IngredientCoverage from './IngredientCoverage.jsx'
import RecipeImage, { RecipeImageCredit } from './RecipeImage.jsx'

const DiscoverRecipeCard = ({ match, onOpen }) => {
  const { recipe } = match

  return (
    <article className="discover-recipe">
      <div className="discover-recipe-opening">
        <RecipeImage recipe={recipe} layout="catalog" />
        <h2>
          <button className="discover-recipe-open" id={`discover-open-${recipe.id}`} type="button"
            aria-label={`Open ${recipe.name}`} onClick={() => onOpen(recipe.id)}>
            {recipe.name}
          </button>
        </h2>
      </div>
      <ul className="recipe-meta" aria-label="Recipe information">
        <li>{recipe.cookingTime} min</li>
        <li>{recipe.difficulty}</li>
      </ul>
      <IngredientCoverage match={match} />
      <RecipeImageCredit image={recipeImages[recipe.id]} />
    </article>
  )
}

export default DiscoverRecipeCard
