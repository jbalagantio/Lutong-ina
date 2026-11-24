import { useRef, useState } from 'react'
import { groceryStorageWarnings, groceryUnsavedWarning, planGroceryAddition } from '../utils/groceryList.js'

const RecipeGroceryAction = ({ match, pantryIngredients, groceryList, onAdd, onView }) => {
  const [lastAddition, setLastAddition] = useState(null)
  const feedback = useRef(null)
  const { recipe, missingIngredients, trackedCount } = match
  const { items } = groceryList
  const { names, alreadyListed, skipped } = planGroceryAddition(items, missingIngredients)
  const canView = alreadyListed.length > 0
  const warning = canView && groceryList.hasUnsavedChanges
    ? groceryStorageWarnings[groceryList.storageStatus]
    : null
  if (trackedCount === 0) return null

  let availabilityMessage = ''
  if (missingIngredients.length === 0) {
    availabilityMessage = 'All tracked ingredients are available.'
  } else if (names.length === 0) {
    if (canView && skipped.length === 0) {
      availabilityMessage = 'Missing ingredients are already on your grocery list.'
    } else {
      availabilityMessage = 'No missing ingredients can be added.'
    }
  }

  // Keep the confirmation only while the recipe, pantry, and resulting list still match the addition.
  const sameInputs = lastAddition?.recipe === recipe &&
    lastAddition.pantryIngredients === pantryIngredients && lastAddition.items === items
  const message = sameInputs ? lastAddition.message : availabilityMessage

  const handleAdd = () => {
    const operation = onAdd(recipe.id)
    const { added, listed, skipped: skippedCount, error } = operation
    let message = error ?? 'No grocery items added.'
    if (added > 0) {
      message = `Added ${added} ${added === 1 ? 'item' : 'items'} to Grocery List.`
      if (listed > 0) message += ` ${listed} already listed.`
    } else if (listed > 0) {
      message = 'Missing ingredients are already on your grocery list.'
    }
    if (skippedCount > 0) message += ` ${skippedCount} skipped.`
    setLastAddition({ recipe, pantryIngredients, items: operation.items ?? items, message })
    feedback.current?.focus()
  }

  return (
    <div className="recipe-grocery">
      <p className="recipe-grocery-feedback" role="status" tabIndex={-1} ref={feedback}>{message}</p>
      {warning && <p className="pantry-error" role="alert">{warning} {groceryUnsavedWarning}</p>}
      <div className="pantry-actions">
        {names.length > 0 && (
          <button className="pantry-button pantry-primary" type="button" onClick={handleAdd}>
            Add {names.length} missing {names.length === 1 ? 'ingredient' : 'ingredients'}
          </button>
        )}
        {canView && <button className="pantry-button" type="button" onClick={onView}>View grocery list</button>}
      </div>
    </div>
  )
}

export default RecipeGroceryAction
