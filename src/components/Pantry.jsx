import { useState } from 'react'
import { normalizeIngredientName, pantryCategories } from '../utils/pantry.js'
import PantryForm from './PantryForm.jsx'

const Pantry = ({
  ingredients,
  onAddIngredient,
  onEditIngredient,
  onRemoveIngredient,
  onToggleAvailability,
}) => {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('')

  const availableCount = ingredients.filter((ingredient) => ingredient.isAvailable).length
  const outOfStockCount = ingredients.length - availableCount
  const searchTerm = normalizeIngredientName(search)
  const visibleIngredients = ingredients.filter((ingredient) => {
    const nameMatches = normalizeIngredientName(ingredient.name).includes(searchTerm)
    const categoryMatches = !categoryFilter || ingredient.category === categoryFilter
    const availability = ingredient.isAvailable ? 'available' : 'out-of-stock'
    const availabilityMatches = !availabilityFilter || availability === availabilityFilter
    return nameMatches && categoryMatches && availabilityMatches
  })
  const editingIngredient = ingredients.find((ingredient) => ingredient.id === editingId)

  const handleOpenAdd = () => {
    setEditingId(null)
    setIsAdding(true)
  }

  const handleOpenEdit = (id) => {
    setIsAdding(false)
    setEditingId(id)
  }

  const handleCloseForm = () => {
    setIsAdding(false)
    setEditingId(null)
  }

  const handleSaveEdit = (values) => {
    onEditIngredient(editingId, values)
    handleCloseForm()
  }

  const handleConfirmRemove = (ingredient) => {
    if (window.confirm(`Remove "${ingredient.name}" from your pantry?`)) {
      onRemoveIngredient(ingredient.id)
      if (editingId === ingredient.id) {
        handleCloseForm()
      }
    }
  }

  return (
    <section className="screen-panel pantry-panel" aria-labelledby="pantry-heading">
      <div className="pantry-header">
        <div>
          <h1 id="pantry-heading">My Pantry</h1>
          <p>Keep track of what you have on hand and what you’re out of.</p>
        </div>
        <button className="pantry-button pantry-primary" type="button" onClick={handleOpenAdd}>
          Add ingredient
        </button>
      </div>
      <ul className="pantry-counts" aria-label="Ingredient counts" aria-live="polite">
        <li className="pantry-available"><strong>{availableCount}</strong> available</li>
        <li><strong>{outOfStockCount}</strong> out of stock</li>
      </ul>
      {isAdding && <PantryForm key="add" ingredients={ingredients} onSave={onAddIngredient} onCancel={handleCloseForm} />}
      {editingIngredient && (
        <PantryForm
          key={editingIngredient.id}
          ingredient={editingIngredient}
          ingredients={ingredients}
          onSave={handleSaveEdit}
          onCancel={handleCloseForm}
        />
      )}
      <div className="pantry-fields pantry-filters" role="group" aria-label="Filter ingredients">
        <label>
          Search ingredients
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          Filter by category
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">All categories</option>
            {pantryCategories.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
        <label>
          Filter by availability
          <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="available">Available</option>
            <option value="out-of-stock">Out of stock</option>
          </select>
        </label>
      </div>
      {ingredients.length === 0 && (
        <p className="pantry-empty">Your pantry is empty. Add an ingredient to get started.</p>
      )}
      {ingredients.length > 0 && visibleIngredients.length === 0 && (
        <p className="pantry-empty" role="status">No ingredients match your search and filters.</p>
      )}
      {visibleIngredients.length > 0 && (
        <ul className="pantry-list" aria-label="Pantry ingredients">
          {visibleIngredients.map((ingredient) => {
            const status = ingredient.isAvailable ? 'Available' : 'Out of stock'
            const toggleLabel = ingredient.isAvailable ? 'Mark out of stock' : 'Mark available'

            return (
              <li className="pantry-item" key={ingredient.id}>
                <div>
                  <strong>{ingredient.name}</strong>
                  <p>
                    {ingredient.category} · <span className={ingredient.isAvailable ? 'pantry-available' : undefined}>{status}</span>
                  </p>
                </div>
                <div className="pantry-actions">
                  <button
                    className="pantry-button"
                    type="button"
                    aria-label={`${toggleLabel} for ${ingredient.name}`}
                    onClick={() => onToggleAvailability(ingredient.id)}
                  >
                    {toggleLabel}
                  </button>
                  <button
                    className="pantry-button"
                    type="button"
                    aria-label={`Edit ${ingredient.name}`}
                    onClick={() => handleOpenEdit(ingredient.id)}
                  >
                    Edit
                  </button>
                  <button
                    className="pantry-button"
                    type="button"
                    aria-label={`Remove ${ingredient.name}`}
                    onClick={() => handleConfirmRemove(ingredient)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default Pantry
