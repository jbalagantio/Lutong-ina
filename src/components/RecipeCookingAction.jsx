import { useRef, useState } from 'react'
import { cookingHistoryWarnings, historyUnsavedWarning } from '../utils/cookingHistory.js'

const RecipeCookingAction = ({ recipe, history, onRecord, onView }) => {
  const [lastRecord, setLastRecord] = useState(null)
  const [error, setError] = useState('')
  const recorded = useRef(null)
  const feedback = useRef(null)
  const currentRecord = lastRecord?.recipeName === recipe.name && history.records.includes(lastRecord)
    ? lastRecord
    : null
  const pendingRecipe = currentRecord && history.pendingRecordIds?.has(currentRecord.id)
  const warning = cookingHistoryWarnings[history.storageStatus]
  let message = error
  if (currentRecord) {
    message = 'Recorded in Cooking History.'
    if (pendingRecipe) message = 'Recorded in memory. Recover My Dishes to save this meal.'
    else if (!history.persistedRecordIds.has(currentRecord.id)) message = 'Recorded in memory.'
  }

  const recordCooking = (event) => {
    // A second activation before React updates the button is part of the first action.
    if (event.detail > 1 || recorded.current !== lastRecord) return
    if (currentRecord && !window.confirm(`Record another meal of "${recipe.name}"?`)) return
    const record = onRecord(recipe.id)
    if (record) {
      recorded.current = record
      setLastRecord(record)
      setError('')
    } else {
      setError('This recipe is no longer available.')
    }
    feedback.current?.focus()
  }

  return (
    <div className="recipe-cooking">
      <p className="recipe-grocery-feedback" role="status" tabIndex={-1} ref={feedback}>{message}</p>
      {warning && <p className="pantry-error" role="alert">{warning} {(history.hasUnsavedChanges || pendingRecipe) && historyUnsavedWarning}</p>}
      {!warning && pendingRecipe && <p className="pantry-error" role="alert">{historyUnsavedWarning}</p>}
      <div className="pantry-actions">
        <button className="pantry-button" type="button" onClick={recordCooking}>
          {currentRecord ? 'Record another meal' : 'Mark as cooked'}
        </button>
        {(currentRecord || warning) && <button className="pantry-button" type="button" onClick={onView}>View Cooking History</button>}
      </div>
    </div>
  )
}

export default RecipeCookingAction
