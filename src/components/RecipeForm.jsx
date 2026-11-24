import { useRef, useState } from 'react'
import { recipeDifficulties, recipeLimits } from '../utils/myDishes.js'

const blankIngredient = { name: '', quantity: '', unit: '' }

const createDraft = (recipe) => ({
  name: recipe?.name ?? '',
  description: recipe?.description ?? '',
  cuisine: recipe?.cuisine ?? '',
  cookingTime: recipe?.cookingTime ?? '',
  difficulty: recipe?.difficulty ?? '',
  servings: recipe?.servings ?? '',
  ingredients: (recipe?.ingredients ?? [blankIngredient]).map((ingredient, index) => ({
    ...ingredient,
    key: `ingredient-${index}`,
  })),
  instructions: (recipe?.instructions ?? ['']).map((text, index) => ({ text, key: `step-${index}` })),
})

const RecipeForm = ({ recipe, onSave, onCancel }) => {
  const [draft, setDraft] = useState(() => createDraft(recipe))
  const [error, setError] = useState('')
  const nextRowId = useRef(0)
  const pendingFocus = useRef(null)
  const addIngredientButton = useRef(null)
  const addStepButton = useRef(null)

  const updateField = (field, value) => {
    setDraft((previous) => ({ ...previous, [field]: value }))
  }

  const updateRow = (list, key, field, value) => {
    setDraft((previous) => ({
      ...previous,
      [list]: previous[list].map((row) => row.key === key ? { ...row, [field]: value } : row),
    }))
  }

  const addRow = (list, values) => {
    if (draft[list].length >= recipeLimits[list]) {
      return
    }
    const key = `new-row-${nextRowId.current}`
    nextRowId.current += 1
    pendingFocus.current = key
    setDraft((previous) => ({
      ...previous,
      [list]: [...previous[list], { ...values, key }],
    }))
  }

  const removeRow = (list, index, addButton) => {
    const rows = draft[list]
    const neighbor = rows[index + 1] ?? rows[index - 1]
    if (neighbor) {
      pendingFocus.current = neighbor.key
    } else {
      addButton.current?.focus()
    }
    const key = rows[index].key
    setDraft((previous) => ({
      ...previous,
      [list]: previous[list].filter((row) => row.key !== key),
    }))
  }

  const focusRow = (element, key) => {
    if (element && pendingFocus.current === key) {
      pendingFocus.current = null
      element.focus()
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const values = { ...draft, instructions: draft.instructions.map((step) => step.text) }
    const validationError = onSave(values, recipe?.id)
    if (validationError) {
      setError(validationError)
    }
  }

  return (
    <form className="recipe-form" aria-labelledby="recipe-form-heading" onSubmit={handleSubmit} noValidate>
      <h2 id="recipe-form-heading">{recipe ? 'Edit recipe' : 'Add recipe'}</h2>
      <div className="recipe-fields">
        <label>Recipe name
          <input value={draft.name} onChange={(event) => updateField('name', event.target.value)} required autoFocus />
        </label>
        <label>Cuisine
          <input value={draft.cuisine} onChange={(event) => updateField('cuisine', event.target.value)} required />
        </label>
        <label>Total cooking time (minutes)
          <input type="number" min="1" max={recipeLimits.cookingTime} value={draft.cookingTime} onChange={(event) => updateField('cookingTime', event.target.value)} required />
        </label>
        <label>Servings
          <input type="number" min="1" max={recipeLimits.servings} value={draft.servings} onChange={(event) => updateField('servings', event.target.value)} required />
        </label>
        <label>Difficulty
          <select value={draft.difficulty} onChange={(event) => updateField('difficulty', event.target.value)} required>
            <option value="">Choose difficulty</option>
            {recipeDifficulties.map((difficulty) => <option key={difficulty}>{difficulty}</option>)}
          </select>
        </label>
        <label className="recipe-description">Description (optional)
          <textarea rows="2" value={draft.description} onChange={(event) => updateField('description', event.target.value)} />
        </label>
      </div>
      <fieldset className="recipe-form-group">
        <legend>Ingredients</legend>
        {draft.ingredients.map((ingredient, index) => (
          <div className="recipe-ingredient-row" key={ingredient.key}>
            <label>Ingredient {index + 1}
              <input ref={(element) => focusRow(element, ingredient.key)} value={ingredient.name} onChange={(event) => updateRow('ingredients', ingredient.key, 'name', event.target.value)} required />
            </label>
            <label>Quantity<span className="visually-hidden"> for ingredient {index + 1}</span>
              <input type="number" step="any" min="0" value={ingredient.quantity} onChange={(event) => updateRow('ingredients', ingredient.key, 'quantity', event.target.value)} required />
            </label>
            <label>Unit<span className="visually-hidden"> for ingredient {index + 1}</span>
              <input value={ingredient.unit} onChange={(event) => updateRow('ingredients', ingredient.key, 'unit', event.target.value)} required />
            </label>
            <button className="pantry-button" type="button" onClick={() => removeRow('ingredients', index, addIngredientButton)}>
              Remove<span className="visually-hidden"> ingredient {index + 1}</span>
            </button>
          </div>
        ))}
        <button ref={addIngredientButton} className="pantry-button" type="button" disabled={draft.ingredients.length >= recipeLimits.ingredients} onClick={() => addRow('ingredients', blankIngredient)}>
          Add ingredient
        </button>
      </fieldset>
      <fieldset className="recipe-form-group">
        <legend>Instructions</legend>
        {draft.instructions.map((step, index) => (
          <div className="recipe-step-row" key={step.key}>
            <label>Step {index + 1}
              <textarea ref={(element) => focusRow(element, step.key)} rows="2" value={step.text} onChange={(event) => updateRow('instructions', step.key, 'text', event.target.value)} required />
            </label>
            <button className="pantry-button" type="button" onClick={() => removeRow('instructions', index, addStepButton)}>
              Remove<span className="visually-hidden"> step {index + 1}</span>
            </button>
          </div>
        ))}
        <button ref={addStepButton} className="pantry-button" type="button" disabled={draft.instructions.length >= recipeLimits.instructions} onClick={() => addRow('instructions', { text: '' })}>
          Add step
        </button>
      </fieldset>
      {error && <p className="pantry-error" role="alert">{error}</p>}
      <div className="pantry-actions">
        <button className="pantry-button pantry-primary" type="submit">{recipe ? 'Save changes' : 'Save recipe'}</button>
        <button className="pantry-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export default RecipeForm
