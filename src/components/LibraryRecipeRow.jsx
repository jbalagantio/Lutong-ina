import RecipeImage, { RecipeImageCredit } from './RecipeImage.jsx'
import { recipeImages } from '../data/recipeImages.js'

const LibraryRecipeRow = ({ recipe, isExpanded, onToggleDetails, groceryAction, children }) => (
  <li className="personal-recipe">
    <div className="dishes-header">
      <div className="dish-photo-summary">
        <RecipeImage recipe={recipe} layout="thumbnail" />
        <div className="personal-recipe-summary">
          <h2>{recipe.name}</h2>
          <ul className="recipe-meta" aria-label="Recipe information">
            <li>{recipe.cookingTime} min</li>
            <li>{recipe.difficulty}</li>
            <li>{recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}</li>
          </ul>
        </div>
      </div>
      <div className="pantry-actions">
        <button
          className="pantry-button"
          type="button"
          aria-label={`${isExpanded ? 'Hide' : 'View'} ${recipe.name}`}
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? 'personal-recipe-details' : undefined}
          onClick={onToggleDetails}
        >
          {isExpanded ? 'Hide' : 'View'}
        </button>
        {children}
      </div>
    </div>
    {isExpanded && (
      <div className="personal-recipe-details" id="personal-recipe-details">
        <RecipeImageCredit image={recipeImages[recipe.id]} />
        <p className="recipe-cuisine">{recipe.cuisine}</p>
        {recipe.description && <p>{recipe.description}</p>}
        <h3>Ingredients</h3>
        <ul>
          {recipe.ingredients.map((ingredient, index) => (
            <li key={index}>{ingredient.quantity} {ingredient.unit} {ingredient.name}</li>
          ))}
        </ul>
        {groceryAction}
        <h3>Instructions</h3>
        <ol>
          {recipe.instructions.map((step, index) => <li key={index}>{step}</li>)}
        </ol>
      </div>
    )}
  </li>
)

export default LibraryRecipeRow
