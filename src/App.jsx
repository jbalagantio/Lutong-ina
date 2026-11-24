import { useEffect, useState } from 'react'
import Header from './components/Header.jsx'
import Navigation from './components/Navigation.jsx'
import Home from './components/Home.jsx'
import MyDishes from './components/MyDishes.jsx'
import Pantry from './components/Pantry.jsx'
import Discover from './components/Discover.jsx'
import { loadPantry, savePantry } from './utils/pantry.js'
import './App.css'

const App = () => {
  const [activeScreen, setActiveScreen] = useState('home')
  const [pantry, setPantry] = useState(loadPantry)

  useEffect(() => {
    if (pantry.hasChanges) {
      savePantry(pantry.ingredients)
    }
  }, [pantry])

  const updatePantry = (updateIngredients) => {
    setPantry((currentPantry) => ({
      ingredients: updateIngredients(currentPantry.ingredients),
      hasChanges: true,
    }))
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

  let screen = <Home />

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
        {screen}
      </main>
    </div>
  )
}

export default App
