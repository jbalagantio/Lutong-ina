const RecipePreferences = ({ recipeName, isFavorite, isFamiliar, onTogglePreference }) => (
  <>
    <button className="icon-button dish-preference" type="button" aria-label={`Favorite ${recipeName}`}
      aria-pressed={isFavorite} title="Favorite" onClick={() => onTogglePreference('isFavorite')}>
      <svg viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20 4 12a5 5 0 0 1 8-6 5 5 0 0 1 8 6z" />
      </svg>
    </button>
    <button className="pantry-button dish-preference" type="button" aria-label={`Familiar: ${recipeName}`}
      aria-pressed={isFamiliar} onClick={() => onTogglePreference('isFamiliar')}>Familiar</button>
  </>
)

export default RecipePreferences
