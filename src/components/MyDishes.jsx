import { useLayoutEffect, useRef, useState } from 'react'
import recipes from '../data/recipes.js'
import { filterRecipeCollection, getRecipeCollection, hasDuplicateRecipeNames, normalizeRecipeName } from '../utils/myDishes.js'
import LibraryRecipeRow from './LibraryRecipeRow.jsx'
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
  canDiscardDraft,
  onDraftChange,
  personalRecipes,
  libraryEntries,
  storageStatus,
  replacementError,
  photoCleanupError,
  onRetryPhotoCleanup,
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
  const [catalogSearch, setCatalogSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [isBrowsing, setIsBrowsing] = useState(false)
  const addButton = useRef(null)
  const filterSelect = useRef(null)
  const searchInput = useRef(null)
  const focusCatalogSearch = useRef(false)
  const formTrigger = useRef(null)
  const nextEditorKey = useRef(0)
  const searchTerm = normalizeRecipeName(search)
  const catalogTerm = normalizeRecipeName(catalogSearch)
  const collection = getRecipeCollection(personalRecipes, libraryEntries)
  const visibleRecipes = filterRecipeCollection(collection, filter, searchTerm)
  const visibleCatalog = recipes.filter((recipe) => normalizeRecipeName(recipe.name).includes(catalogTerm))
  const savedIds = new Set(libraryEntries.map((entry) => entry.recipeId))
  const warning = storageStatus === 'duplicate-names' ? '' : storageWarnings[storageStatus]
  const hasNameConflict = hasDuplicateRecipeNames(personalRecipes)
  const needsReplacement = storageStatus === 'invalid' || storageStatus === 'partial'

  useLayoutEffect(() => {
    if (!isBrowsing || !focusCatalogSearch.current) return
    focusCatalogSearch.current = false
    searchInput.current?.focus()
  }, [isBrowsing])

  const openEditor = (event, recipe) => {
    if (editor && editor.recipe === recipe) {
      return
    }
    if (!canDiscardDraft()) {
      return
    }
    onDraftChange(false)
    setIsBrowsing(false)
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

  const handleToggleBrowse = (event) => {
    if (!canDiscardDraft()) {
      return
    }
    setEditor(null)
    formTrigger.current = null
    onDraftChange(false)
    setExpandedId(null)
    focusCatalogSearch.current = !isBrowsing && event.detail === 0
    setIsBrowsing(!isBrowsing)
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

  const handleBuiltInAction = (recipe, shouldSave) => {
    onBuiltInRecipe(recipe.id, shouldSave)
    if (!shouldSave && !isBrowsing) {
      if (expandedId === recipe.id) setExpandedId(null)
      filterSelect.current?.focus()
    }
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
          <button type="button" className="pantry-button" onClick={handleToggleBrowse}>
            {isBrowsing ? 'Back to My Dishes' : 'Browse recipes'}
          </button>
          <button ref={addButton} type="button" className="pantry-button pantry-primary" onClick={openEditor}>
            Add recipe
          </button>
        </div>
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
          <span className="visually-hidden">{isBrowsing ? 'Search catalog' : 'Search My Dishes'}</span>
          <input ref={searchInput} id={isBrowsing ? 'catalog-recipe-search' : 'personal-recipe-search'} type="search" value={isBrowsing ? catalogSearch : search}
            placeholder={isBrowsing ? 'Search catalog' : 'Search My Dishes'}
            onChange={(event) => {
              if (isBrowsing) setCatalogSearch(event.target.value)
              else setSearch(event.target.value)
            }}
          />
        </label>
        {!isBrowsing && (
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
        )}
      </div>
      {isBrowsing && visibleCatalog.length === 0 && <p className="dishes-empty" role="status">No matching recipes.</p>}
      {isBrowsing && visibleCatalog.length > 0 && (
        <ul className="dishes-list" aria-label="Built-in recipes">
          {visibleCatalog.map((recipe) => {
            const isSaved = savedIds.has(recipe.id)
            const action = isSaved ? 'Saved · Remove' : 'Save'
            return (
              <LibraryRecipeRow key={recipe.id} recipe={recipe} isExpanded={expandedId === recipe.id}
                onToggleDetails={() => setExpandedId(expandedId === recipe.id ? null : recipe.id)}>
                <button className="pantry-button" type="button" aria-label={`${action} ${recipe.name}`}
                  onClick={() => handleBuiltInAction(recipe, !isSaved)}>{action}</button>
              </LibraryRecipeRow>
            )
          })}
        </ul>
      )}
      {!isBrowsing && visibleRecipes.length === 0 && (
        <p className="dishes-empty" role="status">{collection.length ? 'No matching recipes.' : 'No recipes in My Dishes yet.'}</p>
      )}
      {!isBrowsing && visibleRecipes.length > 0 && (
        <ul className="dishes-list" aria-label="My Dishes recipes">
          {visibleRecipes.map((item) => (
            <LibraryRecipeRow key={item.recipe.id} recipe={item.recipe} isExpanded={expandedId === item.recipe.id}
              onToggleDetails={() => setExpandedId(expandedId === item.recipe.id ? null : item.recipe.id)}>
              <button className="icon-button dish-preference" type="button" aria-label={`Favorite ${item.recipe.name}`}
                aria-pressed={item.isFavorite} title="Favorite" onClick={() => handlePreference(item, 'isFavorite')}>
                <svg viewBox="0 0 24 24" fill={item.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20 4 12a5 5 0 0 1 8-6 5 5 0 0 1 8 6z" />
                </svg>
              </button>
              <button className="pantry-button dish-preference" type="button" aria-label={`Familiar: ${item.recipe.name}`}
                aria-pressed={item.isFamiliar} onClick={() => handlePreference(item, 'isFamiliar')}>Familiar</button>
              {item.isPersonal ? (
                <>
                  <button className="pantry-button" type="button" aria-label={`Edit ${item.recipe.name}`} onClick={(event) => openEditor(event, item.recipe)}>Edit</button>
                  <button className="pantry-button destructive-button" type="button" aria-label={`Delete ${item.recipe.name}`} onClick={() => handleDelete(item.recipe)}>Delete</button>
                </>
              ) : (
                <button className="pantry-button" type="button" aria-label={`Remove saved ${item.recipe.name}`} onClick={() => handleBuiltInAction(item.recipe, false)}>Remove saved</button>
              )}
            </LibraryRecipeRow>
          ))}
        </ul>
      )}
    </section>
  )
}

export default MyDishes
