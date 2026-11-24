import { useRef, useState } from 'react'
import Header from './components/Header.jsx'
import Navigation from './components/Navigation.jsx'
import Home from './components/Home.jsx'
import MyDishes from './components/MyDishes.jsx'
import Pantry from './components/Pantry.jsx'
import Discover from './components/Discover.jsx'
import recipes from './data/recipes.js'
import {
  deletePersonalRecipe,
  hasDuplicateRecipeNames,
  loadMyDishes,
  mergeRecoveredPersonalRecipes,
  preparePersonalRecipe,
  recordLibraryChange,
  recoverLibraryEntries,
  removeLibraryEntry,
  saveBuiltInRecipe,
  saveMyDishes,
  toggleRecipePreference,
} from './utils/myDishes.js'
import { deleteRecipePhoto, getUnusedPhotoIds, saveRecipePhoto } from './utils/recipePhotos.js'
import { loadPantry, savePantry } from './utils/pantry.js'
import {
  advanceRecommendationSession,
  getEligibleRecommendations,
  getRecommendationCatalog,
  getRecipeMatches,
  getSomethingNewPool,
  reconcileRecipeIds,
  refreshPantryRound,
  refreshRecommendationRound,
  selectCookingMode,
} from './utils/recommendations.js'
import './App.css'

const storageWarnings = {
  'read-failed': 'Could not open the saved pantry.',
  invalid: 'The saved pantry is unreadable.',
  partial: 'Only some saved ingredients could be recovered.',
  'write-failed': 'Could not save pantry changes.',
  'quota-exceeded': 'Browser storage is full. Pantry changes could not be saved.',
}

const getDishesMatches = (ingredients, dishes) => {
  const catalog = getRecommendationCatalog(recipes, dishes.personalRecipes)
  return getRecipeMatches(catalog, ingredients)
}

const App = () => {
  const [activeScreen, setActiveScreen] = useState('home')
  const [pantry, setPantry] = useState(loadPantry)
  const [myDishes, setMyDishes] = useState(loadMyDishes)
  const [recommendationSession, setRecommendationSession] = useState({ mode: null, rounds: {} })
  const latestPantry = useRef(pantry)
  const latestDishes = useRef(myDishes)
  const pendingLibraryChanges = useRef(new Map())
  const recipeDraftChanged = useRef(false)
  const savingPhoto = useRef(false)
  const photosToDelete = useRef(new Set())
  const [photoCleanupError, setPhotoCleanupError] = useState(false)
  const storageWarning = storageWarnings[pantry.storageStatus]
  const needsReplacement = pantry.storageStatus === 'invalid' || pantry.storageStatus === 'partial'

  const commitPantry = (nextPantry) => {
    // Consecutive actions can run before React renders the previous update.
    const ingredientsChanged = latestPantry.current.ingredients !== nextPantry.ingredients
    latestPantry.current = nextPantry
    setPantry(nextPantry)
    if (ingredientsChanged && activeScreen === 'home') {
      const matches = getDishesMatches(nextPantry.ingredients, latestDishes.current)
      setRecommendationSession((session) => (
        session.mode === 'pantry' ? refreshPantryRound(session, matches) : session
      ))
    }
  }

  const saveAndCommitPantry = (nextPantry) => {
    const storageStatus = savePantry(nextPantry)
    commitPantry({ ...nextPantry, storageStatus })
  }

  const updatePantry = (updateIngredients) => {
    const currentPantry = latestPantry.current
    const ingredients = updateIngredients(currentPantry.ingredients)
    saveAndCommitPantry({ ...currentPantry, ingredients })
  }

  const handleRetryStorage = () => {
    const currentPantry = latestPantry.current
    if (currentPantry.storageStatus !== 'read-failed') {
      saveAndCommitPantry(currentPantry)
      return
    }

    const recoveredPantry = loadPantry()
    if (recoveredPantry.storageStatus === 'read-failed') {
      return
    }

    const recoveredIds = new Set(recoveredPantry.ingredients.map((ingredient) => ingredient.id))
    const sessionIngredients = currentPantry.ingredients.filter((ingredient) => !recoveredIds.has(ingredient.id))
    if (sessionIngredients.length === 0) {
      commitPantry(recoveredPantry)
      return
    }

    saveAndCommitPantry({
      ...recoveredPantry,
      ingredients: [...recoveredPantry.ingredients, ...sessionIngredients],
    })
  }

  const handleReplaceSavedPantry = () => {
    const confirmed = window.confirm(
      'Replace the saved pantry with the ingredients currently shown in My Pantry? Unreadable entries will be lost.',
    )
    if (!confirmed) {
      return
    }

    const currentPantry = latestPantry.current
    const storageStatus = savePantry({ ...currentPantry, storageStatus: 'ready' })
    if (storageStatus === 'ready') {
      commitPantry({ ingredients: currentPantry.ingredients, storageStatus })
    } else {
      commitPantry({ ...currentPantry, replacementError: storageStatus })
    }
  }

  const handleAddIngredient = (values) => {
    const ingredient = { ...values, id: crypto.randomUUID() }
    updatePantry((ingredients) => [...ingredients, ingredient])
  }

  const handleEditIngredient = (id, values) => {
    updatePantry((ingredients) =>
      ingredients.map((ingredient) => {
        if (ingredient.id === id) {
          return { ...ingredient, ...values }
        }
        return ingredient
      }),
    )
  }

  const handleRemoveIngredient = (id) => {
    updatePantry((ingredients) => ingredients.filter((ingredient) => ingredient.id !== id))
  }

  const handleToggleAvailability = (id) => {
    updatePantry((ingredients) =>
      ingredients.map((ingredient) => {
        if (ingredient.id === id) {
          return { ...ingredient, isAvailable: !ingredient.isAvailable }
        }
        return ingredient
      }),
    )
  }

  const commitMyDishes = (nextDishes, remappedRecipes) => {
    const recipesChanged = latestDishes.current.personalRecipes !== nextDishes.personalRecipes
    latestDishes.current = nextDishes
    setMyDishes(nextDishes)
    if (recipesChanged) {
      const catalog = getRecommendationCatalog(recipes, nextDishes.personalRecipes)
      // Rebase history now. Choose a replacement only when the round is visible.
      setRecommendationSession((session) => reconcileRecipeIds(session, catalog, remappedRecipes))
    }
  }

  const cleanUpPhotos = async (personalRecipes) => {
    const unused = getUnusedPhotoIds(photosToDelete.current, personalRecipes)
    for (const photoId of unused) {
      try {
        await deleteRecipePhoto(photoId)
        photosToDelete.current.delete(photoId)
      } catch {
        // Keep this ID queued so the user can retry cleanup.
      }
    }
    setPhotoCleanupError(getUnusedPhotoIds(photosToDelete.current, latestDishes.current.personalRecipes).length > 0)
  }

  const saveAndCommitMyDishes = (nextDishes, remappedRecipes) => {
    const storageStatus = saveMyDishes(nextDishes)
    const replacementError = storageStatus === 'ready' ? undefined : nextDishes.replacementError
    commitMyDishes({ ...nextDishes, storageStatus, replacementError }, remappedRecipes)
    if (storageStatus === 'ready') void cleanUpPhotos(nextDishes.personalRecipes)
    return storageStatus
  }

  const handleSavePersonalRecipe = async (values, editingRecipe, draftPhoto) => {
    if (savingPhoto.current) return 'A photo is already being saved.'
    const current = latestDishes.current
    const editingId = editingRecipe?.id
    const { recipe, error } = preparePersonalRecipe(values, current.personalRecipes, editingId, editingRecipe)
    if (error) {
      return error
    }

    let photoId = editingRecipe?.photoId
    if (draftPhoto) {
      savingPhoto.current = true
      try {
        const stagedPhotoId = crypto.randomUUID()
        await saveRecipePhoto(stagedPhotoId, draftPhoto)
        photoId = stagedPhotoId
      } catch {
        return 'Could not save the photo. Try again or remove it from the draft.'
      } finally {
        savingPhoto.current = false
      }
    } else if (draftPhoto === null) {
      photoId = undefined
    }
    if (photoId) recipe.photoId = photoId
    if (editingRecipe?.photoId && editingRecipe.photoId !== photoId) {
      photosToDelete.current.add(editingRecipe.photoId)
    }

    // A new photo uses a fresh key. The previous blob is kept until the recipe write succeeds.
    const latest = latestDishes.current
    const personalRecipes = editingId
      ? latest.personalRecipes.map((item) => item.id === editingId ? recipe : item)
      : [...latest.personalRecipes, recipe]
    saveAndCommitMyDishes({ ...latest, personalRecipes })
    return ''
  }

  const handleDeletePersonalRecipe = (recipe) => {
    if (savingPhoto.current) return false
    const current = latestDishes.current
    const next = deletePersonalRecipe(current, recipe)
    if (next === current) {
      return false
    }
    if (recipe.photoId) photosToDelete.current.add(recipe.photoId)
    pendingLibraryChanges.current.delete(recipe.id)
    saveAndCommitMyDishes(next)
    return true
  }

  const handleBuiltInRecipe = (recipeId, shouldSave) => {
    const current = latestDishes.current
    if (!recipes.some((recipe) => recipe.id === recipeId)) {
      return
    }
    const isSaved = current.libraryEntries.some((entry) => entry.recipeId === recipeId)
    if (isSaved === shouldSave) {
      return
    }
    const libraryEntries = shouldSave
      ? saveBuiltInRecipe(current.libraryEntries, recipeId)
      : removeLibraryEntry(current.libraryEntries, recipeId)
    if (current.storageStatus === 'read-failed') {
      pendingLibraryChanges.current = recordLibraryChange(
        pendingLibraryChanges.current, recipeId, { isSaved: shouldSave },
      )
    }
    saveAndCommitMyDishes({ ...current, libraryEntries })
  }

  const handleRecipePreference = (recipe, preference) => {
    const current = latestDishes.current
    const isSavedBuiltIn = recipes.includes(recipe) &&
      current.libraryEntries.some((entry) => entry.recipeId === recipe.id)
    if (!current.personalRecipes.includes(recipe) && !isSavedBuiltIn) {
      return
    }
    const libraryEntries = toggleRecipePreference(current.libraryEntries, recipe.id, preference)
    if (libraryEntries === current.libraryEntries) {
      return
    }
    if (current.storageStatus === 'read-failed') {
      const updatedEntry = libraryEntries.find((entry) => entry.recipeId === recipe.id)
      pendingLibraryChanges.current = recordLibraryChange(
        pendingLibraryChanges.current, recipe.id, { [preference]: updatedEntry[preference] },
      )
    }
    saveAndCommitMyDishes({ ...current, libraryEntries })
  }

  const handleRetryDishes = () => {
    if (savingPhoto.current) return
    const current = latestDishes.current
    if (current.storageStatus !== 'read-failed') {
      const status = saveAndCommitMyDishes(current)
      return { status, remappedRecipes: new Map() }
    }

    const recovered = loadMyDishes()
    if (recovered.storageStatus === 'read-failed') {
      return
    }
    const changes = pendingLibraryChanges.current
    if (current.personalRecipes.length === 0 && changes.size === 0) {
      commitMyDishes(recovered)
      return { status: recovered.storageStatus, remappedRecipes: new Map() }
    }

    const personalRecipes = mergeRecoveredPersonalRecipes(recovered.personalRecipes, current.personalRecipes)
    const remappedRecipes = new Map()
    // Recovery appends session recipes in their original order after the saved recipes.
    current.personalRecipes.forEach((recipe, index) => {
      const mergedRecipe = personalRecipes[recovered.personalRecipes.length + index]
      if (mergedRecipe.id !== recipe.id) {
        remappedRecipes.set(recipe.id, mergedRecipe)
      }
    })
    const libraryEntries = recoverLibraryEntries(recovered.libraryEntries, changes, remappedRecipes)
    const status = saveAndCommitMyDishes({ ...recovered, personalRecipes, libraryEntries }, remappedRecipes)
    pendingLibraryChanges.current = new Map()
    return { status, remappedRecipes }
  }

  const handleReplaceSavedDishes = () => {
    if (savingPhoto.current) return false
    const current = latestDishes.current
    const needsReplacement = current.storageStatus === 'invalid' || current.storageStatus === 'partial'
    if (!needsReplacement || hasDuplicateRecipeNames(current.personalRecipes)) {
      return false
    }
    if (!window.confirm('Replace the saved My Dishes data with the recovered and current recipes? Unreadable entries will be lost.')) {
      return false
    }

    const storageStatus = saveMyDishes({ ...current, storageStatus: 'ready' })
    if (storageStatus === 'ready') {
      commitMyDishes({ ...current, storageStatus, replacementError: undefined })
      void cleanUpPhotos(current.personalRecipes)
    } else {
      commitMyDishes({ ...current, replacementError: storageStatus })
    }
    return storageStatus === 'ready'
  }

  const canDiscardRecipeDraft = () =>
    !savingPhoto.current && (!recipeDraftChanged.current || window.confirm('Discard unsaved recipe changes?'))

  const handleRecipeDraftChange = (isDirty) => {
    recipeDraftChanged.current = isDirty
  }

  const handleNavigate = (screen, trigger) => {
    if (activeScreen === 'my-dishes' && screen !== activeScreen) {
      if (!canDiscardRecipeDraft()) {
        trigger?.focus()
        return
      }
      recipeDraftChanged.current = false
    }
    if (screen === 'home') {
      const dishes = latestDishes.current
      const matches = getDishesMatches(latestPantry.current.ingredients, dishes)
      const randomValue = Math.random()
      setRecommendationSession((session) => (
        refreshRecommendationRound(session, session.mode, matches, randomValue, dishes.libraryEntries)
      ))
    }
    setActiveScreen(screen)
  }

  const handleSelectMode = (mode) => {
    const dishes = latestDishes.current
    const matches = getDishesMatches(latestPantry.current.ingredients, dishes)
    const randomValue = Math.random()
    setRecommendationSession((session) => selectCookingMode(session, mode, matches, randomValue, dishes.libraryEntries))
  }

  const handleSuggestionAction = (restart) => {
    const dishes = latestDishes.current
    const matches = getDishesMatches(latestPantry.current.ingredients, dishes)
    const randomValue = Math.random()
    setRecommendationSession((session) => advanceRecommendationSession(session, matches, randomValue, restart, dishes.libraryEntries))
  }

  let screen
  if (activeScreen === 'my-dishes') {
    screen = (
      <MyDishes
        canDiscardDraft={canDiscardRecipeDraft}
        onDraftChange={handleRecipeDraftChange}
        personalRecipes={myDishes.personalRecipes}
        libraryEntries={myDishes.libraryEntries}
        storageStatus={myDishes.storageStatus}
        replacementError={myDishes.replacementError}
        photoCleanupError={photoCleanupError}
        onRetryPhotoCleanup={myDishes.storageStatus === 'ready'
          ? () => cleanUpPhotos(latestDishes.current.personalRecipes)
          : undefined}
        onSaveRecipe={handleSavePersonalRecipe}
        onDeleteRecipe={handleDeletePersonalRecipe}
        onBuiltInRecipe={handleBuiltInRecipe}
        onRecipePreference={handleRecipePreference}
        onRetryStorage={handleRetryDishes}
        onReplaceStorage={handleReplaceSavedDishes}
      />
    )
  } else if (activeScreen === 'pantry') {
    screen = (
      <Pantry
        ingredients={pantry.ingredients}
        onAddIngredient={handleAddIngredient}
        onEditIngredient={handleEditIngredient}
        onRemoveIngredient={handleRemoveIngredient}
        onToggleAvailability={handleToggleAvailability}
      />
    )
  } else if (activeScreen === 'discover') {
    screen = <Discover />
  } else {
    const { mode, rounds } = recommendationSession
    const matches = mode ? getDishesMatches(pantry.ingredients, myDishes) : []
    const pool = mode === 'new'
      ? getSomethingNewPool(matches, myDishes.libraryEntries)
      : { matches: getEligibleRecommendations(mode, matches), isFallback: false }
    screen = (
      <Home
        ingredients={pantry.ingredients}
        mode={mode}
        round={rounds[mode]}
        eligibleMatches={pool.matches}
        isFamiliarFallback={pool.isFallback}
        onSelectMode={handleSelectMode}
        onSuggestionAction={handleSuggestionAction}
        onOpenPantry={() => handleNavigate('pantry')}
      />
    )
  }

  return (
    <div className="app-shell">
      <div className="app-bar">
        <Header />
        <Navigation activeScreen={activeScreen} onNavigate={handleNavigate} />
      </div>
      <main className="main-content">
        {storageWarning && (
          <div className="storage-warning">
            <p role="alert">
              {storageWarning}
              {pantry.replacementError && ` ${storageWarnings[pantry.replacementError]}`}
              {needsReplacement ? ' Changes stay in memory until you replace the saved pantry.' : ' Changes stay in memory until saved.'}
            </p>
            {needsReplacement ? (
              <button className="pantry-button" type="button" onClick={handleReplaceSavedPantry}>
                Replace saved pantry
              </button>
            ) : (
              <button className="pantry-button" type="button" onClick={handleRetryStorage}>
                {pantry.storageStatus === 'read-failed' ? 'Retry loading' : 'Retry saving'}
              </button>
            )}
          </div>
        )}
        {screen}
      </main>
    </div>
  )
}

export default App
