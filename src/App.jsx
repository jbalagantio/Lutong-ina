import { useLayoutEffect, useRef, useState } from 'react'
import Header from './components/Header.jsx'
import Navigation from './components/Navigation.jsx'
import Home from './components/Home.jsx'
import MyDishes from './components/MyDishes.jsx'
import Pantry from './components/Pantry.jsx'
import Discover from './components/Discover.jsx'
import RecipeGroceryAction from './components/RecipeGroceryAction.jsx'
import RecipeCookingAction from './components/RecipeCookingAction.jsx'
import {
  createCookingRecord, loadCookingHistory, needsHistoryReplacement, recoverCookingRecords,
  remapSessionCookingRecipes, removeCookingRecord, saveCookingHistory,
} from './utils/cookingHistory.js'
import recipes from './data/recipes.js'
import {
  createPersonalRecipeId,
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
import { reconcileRecipePhotos, saveRecipePhoto } from './utils/recipePhotos.js'
import {
  addMissingGroceryItems, loadGroceryList, prepareGroceryItem, recoverGroceryItems, removeGroceryItem,
  saveGroceryList, setGroceryPurchased, transferPurchasedItems,
} from './utils/groceryList.js'
import { loadPantry, savePantry } from './utils/pantry.js'
import {
  addCookingRecency,
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

const getDishesMatches = (ingredients, dishes, history) => {
  const catalog = getRecommendationCatalog(recipes, dishes.personalRecipes)
  return addCookingRecency(getRecipeMatches(catalog, ingredients), history.records)
}

const App = ({ canReconcilePhotos }) => {
  const [activeScreen, setActiveScreen] = useState('home')
  const [initialPantryView, setInitialPantryView] = useState('ingredients')
  const [dishesView, setDishesView] = useState('library')
  const [pantry, setPantry] = useState(loadPantry)
  const [groceryList, setGroceryList] = useState(loadGroceryList)
  const [myDishes, setMyDishes] = useState(loadMyDishes)
  const [cookingHistory, setCookingHistory] = useState(() => {
    const history = loadCookingHistory()
    return { ...history, persistedRecordIds: new Set(history.records.map((record) => record.id)) }
  })
  const [recommendationSession, setRecommendationSession] = useState({ mode: null, rounds: {} })
  const mainContent = useRef(null)
  const hasNavigated = useRef(false)
  const latestPantry = useRef(pantry)
  const latestGroceryList = useRef(groceryList)
  const groceryDraftChanged = useRef(false)
  const latestDishes = useRef(myDishes)
  const savedPersonalIds = useRef(new Set(myDishes.personalRecipes.map((recipe) => recipe.id)))
  const latestHistory = useRef(cookingHistory)
  const pendingLibraryChanges = useRef(new Map())
  const recipeDraftChanged = useRef(false)
  const savingPhoto = useRef(false)
  const [photoCleanupError, setPhotoCleanupError] = useState(false)
  const storageWarning = storageWarnings[pantry.storageStatus]
  const needsReplacement = pantry.storageStatus === 'invalid' || pantry.storageStatus === 'partial'

  useLayoutEffect(() => {
    if (!hasNavigated.current) return
    hasNavigated.current = false
    let heading = 'h1'
    if (activeScreen === 'pantry' && initialPantryView === 'grocery') heading = '#grocery-heading'
    if (activeScreen === 'my-dishes' && dishesView === 'history') heading = '#history-heading'
    mainContent.current?.querySelector(heading)?.focus()
  }, [activeScreen, initialPantryView, dishesView])

  const commitHistory = (nextHistory) => {
    latestHistory.current = nextHistory
    setCookingHistory(nextHistory)
  }

  const saveAndCommitHistory = (nextHistory, replacing = false) => {
    const { pendingRecordIds } = nextHistory
    // A session recipe may still collide with an unread saved recipe ID.
    const records = nextHistory.records.filter((record) => !pendingRecordIds?.has(record.id))
    const storageStatus = saveCookingHistory({
      records, storageStatus: replacing ? 'ready' : nextHistory.storageStatus,
    })
    if (replacing && storageStatus !== 'ready') {
      commitHistory({ ...nextHistory, replacementError: storageStatus })
    } else {
      commitHistory({
        ...nextHistory,
        storageStatus,
        replacementError: storageStatus === 'ready' ? undefined : nextHistory.replacementError,
        hasUnsavedChanges: storageStatus !== 'ready',
        persistedRecordIds: storageStatus === 'ready'
          ? new Set(records.map((record) => record.id))
          : nextHistory.persistedRecordIds,
      })
    }
    return storageStatus
  }

  const handleRecordCooking = (recipeId) => {
    const dishes = latestDishes.current
    const personalRecipe = dishes.personalRecipes.find((recipe) => recipe.id === recipeId)
    const recipe = personalRecipe ?? recipes.find((entry) => entry.id === recipeId)
    const current = latestHistory.current
    const record = createCookingRecord(current.records, recipe)
    if (!record) return null

    const records = [...current.records, record]
    if (personalRecipe && !savedPersonalIds.current.has(personalRecipe.id)) {
      const pendingRecordIds = new Set(current.pendingRecordIds)
      pendingRecordIds.add(record.id)
      commitHistory({ ...current, records, pendingRecordIds })
    } else {
      saveAndCommitHistory({ ...current, records })
    }
    return record
  }

  const handleRemoveCooking = (id) => {
    const current = latestHistory.current
    const records = removeCookingRecord(current.records, id)
    if (records === current.records) return false
    if (current.pendingRecordIds?.has(id)) {
      const pendingRecordIds = new Set(current.pendingRecordIds)
      pendingRecordIds.delete(id)
      commitHistory({ ...current, records, pendingRecordIds })
    } else if (current.storageStatus === 'read-failed' && records.length === 0) {
      commitHistory({ ...current, records, hasUnsavedChanges: false })
    } else {
      saveAndCommitHistory({ ...current, records })
    }
    return true
  }

  const handleRetryHistory = () => {
    const current = latestHistory.current
    if (current.storageStatus !== 'read-failed') return saveAndCommitHistory(current)
    const loaded = loadCookingHistory()
    const recovered = { ...loaded, persistedRecordIds: new Set(loaded.records.map((record) => record.id)) }
    if (recovered.storageStatus === 'read-failed') return 'read-failed'
    if (current.records.length === 0) {
      commitHistory(recovered)
      return recovered.storageStatus
    }
    const { records, remappedIds } = recoverCookingRecords(recovered.records, current.records)
    const pendingRecordIds = new Set([...(current.pendingRecordIds ?? [])].map((id) => remappedIds.get(id) ?? id))
    return saveAndCommitHistory({ ...recovered, records, pendingRecordIds })
  }

  const handleReplaceHistory = () => {
    const current = latestHistory.current
    if (!needsHistoryReplacement(current.storageStatus)) return false
    if (!window.confirm('Replace saved cooking history with the readable records and current changes? Unreadable entries will be lost.')) {
      return false
    }
    return saveAndCommitHistory(current, true) === 'ready'
  }

  const settleSessionCookingRecords = (storageStatus, remappedRecipes = new Map()) => {
    const current = latestHistory.current
    if (!current.pendingRecordIds?.size) return
    const records = remapSessionCookingRecipes(current.records, current.pendingRecordIds, remappedRecipes)
    if (storageStatus === 'ready') {
      saveAndCommitHistory({ ...current, records, pendingRecordIds: undefined })
    } else if (records !== current.records) {
      commitHistory({ ...current, records })
    }
  }

  const commitPantry = (nextPantry) => {
    // Consecutive actions can run before React renders the previous update.
    const ingredientsChanged = latestPantry.current.ingredients !== nextPantry.ingredients
    latestPantry.current = nextPantry
    setPantry(nextPantry)
    if (ingredientsChanged && activeScreen === 'home') {
      const matches = getDishesMatches(nextPantry.ingredients, latestDishes.current, latestHistory.current)
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

  const handlePantryStorageAction = (action) => {
    const previousStatus = latestPantry.current.storageStatus
    action()
    const currentStatus = latestPantry.current.storageStatus
    const replaceNeeded = currentStatus === 'invalid' || currentStatus === 'partial'
    if (currentStatus === 'ready' || (previousStatus === 'read-failed' && replaceNeeded)) {
      mainContent.current?.querySelector('h1')?.focus()
    }
  }

  const commitGroceryList = (nextList) => {
    latestGroceryList.current = nextList
    setGroceryList(nextList)
  }

  const saveAndCommitGroceryList = (nextList) => {
    const storageStatus = saveGroceryList(nextList)
    const saved = storageStatus === 'ready'
    commitGroceryList({
      ...nextList,
      storageStatus,
      hasUnsavedChanges: !saved && nextList.hasUnsavedChanges,
      replacementError: saved ? undefined : nextList.replacementError,
    })
    return storageStatus
  }

  const handleSaveGroceryItem = (values, id) => {
    const current = latestGroceryList.current
    const result = prepareGroceryItem(current.items, values, id)
    if (result.error) return result
    saveAndCommitGroceryList({ ...current, items: result.items, hasUnsavedChanges: true })
    return result
  }

  const handleAddRecipeGroceries = (recipeId) => {
    const catalog = getRecommendationCatalog(recipes, latestDishes.current.personalRecipes)
    const recipe = catalog.find((entry) => entry.id === recipeId)
    if (!recipe) return { error: 'This recipe is no longer available.' }

    const pantryIngredients = latestPantry.current.ingredients
    const [match] = getRecipeMatches([recipe], pantryIngredients)
    const current = latestGroceryList.current
    const { items, added, alreadyListed, skipped } = addMissingGroceryItems(current.items, match.missingIngredients, pantryIngredients)
    let storageStatus = current.storageStatus
    if (added.length > 0) {
      storageStatus = saveAndCommitGroceryList({ ...current, items, hasUnsavedChanges: true })
    }
    return { items, added: added.length, listed: alreadyListed.length, skipped: skipped.length, storageStatus }
  }

  const handleRemoveGroceryItem = (id) => {
    const current = latestGroceryList.current
    const items = removeGroceryItem(current.items, id)
    if (items === current.items) return
    const hasUnsavedChanges = current.storageStatus !== 'read-failed' || items.length > 0
    saveAndCommitGroceryList({ ...current, items, hasUnsavedChanges })
  }

  const handlePurchaseGroceryItem = (id, isPurchased) => {
    const current = latestGroceryList.current
    const items = setGroceryPurchased(current.items, id, isPurchased)
    if (items === current.items) return false
    saveAndCommitGroceryList({ ...current, items, hasUnsavedChanges: true })
    return true
  }

  const handleTransferPurchasedItems = (confirmRemoval) => transferPurchasedItems(
    latestPantry.current,
    latestGroceryList.current,
    { confirmRemoval, commitPantry, commitGrocery: commitGroceryList },
  )

  const handleRetryGroceryList = () => {
    const current = latestGroceryList.current
    if (current.storageStatus !== 'read-failed') {
      return { storageStatus: saveAndCommitGroceryList(current) }
    }

    const recovered = loadGroceryList()
    if (recovered.storageStatus === 'read-failed') return recovered
    if (current.items.length === 0) {
      commitGroceryList(recovered)
      return recovered
    }

    const { items, remappedIds } = recoverGroceryItems(recovered.items, current.items)
    const storageStatus = saveAndCommitGroceryList({ ...recovered, items, hasUnsavedChanges: true })
    return { storageStatus, remappedIds }
  }

  const handleReplaceGroceryList = () => {
    const current = latestGroceryList.current
    const { items, storageStatus } = current
    if (storageStatus !== 'invalid' && storageStatus !== 'partial') return false
    if (!window.confirm('Replace the saved grocery list with the items currently shown? Unreadable entries will be lost.')) {
      return false
    }

    const result = saveGroceryList({ items, storageStatus: 'ready' })
    if (result === 'ready') {
      commitGroceryList({ items, storageStatus: result })
    } else {
      commitGroceryList({ ...current, replacementError: result })
    }
    return result === 'ready'
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

  const cleanUpPhotos = async () => {
    if (!canReconcilePhotos || latestDishes.current.storageStatus !== 'ready') return
    try {
      const checked = await reconcileRecipePhotos(
        () => loadMyDishes({ requireSnapshot: true }),
        () => savingPhoto.current ? null : latestDishes.current,
      )
      if (checked) setPhotoCleanupError(false)
    } catch {
      setPhotoCleanupError(true)
    }
  }

  const saveAndCommitMyDishes = (nextDishes, remappedRecipes) => {
    const storageStatus = saveMyDishes(nextDishes)
    const replacementError = storageStatus === 'ready' ? undefined : nextDishes.replacementError
    commitMyDishes({ ...nextDishes, storageStatus, replacementError }, remappedRecipes)
    if (storageStatus === 'ready') {
      savedPersonalIds.current = new Set(nextDishes.personalRecipes.map((recipe) => recipe.id))
    }
    settleSessionCookingRecords(storageStatus, remappedRecipes)
    if (storageStatus === 'ready') void cleanUpPhotos()
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
    // Reconciliation keeps the previous blob while the saved recipe still references it.
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
    savedPersonalIds.current = new Set(recovered.personalRecipes.map((recipe) => recipe.id))
    const personalRecipes = mergeRecoveredPersonalRecipes(recovered.personalRecipes, current.personalRecipes)
    const remappedRecipes = new Map()
    // Recovery appends session recipes in their original order after the saved recipes.
    current.personalRecipes.forEach((recipe, index) => {
      const mergedRecipe = personalRecipes[recovered.personalRecipes.length + index]
      if (mergedRecipe.id !== recipe.id) {
        remappedRecipes.set(recipe.id, mergedRecipe)
      }
    })
    // Deleted session recipes can still own pending history, even though there is no recipe to merge.
    const { records, pendingRecordIds } = latestHistory.current
    if (pendingRecordIds?.size) {
      const deletedRecipeRemaps = new Map()
      const reservedIds = new Set([...personalRecipes.map((recipe) => recipe.id), ...records.map((record) => record.recipeId)])
      for (const record of records) {
        if (!pendingRecordIds.has(record.id) || !savedPersonalIds.current.has(record.recipeId) ||
          remappedRecipes.has(record.recipeId) || deletedRecipeRemaps.has(record.recipeId)) continue
        const id = createPersonalRecipeId(reservedIds)
        reservedIds.add(id)
        deletedRecipeRemaps.set(record.recipeId, { id })
      }
      if (deletedRecipeRemaps.size > 0) {
        const remapped = remapSessionCookingRecipes(records, pendingRecordIds, deletedRecipeRemaps)
        commitHistory({ ...latestHistory.current, records: remapped })
      }
    }
    if (current.personalRecipes.length === 0 && changes.size === 0) {
      commitMyDishes(recovered)
      settleSessionCookingRecords(recovered.storageStatus, remappedRecipes)
      void cleanUpPhotos()
      return { status: recovered.storageStatus, remappedRecipes: new Map() }
    }
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
      savedPersonalIds.current = new Set(current.personalRecipes.map((recipe) => recipe.id))
      settleSessionCookingRecords(storageStatus)
      void cleanUpPhotos()
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

  const handleNavigate = (screen, trigger, targetView) => {
    if (activeScreen === 'pantry' && screen !== activeScreen) {
      if (groceryDraftChanged.current && !window.confirm('Discard unsaved grocery item changes?')) {
        trigger?.focus()
        return
      }
      groceryDraftChanged.current = false
    }
    if (activeScreen === 'my-dishes' && screen !== activeScreen) {
      if (!canDiscardRecipeDraft()) {
        trigger?.focus()
        return
      }
      recipeDraftChanged.current = false
    }
    if (screen === 'home') {
      const dishes = latestDishes.current
      const matches = getDishesMatches(latestPantry.current.ingredients, dishes, latestHistory.current)
      const randomValue = Math.random()
      setRecommendationSession((session) => (
        refreshRecommendationRound(session, session.mode, matches, randomValue, dishes.libraryEntries)
      ))
    }
    if (screen !== activeScreen) {
      hasNavigated.current = true
      if (screen === 'pantry') setInitialPantryView(targetView ?? 'ingredients')
    }
    if (screen === 'my-dishes') {
      const nextView = targetView ?? 'library'
      if (nextView !== dishesView) hasNavigated.current = true
      setDishesView(nextView)
    }
    setActiveScreen(screen)
    if (screen === 'my-dishes') void cleanUpPhotos()
  }

  const handleSelectMode = (mode) => {
    const dishes = latestDishes.current
    const matches = getDishesMatches(latestPantry.current.ingredients, dishes, latestHistory.current)
    const randomValue = Math.random()
    setRecommendationSession((session) => selectCookingMode(session, mode, matches, randomValue, dishes.libraryEntries))
  }

  const handleSuggestionAction = (restart) => {
    const dishes = latestDishes.current
    const matches = getDishesMatches(latestPantry.current.ingredients, dishes, latestHistory.current)
    const randomValue = Math.random()
    setRecommendationSession((session) => advanceRecommendationSession(session, matches, randomValue, restart, dishes.libraryEntries))
  }

  const renderRecipeActions = (match) => (
    <div key={match.recipe.id}>
      <RecipeGroceryAction match={match} pantryIngredients={pantry.ingredients} groceryList={groceryList}
        onAdd={handleAddRecipeGroceries}
        onView={(event) => handleNavigate('pantry', event.currentTarget, 'grocery')} />
      <RecipeCookingAction recipe={match.recipe} history={cookingHistory} onRecord={handleRecordCooking}
        onView={(event) => handleNavigate('my-dishes', event.currentTarget, 'history')} />
    </div>
  )

  let screen
  if (activeScreen === 'my-dishes') {
    screen = (
      <MyDishes
        pantryIngredients={pantry.ingredients}
        renderRecipeActions={renderRecipeActions}
        view={dishesView}
        onChangeView={setDishesView}
        history={cookingHistory}
        onRemoveCooking={handleRemoveCooking}
        onRetryHistory={handleRetryHistory}
        onReplaceHistory={handleReplaceHistory}
        canDiscardDraft={canDiscardRecipeDraft}
        onDraftChange={handleRecipeDraftChange}
        personalRecipes={myDishes.personalRecipes}
        libraryEntries={myDishes.libraryEntries}
        storageStatus={myDishes.storageStatus}
        replacementError={myDishes.replacementError}
        photoCleanupError={photoCleanupError}
        onRetryPhotoCleanup={myDishes.storageStatus === 'ready'
          ? cleanUpPhotos
          : undefined}
        onBrowseRecipes={(event) => handleNavigate('discover', event.currentTarget)}
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
        initialView={initialPantryView}
        pantryStorageStatus={pantry.storageStatus}
        ingredients={pantry.ingredients}
        onAddIngredient={handleAddIngredient}
        onEditIngredient={handleEditIngredient}
        onRemoveIngredient={handleRemoveIngredient}
        onToggleAvailability={handleToggleAvailability}
        groceryList={groceryList}
        onRetryGroceryList={handleRetryGroceryList}
        onReplaceGroceryList={handleReplaceGroceryList}
        onSaveGroceryItem={handleSaveGroceryItem}
        onRemoveGroceryItem={handleRemoveGroceryItem}
        onPurchaseGroceryItem={handlePurchaseGroceryItem}
        onTransferPurchasedItems={handleTransferPurchasedItems}
        onGroceryDraftChange={(changed) => { groceryDraftChanged.current = changed }}
      />
    )
  } else if (activeScreen === 'discover') {
    screen = (
      <Discover
        renderRecipeActions={renderRecipeActions}
        pantryIngredients={pantry.ingredients}
        libraryEntries={myDishes.libraryEntries}
        libraryStorageStatus={myDishes.storageStatus}
        onOpenMyDishes={(event) => handleNavigate('my-dishes', event.currentTarget)}
        onBuiltInRecipe={handleBuiltInRecipe}
        onRecipePreference={handleRecipePreference}
      />
    )
  } else {
    const { mode, rounds } = recommendationSession
    const matches = mode ? getDishesMatches(pantry.ingredients, myDishes, cookingHistory) : []
    const pool = mode === 'new'
      ? getSomethingNewPool(matches, myDishes.libraryEntries)
      : { matches: getEligibleRecommendations(mode, matches), isFallback: false }
    screen = (
      <Home
        renderRecipeActions={renderRecipeActions}
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
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="app-bar">
        <Header />
        <Navigation activeScreen={activeScreen} onNavigate={handleNavigate} />
      </div>
      <main ref={mainContent} id="main-content" className="main-content" tabIndex={-1}>
        {storageWarning && (
          <div className="storage-warning" id="pantry-storage-warning" tabIndex={-1}>
            <p role="alert">
              {storageWarning}
              {pantry.replacementError && ` ${storageWarnings[pantry.replacementError]}`}
              {needsReplacement ? ' Changes stay in memory until you replace the saved pantry.' : ' Changes stay in memory until saved.'}
            </p>
            {needsReplacement ? (
              <button className="pantry-button" type="button" onClick={() => handlePantryStorageAction(handleReplaceSavedPantry)}>
                Replace saved pantry
              </button>
            ) : (
              <button className="pantry-button" type="button" onClick={() => handlePantryStorageAction(handleRetryStorage)}>
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
