import { recipeImages } from '../data/recipeImages.js'
import IngredientCoverage from './IngredientCoverage.jsx'
import RecipeImage, { RecipeImageCredit } from './RecipeImage.jsx'

const DiscoverRecipeCard = ({ match, isSaved, onOpen, onToggleSaved }) => {
  const { recipe } = match
  const saveLabel = isSaved ? `Remove ${recipe.name} from My Dishes` : `Save ${recipe.name} to My Dishes`

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
        <button className="icon-button dish-preference discover-bookmark" type="button"
          aria-label={saveLabel} aria-pressed={isSaved} title={saveLabel}
          onClick={() => onToggleSaved(recipe.id, !isSaved)}>
          <svg viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 4h12v16l-6-4-6 4z" />
          </svg>
        </button>
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
