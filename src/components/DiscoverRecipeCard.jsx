import { recipeImages } from '../data/recipeImages.js'
import RecipeImage, { RecipeImageCredit } from './RecipeImage.jsx'

const DiscoverRecipeCard = ({ recipe }) => (
  <article className="discover-recipe">
    <RecipeImage recipe={recipe} layout="catalog" />
    <h2>{recipe.name}</h2>
    <ul className="recipe-meta" aria-label="Recipe information">
      <li>{recipe.cookingTime} min</li>
      <li>{recipe.difficulty}</li>
    </ul>
    <RecipeImageCredit image={recipeImages[recipe.id]} />
  </article>
)

export default DiscoverRecipeCard
