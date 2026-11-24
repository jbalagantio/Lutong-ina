import { useRef, useState } from 'react'
import { hasDuplicateRecipeNames, normalizeRecipeName } from '../utils/myDishes.js'
import RecipeForm from './RecipeForm.jsx'

const storageWarnings = {
  'read-failed': 'Could not open My Dishes. Changes stay in memory until saved.',
  invalid: 'Saved My Dishes data is unreadable. Changes stay in memory until you confirm replacement.',
  partial: 'Only some saved data could be recovered. Changes stay in memory until you confirm replacement.',
  'write-failed': 'Could not save My Dishes. Changes stay in memory.',
  'quota-exceeded': 'Browser storage is full. Changes stay in memory.',
  'duplicate-names': 'Some recipes share a name. Rename or delete the duplicates before saving.',
}

const MyDishes = ({
  personalRecipes,
  storageStatus,
  replacementError,
  onSaveRecipe,
  onDeleteRecipe,
  onRetryStorage,
  onReplaceStorage,
}) => {
  const [editor, setEditor] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [search, setSearch] = useState('')
  const addButton = useRef(null)
  const formTrigger = useRef(null)
  const nextEditorKey = useRef(0)
  const searchTerm = normalizeRecipeName(search)
  const visibleRecipes = personalRecipes.filter((recipe) => normalizeRecipeName(recipe.name).includes(searchTerm))
  const warning = storageStatus === 'duplicate-names' ? '' : storageWarnings[storageStatus]
  const hasNameConflict = hasDuplicateRecipeNames(personalRecipes)
  const needsReplacement = storageStatus === 'invalid' || storageStatus === 'partial'

  const openEditor = (event, recipe) => {
    if (editor && editor.recipe === recipe) {
      return
    }
    formTrigger.current = event.currentTarget
    const key = nextEditorKey.current
    nextEditorKey.current += 1
    setEditor({ recipe, key })
  }

  const closeEditor = (returnToTrigger = true) => {
    setEditor(null)
    if (returnToTrigger && formTrigger.current?.isConnected) {
      formTrigger.current.focus()
    } else {
      addButton.current?.focus()
    }
    formTrigger.current = null
  }

  const handleSave = (values) => {
    const recipe = editor.recipe
    const error = onSaveRecipe(values, recipe)
    if (!error) {
      closeEditor(!recipe || normalizeRecipeName(values.name).includes(searchTerm))
    }
    return error
  }

  const handleDelete = (recipe) => {
    if (!window.confirm(`Delete "${recipe.name}" from My Dishes?`)) {
      return
    }
    if (!onDeleteRecipe(recipe)) {
      return
    }
    if (expandedId === recipe.id) {
      setExpandedId(null)
    }
    if (editor?.recipe?.id === recipe.id) {
      closeEditor(false)
    } else {
      addButton.current?.focus()
    }
  }

  const handleRetryStorage = () => {
    const result = onRetryStorage()
    if (!result) {
      return
    }

    const { remappedRecipes, status } = result
    if (remappedRecipes.size > 0) {
      // Keep the form key stable so recovery preserves the draft.
      setEditor((previous) => {
        const recipe = remappedRecipes.get(previous?.recipe?.id)
        return recipe ? { ...previous, recipe } : previous
      })
      setExpandedId((previousId) => remappedRecipes.get(previousId)?.id ?? previousId)
      formTrigger.current = null
    }
    if (status === 'ready' || status === 'duplicate-names' || status === 'invalid' || status === 'partial') {
      addButton.current?.focus()
    }
  }

  const handleReplaceStorage = () => {
    if (onReplaceStorage()) {
      addButton.current?.focus()
    }
  }

  return (
    <section className="my-dishes" aria-labelledby="dishes-heading">
      <div className="dishes-header">
        <h1 id="dishes-heading">My Dishes</h1>
        <button ref={addButton} type="button" className="pantry-button pantry-primary" onClick={openEditor}>
          Add recipe
        </button>
      </div>
      {(warning || hasNameConflict) && (
        <div className="storage-warning dishes-warning">
          <p role="alert">
            {[warning, hasNameConflict && storageWarnings['duplicate-names'], storageWarnings[replacementError]]
              .filter(Boolean).join(' ')}
          </p>
          {needsReplacement && !hasNameConflict && (
            <button className="pantry-button" type="button" onClick={handleReplaceStorage}>Replace saved data</button>
          )}
          {!needsReplacement && !hasNameConflict && (
            <button className="pantry-button" type="button" onClick={handleRetryStorage}>
              {storageStatus === 'read-failed' ? 'Retry loading' : 'Retry saving'}
            </button>
          )}
        </div>
      )}
      {editor && (
        <RecipeForm
          key={editor.key}
          recipe={editor.recipe}
          onSave={handleSave}
          onCancel={() => closeEditor()}
        />
      )}
      <div className="search-field">
        <label className="visually-hidden" htmlFor="personal-recipe-search">Search personal recipes</label>
        <input id="personal-recipe-search" type="search" value={search} placeholder="Search personal recipes" onChange={(event) => setSearch(event.target.value)} />
      </div>
      {visibleRecipes.length === 0 && (
        <p className="dishes-empty" role="status">{personalRecipes.length ? 'No matching recipes.' : 'No personal recipes yet.'}</p>
      )}
      {visibleRecipes.length > 0 && (
        <ul className="dishes-list" aria-label="Personal recipes">
          {visibleRecipes.map((recipe) => {
            const isExpanded = recipe.id === expandedId
            return (
              <li key={recipe.id} className="personal-recipe">
                <div className="dishes-header">
                  <div className="personal-recipe-summary">
                    <h2>{recipe.name}</h2>
                    <ul className="recipe-meta" aria-label="Recipe information">
                      <li>{recipe.cookingTime} min</li>
                      <li>{recipe.difficulty}</li>
                      <li>{recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}</li>
                    </ul>
                  </div>
                  <div className="pantry-actions">
                    <button className="pantry-button" type="button" aria-label={`${isExpanded ? 'Hide' : 'View'} ${recipe.name}`} aria-expanded={isExpanded} aria-controls={isExpanded ? 'personal-recipe-details' : undefined} onClick={() => setExpandedId(isExpanded ? null : recipe.id)}>
                      {isExpanded ? 'Hide' : 'View'}
                    </button>
                    <button className="pantry-button" type="button" aria-label={`Edit ${recipe.name}`} onClick={(event) => openEditor(event, recipe)}>Edit</button>
                    <button className="pantry-button" type="button" aria-label={`Delete ${recipe.name}`} onClick={() => handleDelete(recipe)}>Delete</button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="personal-recipe-details" id="personal-recipe-details">
                    <p className="recipe-cuisine">{recipe.cuisine}</p>
                    {recipe.description && <p>{recipe.description}</p>}
                    <h3>Ingredients</h3>
                    <ul>
                      {recipe.ingredients.map((ingredient, index) => (
                        <li key={index}>{ingredient.quantity} {ingredient.unit} {ingredient.name}</li>
                      ))}
                    </ul>
                    <h3>Instructions</h3>
                    <ol>
                      {recipe.instructions.map((step, index) => <li key={index}>{step}</li>)}
                    </ol>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default MyDishes
