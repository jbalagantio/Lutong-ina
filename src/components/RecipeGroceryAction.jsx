import { useRef, useState } from 'react'
import { groceryStorageWarnings, groceryUnsavedWarning, planGroceryAddition } from '../utils/groceryList.js'

const RecipeGroceryAction = ({ match, groceryList, onAdd, onView }) => {
  const [result, setResult] = useState(null)
  const feedback = useRef(null)
  const { names, alreadyListed, skipped } = planGroceryAddition(groceryList.items, match.missingIngredients)
  const warning = groceryList.hasUnsavedChanges && (alreadyListed.length > 0 || result?.added > 0)
    ? groceryStorageWarnings[groceryList.storageStatus]
    : null
  const canView = alreadyListed.length > 0 || result?.added > 0 || Boolean(warning)
  let message = ''
  if (result) {
    const { added, listed, skipped, error } = result
    if (error) message = error
    else if (added > 0) message = `Added ${added} ${added === 1 ? 'item' : 'items'} to Grocery List.`
    else if (listed > 0) message = 'Missing ingredients are already on your grocery list.'
    else message = 'No grocery items added.'
    if (added > 0 && listed > 0) message += ` ${listed} already listed.`
    if (skipped > 0) message += ` ${skipped} skipped.`
  } else if (match.trackedCount === 0) {
    return null
  } else if (match.missingIngredients.length === 0) {
    message = 'All tracked ingredients are available.'
  } else if (names.length === 0) {
    if (alreadyListed.length > 0 && skipped.length === 0) {
      message = 'Missing ingredients are already on your grocery list.'
    } else {
      message = 'No missing ingredients can be added.'
    }
  }

  const handleAdd = () => {
    const operation = onAdd(match.recipe.id)
    setResult(operation)
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
