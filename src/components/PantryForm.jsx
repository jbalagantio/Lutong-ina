import { useRef, useState } from 'react'
import { pantryCategories, pantryNameLimit, wouldDuplicateIngredient } from '../utils/pantry.js'

const PantryForm = ({ ingredient, ingredients, onSave, onCancel }) => {
  const [name, setName] = useState(ingredient?.name ?? '')
  const [category, setCategory] = useState(ingredient?.category ?? '')
  const [isAvailable, setIsAvailable] = useState(true)
  const [error, setError] = useState(null)
  const nameInput = useRef(null)
  const categoryInput = useRef(null)

  const showError = (field, message) => {
    setError({ field, message })
    const input = field === 'name' ? nameInput : categoryInput
    input.current?.focus()
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmedName = name.trim()

    if (!trimmedName) {
      showError('name', 'Enter an ingredient name.')
      return
    }
    if (trimmedName.length > pantryNameLimit) {
      showError('name', `Use ${pantryNameLimit} characters or fewer for the ingredient name.`)
      return
    }
    if (!pantryCategories.includes(category)) {
      showError('category', 'Select a valid category.')
      return
    }
    if (wouldDuplicateIngredient(trimmedName, ingredients, ingredient)) {
      showError('name', 'That ingredient is already in your pantry.')
      return
    }

    const savedName = ingredient && name === ingredient.name ? name : trimmedName
    const values = { name: savedName, category }
    if (ingredient) {
      onSave(values)
      return
    }

    onSave({ ...values, isAvailable })
    setName('')
    setCategory('')
    setIsAvailable(true)
    setError(null)
  }

  return (
    <form className="pantry-form" aria-labelledby="ingredient-form-heading" onSubmit={handleSubmit} noValidate>
      <h2 id="ingredient-form-heading">{ingredient ? 'Edit ingredient' : 'Add ingredient'}</h2>
      <div className="pantry-fields">
        <label>
          Ingredient name
          <input ref={nameInput} value={name} required autoFocus
            aria-invalid={error?.field === 'name' || undefined}
            aria-describedby={error?.field === 'name' ? 'ingredient-form-error' : undefined}
            onChange={(event) => {
              setName(event.target.value)
              if (error?.field === 'name') setError(null)
            }} />
        </label>
        <label>
          Category
          <select ref={categoryInput} value={category} required
            aria-invalid={error?.field === 'category' || undefined}
            aria-describedby={error?.field === 'category' ? 'ingredient-form-error' : undefined}
            onChange={(event) => {
              setCategory(event.target.value)
              if (error?.field === 'category') setError(null)
            }}>
            <option value="">Choose a category</option>
            {pantryCategories.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      {!ingredient && (
        <label className="pantry-checkbox">
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(event) => setIsAvailable(event.target.checked)}
          />
          Available
        </label>
      )}
      {error && <p id="ingredient-form-error" className="pantry-error" role="alert">{error.message}</p>}
      <div className="pantry-actions">
        <button className="pantry-button pantry-primary" type="submit">
          {ingredient ? 'Save changes' : 'Add'}
        </button>
        <button className="pantry-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export default PantryForm
