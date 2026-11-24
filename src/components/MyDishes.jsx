import { useRef, useState } from 'react'
import { filterRecipeCollection, getRecipeCollection, hasDuplicateRecipeNames, myDishesStorageWarnings, normalizeRecipeName } from '../utils/myDishes.js'
import LibraryRecipeRow from './LibraryRecipeRow.jsx'
import RecipeForm from './RecipeForm.jsx'
import RecipePreferences from './RecipePreferences.jsx'

const MyDishes = ({
  canDiscardDraft,
  onDraftChange,
  personalRecipes,
  libraryEntries,
  storageStatus,
  replacementError,
  photoCleanupError,
  onRetryPhotoCleanup,
  onBrowseRecipes,
  onSaveRecipe,
  onDeleteRecipe,
  onBuiltInRecipe,
  onRecipePreference,
  onRetryStorage,
  onReplaceStorage,
}) => {
  const [editor, setEditor] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const addButton = useRef(null)
  const filterSelect = useRef(null)
  const formTrigger = useRef(null)
  const nextEditorKey = useRef(0)
  const searchTerm = normalizeRecipeName(search)
  const collection = getRecipeCollection(personalRecipes, libraryEntries)
  const visibleRecipes = filterRecipeCollection(collection, filter, searchTerm)
  const warning = storageStatus === 'duplicate-names' ? '' : myDishesStorageWarnings[storageStatus]
  const hasNameConflict = hasDuplicateRecipeNames(personalRecipes)
  const needsReplacement = storageStatus === 'invalid' || storageStatus === 'partial'

  const openEditor = (event, recipe) => {
    if (editor && editor.recipe === recipe) {
      return
    }
    if (!canDiscardDraft()) {
      return
    }
    onDraftChange(false)
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
    onDraftChange(false)
  }

  const handleSave = async (values, draftPhoto) => {
    const recipe = editor.recipe
    const error = await onSaveRecipe(values, recipe, draftPhoto)
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

  const handleRemoveSaved = (recipe) => {
    onBuiltInRecipe(recipe.id, false)
    if (expandedId === recipe.id) setExpandedId(null)
    filterSelect.current?.focus()
  }

  const handlePreference = (item, preference) => {
    onRecipePreference(item.recipe, preference)
    if ((filter === 'favorites' && preference === 'isFavorite' && item.isFavorite) ||
        (filter === 'familiar' && preference === 'isFamiliar' && item.isFamiliar)) {
      filterSelect.current?.focus()
    }
  }

  return (
    <section className="my-dishes" aria-labelledby="dishes-heading">
      <div className="dishes-header">
        <h1 id="dishes-heading" tabIndex={-1}>My Dishes</h1>
        <div className="pantry-actions">
          <button type="button" className="pantry-button" onClick={onBrowseRecipes}>Browse recipes</button>
          <button ref={addButton} type="button" className="pantry-button pantry-primary" onClick={openEditor}>
            Add recipe
          </button>
        </div>
      </div>
      {(warning || hasNameConflict) && (
        <div className="storage-warning dishes-warning">
          <p role="alert">
            {[warning, hasNameConflict && myDishesStorageWarnings['duplicate-names'], myDishesStorageWarnings[replacementError]]
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
      {photoCleanupError && (
        <div className="storage-warning dishes-warning">
          <p role="alert">Could not clear an unused photo from browser storage.</p>
          {onRetryPhotoCleanup && (
            <button className="pantry-button" type="button" onClick={onRetryPhotoCleanup}>Retry photo cleanup</button>
          )}
        </div>
      )}
      {editor && (
        <RecipeForm
          key={editor.key}
          recipe={editor.recipe}
          onSave={handleSave}
          onCancel={() => { if (canDiscardDraft()) closeEditor() }}
          onDraftChange={() => onDraftChange(true)}
        />
      )}
      <div className="pantry-fields dishes-filters">
        <label>
          <span className="visually-hidden">Search My Dishes</span>
          <input id="personal-recipe-search" type="search" value={search} placeholder="Search My Dishes"
            onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          <span className="visually-hidden">Filter My Dishes</span>
          <select ref={filterSelect} value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All dishes</option>
            <option value="favorites">Favorites</option>
            <option value="familiar">Familiar</option>
            <option value="personal">Personal recipes</option>
            <option value="saved">Saved recipes</option>
          </select>
        </label>
      </div>
      {visibleRecipes.length === 0 && (
        <p className="dishes-empty" role="status">{collection.length ? 'No matching recipes.' : 'No recipes in My Dishes yet.'}</p>
      )}
      {visibleRecipes.length > 0 && (
        <ul className="dishes-list" aria-label="My Dishes recipes">
          {visibleRecipes.map((item) => (
            <LibraryRecipeRow key={item.recipe.id} recipe={item.recipe} isExpanded={expandedId === item.recipe.id}
              onToggleDetails={() => setExpandedId(expandedId === item.recipe.id ? null : item.recipe.id)}>
              <RecipePreferences recipeName={item.recipe.name} isFavorite={item.isFavorite} isFamiliar={item.isFamiliar}
                onTogglePreference={(preference) => handlePreference(item, preference)} />
              {item.isPersonal ? (
                <>
                  <button className="pantry-button" type="button" aria-label={`Edit ${item.recipe.name}`} onClick={(event) => openEditor(event, item.recipe)}>Edit</button>
                  <button className="pantry-button destructive-button" type="button" aria-label={`Delete ${item.recipe.name}`} onClick={() => handleDelete(item.recipe)}>Delete</button>
                </>
              ) : (
                <button className="pantry-button" type="button" aria-label={`Remove saved ${item.recipe.name}`} onClick={() => handleRemoveSaved(item.recipe)}>Remove saved</button>
              )}
            </LibraryRecipeRow>
          ))}
        </ul>
      )}
    </section>
  )
}

export default MyDishes
