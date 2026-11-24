import { useRef, useState } from 'react'
import Header from './components/Header.jsx'
import Navigation from './components/Navigation.jsx'
import Home from './components/Home.jsx'
import MyDishes from './components/MyDishes.jsx'
import Pantry from './components/Pantry.jsx'
import Discover from './components/Discover.jsx'
import { loadPantry, savePantry } from './utils/pantry.js'
import './App.css'

const storageWarnings = {
  'read-failed': 'Your saved pantry could not be loaded. Changes are only available in memory. Retry loading to recover your saved pantry.',
  invalid: 'Your saved pantry could not be read. Changes are only available in memory until you confirm replacement.',
  partial: 'Some saved pantry entries could not be recovered. Recovered entries and any changes are only available in memory until you confirm replacement.',
  'write-failed': 'Your pantry changes could not be saved. They are only available in memory.',
  'quota-exceeded': 'Your pantry changes could not be saved because browser storage is full. Changes are only available in memory until saving succeeds.',
}

const App = () => {
  const [activeScreen, setActiveScreen] = useState('home')
  const [pantry, setPantry] = useState(loadPantry)
  const latestPantry = useRef(pantry)
  const storageWarning = storageWarnings[pantry.storageStatus]
  const needsReplacement = pantry.storageStatus === 'invalid' || pantry.storageStatus === 'partial'

  const commitPantry = (nextPantry) => {
    // Consecutive actions can run before React renders the previous update.
    latestPantry.current = nextPantry
    setPantry(nextPantry)
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

  const handleNavigate = (screen) => {
    setActiveScreen(screen)
  }

  let screen = <Home ingredients={pantry.ingredients} onOpenPantry={() => handleNavigate('pantry')} />

  if (activeScreen === 'my-dishes') {
    screen = <MyDishes />
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
