import { useState } from 'react'
import { normalizeIngredientName, pantryCategories, pantryNameLimit } from '../utils/pantry.js'

const PantryForm = ({ ingredient, ingredients, onSave, onCancel }) => {
  const [name, setName] = useState(ingredient?.name ?? '')
  const [category, setCategory] = useState(ingredient?.category ?? '')
  const [isAvailable, setIsAvailable] = useState(true)
  const [error, setError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmedName = name.trim()
    const normalizedName = normalizeIngredientName(name)
    const isDuplicate = ingredients.some((item) =>
      item.id !== ingredient?.id && normalizeIngredientName(item.name) === normalizedName,
    )

    if (!trimmedName) {
      setError('Enter an ingredient name.')
      return
    }
    if (trimmedName.length > pantryNameLimit) {
      setError(`Use ${pantryNameLimit} characters or fewer for the ingredient name.`)
      return
    }
    if (!pantryCategories.includes(category)) {
      setError('Select a valid category.')
      return
    }
    if (isDuplicate) {
      setError('An ingredient with that name already exists.')
      return
    }

    const values = { name: trimmedName, category }
    if (ingredient) {
      onSave(values)
      return
    }

    onSave({ ...values, isAvailable })
    setName('')
    setCategory('')
    setIsAvailable(true)
    setError('')
  }

  return (
    <form className="pantry-form" aria-labelledby="ingredient-form-heading" onSubmit={handleSubmit}>
      <h2 id="ingredient-form-heading">{ingredient ? 'Edit ingredient' : 'Add an ingredient'}</h2>
      <div className="pantry-fields">
        <label>
          Ingredient name
          <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
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
      {error && <p className="pantry-error" role="alert">{error}</p>}
      <div className="pantry-actions">
        <button className="pantry-button pantry-primary" type="submit">
          {ingredient ? 'Save changes' : 'Add ingredient'}
        </button>
        <button className="pantry-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export default PantryForm
