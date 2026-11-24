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
  mergeLibraryEntries,
  mergeRecoveredPersonalRecipes,
  preparePersonalRecipe,
  removeLibraryEntry,
  saveBuiltInRecipe,
  saveMyDishes,
  toggleRecipePreference,
} from './utils/myDishes.js'
import { loadPantry, savePantry } from './utils/pantry.js'
import {
  advanceRecommendationSession,
  getEligibleRecommendations,
  getRecipeMatches,
  refreshPantryRound,
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

const App = () => {
  const [activeScreen, setActiveScreen] = useState('home')
  const [pantry, setPantry] = useState(loadPantry)
  const [myDishes, setMyDishes] = useState(loadMyDishes)
  const [recommendationSession, setRecommendationSession] = useState({ mode: null, rounds: {} })
  const latestPantry = useRef(pantry)
  const latestDishes = useRef(myDishes)
  const storageWarning = storageWarnings[pantry.storageStatus]
  const needsReplacement = pantry.storageStatus === 'invalid' || pantry.storageStatus === 'partial'

  const commitPantry = (nextPantry) => {
    // Consecutive actions can run before React renders the previous update.
    const ingredientsChanged = latestPantry.current.ingredients !== nextPantry.ingredients
    latestPantry.current = nextPantry
    setPantry(nextPantry)
    if (ingredientsChanged && activeScreen === 'home') {
      const matches = getRecipeMatches(recipes, nextPantry.ingredients)
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

  const commitMyDishes = (nextDishes) => {
    latestDishes.current = nextDishes
    setMyDishes(nextDishes)
  }

  const saveAndCommitMyDishes = (nextDishes) => {
    const storageStatus = saveMyDishes(nextDishes)
    const replacementError = storageStatus === 'ready' ? undefined : nextDishes.replacementError
    commitMyDishes({ ...nextDishes, storageStatus, replacementError })
    return storageStatus
  }

  const handleSavePersonalRecipe = (values, editingRecipe) => {
    const current = latestDishes.current
    const editingId = editingRecipe?.id
    const { recipe, error } = preparePersonalRecipe(values, current.personalRecipes, editingId, editingRecipe)
    if (error) {
      return error
    }

    const personalRecipes = editingId
      ? current.personalRecipes.map((item) => item.id === editingId ? recipe : item)
      : [...current.personalRecipes, recipe]
    saveAndCommitMyDishes({ ...current, personalRecipes })
    return ''
  }

  const handleDeletePersonalRecipe = (recipe) => {
    const current = latestDishes.current
    const next = deletePersonalRecipe(current, recipe)
    if (next === current) {
      return false
    }
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
    saveAndCommitMyDishes({ ...current, libraryEntries })
  }

  const handleRetryDishes = () => {
    const current = latestDishes.current
    if (current.storageStatus !== 'read-failed') {
      const status = saveAndCommitMyDishes(current)
      return { status, remappedRecipes: new Map() }
    }

    const recovered = loadMyDishes()
    if (recovered.storageStatus === 'read-failed') {
      return
    }
    if (current.personalRecipes.length === 0 && current.libraryEntries.length === 0) {
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
    const libraryEntries = mergeLibraryEntries(recovered.libraryEntries, current.libraryEntries, remappedRecipes)
    const status = saveAndCommitMyDishes({ ...recovered, personalRecipes, libraryEntries })
    return { status, remappedRecipes }
  }

  const handleReplaceSavedDishes = () => {
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
    } else {
      commitMyDishes({ ...current, replacementError: storageStatus })
    }
    return storageStatus === 'ready'
  }

  const handleNavigate = (screen) => {
    if (screen === 'home') {
      const matches = getRecipeMatches(recipes, latestPantry.current.ingredients)
      setRecommendationSession((session) => (
        session.mode === 'pantry' ? refreshPantryRound(session, matches) : session
      ))
    }
    setActiveScreen(screen)
  }

  const handleSelectMode = (mode) => {
    const matches = getRecipeMatches(recipes, latestPantry.current.ingredients)
    const randomValue = Math.random()
    setRecommendationSession((session) => selectCookingMode(session, mode, matches, randomValue))
  }

  const handleSuggestionAction = (restart) => {
    const matches = getRecipeMatches(recipes, latestPantry.current.ingredients)
    const randomValue = Math.random()
    setRecommendationSession((session) => advanceRecommendationSession(session, matches, randomValue, restart))
  }

  let screen
  if (activeScreen === 'my-dishes') {
    screen = (
      <MyDishes
        personalRecipes={myDishes.personalRecipes}
        libraryEntries={myDishes.libraryEntries}
        storageStatus={myDishes.storageStatus}
        replacementError={myDishes.replacementError}
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
    const matches = mode ? getRecipeMatches(recipes, pantry.ingredients) : []
    screen = (
      <Home
        ingredients={pantry.ingredients}
        mode={mode}
        round={rounds[mode]}
        eligibleMatches={getEligibleRecommendations(mode, matches)}
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
