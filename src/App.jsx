import { useState } from 'react'
import Header from './components/Header.jsx'
import Navigation from './components/Navigation.jsx'
import Home from './components/Home.jsx'
import MyDishes from './components/MyDishes.jsx'
import Pantry from './components/Pantry.jsx'
import Discover from './components/Discover.jsx'
import './App.css'

const App = () => {
  const [activeScreen, setActiveScreen] = useState('home')

  const handleNavigate = (screen) => {
    setActiveScreen(screen)
  }

  let screen = <Home />

  if (activeScreen === 'my-dishes') {
    screen = <MyDishes />
  } else if (activeScreen === 'pantry') {
    screen = <Pantry />
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
