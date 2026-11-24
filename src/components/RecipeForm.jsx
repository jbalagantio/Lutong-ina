import { useLayoutEffect, useRef, useState } from 'react'
import { recipeDifficulties, recipeLimits } from '../utils/myDishes.js'
import { photoTypes, prepareRecipePhoto } from '../utils/recipePhotos.js'
import RecipeImage from './RecipeImage.jsx'

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

const RecipeForm = ({ recipe, onSave, onCancel, onDraftChange }) => {
  const [draft, setDraft] = useState(() => createDraft(recipe))
  const [error, setError] = useState('')
  const [draftPhoto, setDraftPhoto] = useState(undefined)
  const [photoError, setPhotoError] = useState('')
  const [isReadingPhoto, setIsReadingPhoto] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const photoSelection = useRef(0)
  const submitting = useRef(false)
  const photoInput = useRef(null)
  const saveError = useRef(null)
  const nextRowId = useRef(0)
  const pendingFocus = useRef(null)
  const rowInputs = useRef(new Map())
  const addIngredientButton = useRef(null)
  const addStepButton = useRef(null)

  const updateField = (field, value) => {
    onDraftChange()
    setDraft((previous) => ({ ...previous, [field]: value }))
  }

  const updateRow = (list, key, field, value) => {
    onDraftChange()
    setDraft((previous) => ({
      ...previous,
      [list]: previous[list].map((row) => row.key === key ? { ...row, [field]: value } : row),
    }))
  }

  const addRow = (list, values) => {
    onDraftChange()
    const key = `new-row-${nextRowId.current}`
    nextRowId.current += 1
    pendingFocus.current = { list, key }
    setDraft((previous) => {
      if (previous[list].length >= recipeLimits[list]) {
        return previous
      }
      return { ...previous, [list]: [...previous[list], { ...values, key }] }
    })
  }

  const removeRow = (list, key, index) => {
    onDraftChange()
    pendingFocus.current = { list, index }
    setDraft((previous) => ({
      ...previous,
      [list]: previous[list].filter((row) => row.key !== key),
    }))
  }

  const trackRowInput = (key, element) => {
    if (element) {
      rowInputs.current.set(key, element)
    } else {
      rowInputs.current.delete(key)
    }
  }

  useLayoutEffect(() => {
    const request = pendingFocus.current
    if (!request) {
      return
    }
    pendingFocus.current = null
    const rows = draft[request.list]
    const nearbyKey = (rows[request.index] ?? rows.at(-1))?.key
    const input = rowInputs.current.get(request.key) ?? rowInputs.current.get(nearbyKey)
    const addButton = request.list === 'ingredients' ? addIngredientButton : addStepButton
    const focusTarget = input ?? addButton.current
    focusTarget?.focus()
  }, [draft])

  useLayoutEffect(() => {
    if (error && !isSaving) saveError.current?.focus()
  }, [error, isSaving])

  const handlePhotoSelection = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    onDraftChange()
    const selection = ++photoSelection.current
    setIsReadingPhoto(true)
    setPhotoError('')
    try {
      const photo = await prepareRecipePhoto(file)
      if (selection === photoSelection.current) setDraftPhoto(photo)
    } catch (failure) {
      if (selection === photoSelection.current && photoInput.current) {
        photoInput.current.value = ''
        setPhotoError(failure.message || 'Could not read this photo.')
      }
    } finally {
      if (selection === photoSelection.current) setIsReadingPhoto(false)
    }
  }

  const handleRemovePhoto = () => {
    photoSelection.current += 1
    setIsReadingPhoto(false)
    setPhotoError('')
    onDraftChange()
    setDraftPhoto(null)
    if (photoInput.current) {
      photoInput.current.value = ''
      photoInput.current.focus()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting.current || isReadingPhoto || photoError) return
    const values = { ...draft, instructions: draft.instructions.map((step) => step.text) }
    submitting.current = true
    setIsSaving(true)
    try {
      const validationError = await onSave(values, draftPhoto)
      if (validationError) setError(validationError)
    } finally {
      submitting.current = false
      setIsSaving(false)
    }
  }

  return (
    <form className="recipe-form" aria-labelledby="recipe-form-heading" onSubmit={handleSubmit} noValidate>
      <h2 id="recipe-form-heading">{recipe ? 'Edit recipe' : 'Add recipe'}</h2>
      <fieldset className="recipe-editor-fields" disabled={isSaving}>
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
        <fieldset className="recipe-form-group recipe-photo-fields">
          <legend>Photo (optional)</legend>
          {(draftPhoto || (draftPhoto === undefined && recipe?.photoId)) && (
            <RecipeImage recipe={{ ...recipe, name: draft.name }} draftPhoto={draftPhoto} layout="preview" eager />
          )}
          <input ref={photoInput} type="file" accept={photoTypes.join(',')} aria-label="Recipe photo"
            aria-invalid={Boolean(photoError)} aria-describedby={photoError ? 'recipe-photo-error' : undefined}
            onChange={handlePhotoSelection} />
          {(draftPhoto || (draftPhoto === undefined && recipe?.photoId) || isReadingPhoto) && (
            <button className="pantry-button" type="button" onClick={handleRemovePhoto}>Remove photo</button>
          )}
          {photoError && (
            <>
              <p id="recipe-photo-error" className="pantry-error" role="alert">{photoError}</p>
              <button className="pantry-button" type="button" onClick={() => {
                setPhotoError('')
                photoInput.current?.focus()
              }}>Clear photo error</button>
            </>
          )}
        </fieldset>
        <fieldset className="recipe-form-group">
          <legend>Ingredients</legend>
          {draft.ingredients.map((ingredient, index) => (
            <div className="recipe-ingredient-row" key={ingredient.key}>
              <label>Ingredient {index + 1}
                <input ref={(element) => trackRowInput(ingredient.key, element)} value={ingredient.name} onChange={(event) => updateRow('ingredients', ingredient.key, 'name', event.target.value)} required />
              </label>
              <label>Quantity<span className="visually-hidden"> for ingredient {index + 1}</span>
                <input type="number" step="any" min="0" value={ingredient.quantity} onChange={(event) => updateRow('ingredients', ingredient.key, 'quantity', event.target.value)} required />
              </label>
              <label>Unit<span className="visually-hidden"> for ingredient {index + 1}</span>
                <input value={ingredient.unit} onChange={(event) => updateRow('ingredients', ingredient.key, 'unit', event.target.value)} required />
              </label>
              <button className="pantry-button" type="button" onClick={() => removeRow('ingredients', ingredient.key, index)}>
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
                <textarea ref={(element) => trackRowInput(step.key, element)} rows="2" value={step.text} onChange={(event) => updateRow('instructions', step.key, 'text', event.target.value)} required />
              </label>
              <button className="pantry-button" type="button" onClick={() => removeRow('instructions', step.key, index)}>
                Remove<span className="visually-hidden"> step {index + 1}</span>
              </button>
            </div>
          ))}
          <button ref={addStepButton} className="pantry-button" type="button" disabled={draft.instructions.length >= recipeLimits.instructions} onClick={() => addRow('instructions', { text: '' })}>
            Add step
          </button>
        </fieldset>
        {error && <p ref={saveError} className="pantry-error" role="alert" tabIndex={-1}>{error}</p>}
        <div className="pantry-actions">
          <button className="pantry-button pantry-primary" type="submit" disabled={isReadingPhoto || Boolean(photoError)}>{recipe ? 'Save changes' : 'Save recipe'}</button>
          <button className="pantry-button" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </fieldset>
    </form>
  )
}

export default RecipeForm
