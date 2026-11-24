import { useRef, useState } from 'react'
import { pantryCategories } from '../utils/pantry.js'

const GroceryItemForm = ({ item, onSave, onCancel, onDraftChange }) => {
  const initialName = item?.name ?? ''
  const initialCategory = item?.category ?? ''
  const [name, setName] = useState(initialName)
  const [category, setCategory] = useState(initialCategory)
  const [error, setError] = useState(null)
  const nameInput = useRef(null)
  const categoryInput = useRef(null)

  const handleNameChange = (event) => {
    const nextName = event.target.value
    setName(nextName)
    onDraftChange(nextName !== initialName || category !== initialCategory)
    if (error?.field === 'name') setError(null)
  }

  const handleCategoryChange = (event) => {
    const nextCategory = event.target.value
    setCategory(nextCategory)
    onDraftChange(name !== initialName || nextCategory !== initialCategory)
    if (error?.field === 'category') setError(null)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const result = onSave({ name, category })
    if (!result.error) return

    setError(result)
    const input = result.field === 'category' ? categoryInput : nameInput
    input.current?.focus()
  }

  return (
    <form className="pantry-form" aria-labelledby="grocery-form-heading" onSubmit={handleSubmit} noValidate>
      <h3 id="grocery-form-heading">{item ? 'Edit item' : 'Add item'}</h3>
      <div className="pantry-fields">
        <label>
          Item name
          <input ref={nameInput} value={name} required autoFocus onChange={handleNameChange}
            aria-invalid={error?.field === 'name' || undefined}
            aria-describedby={error?.field === 'name' ? 'grocery-form-error' : undefined} />
        </label>
        <label>
          Category
          <select ref={categoryInput} value={category} required onChange={handleCategoryChange}
            aria-invalid={error?.field === 'category' || undefined}
            aria-describedby={error?.field === 'category' ? 'grocery-form-error' : undefined}>
            <option value="">Choose a category</option>
            {pantryCategories.map((entry) => <option key={entry}>{entry}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="pantry-error" id="grocery-form-error" role="alert">{error.error}</p>}
      <div className="pantry-actions">
        <button className="pantry-button pantry-primary" type="submit">{item ? 'Save changes' : 'Add'}</button>
        <button className="pantry-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export default GroceryItemForm
