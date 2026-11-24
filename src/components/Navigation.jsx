const navigationItems = [
  { id: 'home', label: 'Home' },
  { id: 'my-dishes', label: 'My Dishes' },
  { id: 'pantry', label: 'Pantry' },
  { id: 'discover', label: 'Discover' },
]

const Navigation = ({ activeScreen, onNavigate }) => {
  return (
    <nav className="navigation" aria-label="Main navigation">
      <ul className="navigation-list">
        {navigationItems.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              aria-current={activeScreen === item.id ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default Navigation
