import { useRef, useState } from 'react'
import { matchesIngredientSearch, normalizeIngredientName, pantryCategories } from '../utils/pantry.js'
import GroceryList from './GroceryList.jsx'
import PantryForm from './PantryForm.jsx'

const Pantry = ({
  ingredients,
  onAddIngredient,
  onEditIngredient,
  onRemoveIngredient,
  onToggleAvailability,
  groceryList,
  onRetryGroceryList,
  onReplaceGroceryList,
  onSaveGroceryItem,
  onRemoveGroceryItem,
  onGroceryDraftChange,
}) => {
  const [activeView, setActiveView] = useState('ingredients')
  const showIngredients = activeView === 'ingredients'
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('')
  const addButton = useRef(null)
  const formTrigger = useRef(null)
  const availabilitySelect = useRef(null)

  const availableCount = ingredients.filter((ingredient) => ingredient.isAvailable).length
  const outOfStockCount = ingredients.length - availableCount
  const searchTerm = normalizeIngredientName(search)
  const matchesFilters = (ingredient) => {
    const nameMatches = matchesIngredientSearch(ingredient.name, searchTerm)
    const categoryMatches = !categoryFilter || ingredient.category === categoryFilter
    const availability = ingredient.isAvailable ? 'available' : 'out-of-stock'
    const availabilityMatches = !availabilityFilter || availability === availabilityFilter
    return nameMatches && categoryMatches && availabilityMatches
  }
  const visibleIngredients = ingredients.filter(matchesFilters)
  const editingIngredient = ingredients.find((ingredient) => ingredient.id === editingId)

  const handleOpenAdd = (event) => {
    formTrigger.current = event.currentTarget
    setEditingId(null)
    setIsAdding(true)
  }

  const handleOpenEdit = (id, event) => {
    formTrigger.current = event.currentTarget
    setIsAdding(false)
    setEditingId(id)
  }

  const handleCloseForm = (focusTarget = formTrigger.current) => {
    setIsAdding(false)
    setEditingId(null)
    const nextFocus = focusTarget?.isConnected ? focusTarget : addButton.current
    nextFocus?.focus()
    formTrigger.current = null
  }

  const handleSaveEdit = (values) => {
    const updatedIngredient = { ...editingIngredient, ...values }
    onEditIngredient(editingId, values)
    handleCloseForm(matchesFilters(updatedIngredient) ? formTrigger.current : addButton.current)
  }

  const handleConfirmRemove = (ingredient) => {
    if (window.confirm(`Remove "${ingredient.name}" from your pantry?`)) {
      onRemoveIngredient(ingredient.id)
      if (editingId === ingredient.id) {
        handleCloseForm(addButton.current)
      } else {
        addButton.current?.focus()
      }
    }
  }

  const handleToggleAvailability = (id) => {
    onToggleAvailability(id)
    if (availabilityFilter) {
      availabilitySelect.current?.focus()
    }
  }

  return (
    <section className="pantry-panel" aria-labelledby="pantry-heading">
      <div className="pantry-header">
        <h1 id="pantry-heading" tabIndex={-1}>My Pantry</h1>
        <button ref={addButton} hidden={!showIngredients} className="pantry-button pantry-primary" type="button" onClick={handleOpenAdd}>
          Add ingredient
        </button>
      </div>
      <div className="pantry-actions pantry-views" role="group" aria-label="Pantry views">
        <button className="pantry-button" type="button" aria-pressed={showIngredients}
          onClick={() => setActiveView('ingredients')}>Ingredients</button>
        <button className="pantry-button" type="button" aria-pressed={!showIngredients}
          onClick={() => setActiveView('grocery')}>Grocery List</button>
      </div>
      <div hidden={!showIngredients}>
        <ul className="pantry-counts" aria-label="Ingredient counts" aria-live="polite">
          <li className="pantry-available"><strong>{availableCount}</strong> available</li>
          <li><strong>{outOfStockCount}</strong> out of stock</li>
        </ul>
        {isAdding && <PantryForm key="add" ingredients={ingredients} onSave={onAddIngredient} onCancel={() => handleCloseForm()} />}
        {editingIngredient && (
          <PantryForm
            key={editingIngredient.id}
            ingredient={editingIngredient}
            ingredients={ingredients}
            onSave={handleSaveEdit}
            onCancel={() => handleCloseForm()}
          />
        )}
        <div className="pantry-fields pantry-filters" role="group" aria-label="Filter ingredients">
          <label>
            <span className="visually-hidden">Search ingredients</span>
            <input type="search" placeholder="Search ingredients" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label>
            <span className="visually-hidden">Filter by category</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">All categories</option>
              {pantryCategories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label>
            <span className="visually-hidden">Filter by availability</span>
            <select ref={availabilitySelect} value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)}>
              <option value="">All statuses</option>
              <option value="available">Available</option>
              <option value="out-of-stock">Out of stock</option>
            </select>
          </label>
        </div>
        {ingredients.length === 0 && (
          <p className="pantry-empty">Your pantry is empty.</p>
        )}
        {ingredients.length > 0 && visibleIngredients.length === 0 && (
          <p className="pantry-empty" role="status">No matching ingredients.</p>
        )}
        {visibleIngredients.length > 0 && (
          <ul className="pantry-list" aria-label="Pantry ingredients">
            {visibleIngredients.map((ingredient) => {
              const status = ingredient.isAvailable ? 'Available' : 'Out of stock'

              return (
                <li className="pantry-item" key={ingredient.id}>
                  <div className="pantry-item-name">
                    <strong>{ingredient.name}</strong>
                    <p>{ingredient.category}</p>
                  </div>
                  <div className="pantry-actions">
                    <label className="pantry-stock">
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label={`Available: ${ingredient.name}`}
                        checked={ingredient.isAvailable}
                        onChange={() => handleToggleAvailability(ingredient.id)}
                      />
                      <span className={ingredient.isAvailable ? 'pantry-available' : undefined} aria-hidden="true">{status}</span>
                    </label>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Edit ${ingredient.name}`}
                      title="Edit"
                      onClick={(event) => handleOpenEdit(ingredient.id, event)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m14 6 4 4M4 20l1-5L16 4a2.8 2.8 0 0 1 4 4L9 19z" />
                      </svg>
                    </button>
                    <button
                      className="icon-button destructive-button"
                      type="button"
                      aria-label={`Remove ${ingredient.name}`}
                      title="Remove"
                      onClick={() => handleConfirmRemove(ingredient)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 6h18M9 6V3h6v3M6 6l1 14h10l1-14M10 10v6m4-6v6" />
                      </svg>
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div hidden={showIngredients}>
        <GroceryList
          groceryList={groceryList}
          onRetry={onRetryGroceryList}
          onReplace={onReplaceGroceryList}
          onSave={onSaveGroceryItem}
          onRemove={onRemoveGroceryItem}
          onDraftChange={onGroceryDraftChange}
        />
      </div>
    </section>
  )
}

export default Pantry
