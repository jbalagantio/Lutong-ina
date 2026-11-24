import { useLayoutEffect, useRef, useState } from 'react'
import recipes from '../data/recipes.js'
import { filterDiscoverRecipes, getDiscoverFilterOptions } from '../utils/discover.js'
import { myDishesStorageWarnings } from '../utils/myDishes.js'
import { getRecipeMatches } from '../utils/recommendations.js'
import DiscoverRecipeCard from './DiscoverRecipeCard.jsx'
import RecipeDetails from './RecipeDetails.jsx'

const { cuisines, difficulties } = getDiscoverFilterOptions(recipes)
const cookingTimeLimits = [30, 60, 90]
const defaultFilters = { query: '', cuisine: '', maxTime: '', difficulty: '' }

const Discover = ({ pantryIngredients, libraryEntries, libraryStorageStatus, onBuiltInRecipe, onRecipePreference, onOpenMyDishes, renderRecipeActions }) => {
  const [filters, setFilters] = useState(defaultFilters)
  const [selectedRecipeId, setSelectedRecipeId] = useState(null)
  const searchInput = useRef(null)
  const detailHeading = useRef(null)
  const catalogReturn = useRef(null)
  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedRecipeId)
  const results = filterDiscoverRecipes(recipes, filters)
  const displayedRecipes = selectedRecipe ? [selectedRecipe] : results
  const matches = getRecipeMatches(displayedRecipes, pantryIngredients)
  const libraryByRecipeId = new Map(libraryEntries.map((entry) => [entry.recipeId, entry]))
  const storageWarning = myDishesStorageWarnings[libraryStorageStatus]
  const libraryWarning = storageWarning && (
    <div className="storage-warning dishes-warning">
      <p role="alert">{storageWarning}</p>
      <button className="pantry-button" type="button" onClick={onOpenMyDishes}>Open My Dishes</button>
    </div>
  )
  const hasActiveFilters = filters.query.trim() || filters.cuisine || filters.maxTime || filters.difficulty

  useLayoutEffect(() => {
    if (selectedRecipeId) {
      detailHeading.current?.focus({ preventScroll: true })
      window.scrollTo(0, 0)
      return
    }

    const previousCatalog = catalogReturn.current
    if (!previousCatalog) return

    catalogReturn.current = null
    const opener = document.getElementById(`discover-open-${previousCatalog.recipeId}`)
    const focusTarget = opener ?? searchInput.current
    focusTarget?.focus({ preventScroll: true })
    window.scrollTo(0, opener ? previousCatalog.scrollTop : 0)
  }, [selectedRecipeId])

  const openRecipe = (recipeId) => {
    catalogReturn.current = { recipeId, scrollTop: window.scrollY }
    setSelectedRecipeId(recipeId)
  }

  const updateFilter = (event) => {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  const clearSearch = () => {
    setFilters((current) => ({ ...current, query: '' }))
    searchInput.current?.focus()
  }

  const clearFilters = () => {
    setFilters(defaultFilters)
    searchInput.current?.focus()
  }

  if (selectedRecipe) {
    return (
      <div className="discover-detail">
        <button className="pantry-button discover-back" type="button" onClick={() => setSelectedRecipeId(null)}>
          Back to Discover
        </button>
        {libraryWarning}
        <RecipeDetails
          recipe={selectedRecipe}
          match={matches[0]}
          recipeActions={renderRecipeActions(matches[0])}
          headingRef={detailHeading}
          libraryEntry={libraryByRecipeId.get(selectedRecipeId)}
          onToggleSaved={() => onBuiltInRecipe(selectedRecipeId, !libraryByRecipeId.has(selectedRecipeId))}
          onTogglePreference={(preference) => onRecipePreference(selectedRecipe, preference)}
        />
      </div>
    )
  }

  return (
    <section className="discover" aria-labelledby="discover-heading">
      <h1 id="discover-heading" lang="fil" tabIndex={-1}>Ma, <em>anong ulam?</em></h1>
      {libraryWarning}
      <div className="discover-controls">
        <div className="discover-search">
          <label className="visually-hidden" htmlFor="discover-search">Search dishes or ingredients</label>
          <input id="discover-search" ref={searchInput} name="query" type="search"
            placeholder="Search dishes or ingredients..." value={filters.query} onChange={updateFilter} />
          {filters.query && (
            <button className="pantry-button" type="button" onClick={clearSearch}>Clear search</button>
          )}
        </div>
        <div className="discover-filters">
          <label>
            <span className="visually-hidden">Cuisine</span>
            <select name="cuisine" value={filters.cuisine} onChange={updateFilter}>
              <option value="">All cuisines</option>
              {cuisines.map((cuisine) => <option key={cuisine}>{cuisine}</option>)}
            </select>
          </label>
          <label>
            <span className="visually-hidden">Maximum cooking time</span>
            <select name="maxTime" value={filters.maxTime} onChange={updateFilter}>
              <option value="">Any time</option>
              {cookingTimeLimits.map((limit) => <option key={limit} value={limit}>{limit} minutes or less</option>)}
            </select>
          </label>
          <label>
            <span className="visually-hidden">Difficulty</span>
            <select name="difficulty" value={filters.difficulty} onChange={updateFilter}>
              <option value="">Any difficulty</option>
              {difficulties.map((difficulty) => <option key={difficulty}>{difficulty}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="discover-results-bar">
        <p className="discover-count" role="status">
          {results.length} {results.length === 1 ? 'recipe' : 'recipes'}
        </p>
        {hasActiveFilters && (
          <button className="pantry-button" type="button" onClick={clearFilters}>Clear filters</button>
        )}
      </div>
      {results.length > 0 ? (
        <ul className="discover-grid" role="list">
          {matches.map((match) => (
            <li key={match.recipe.id}>
              <DiscoverRecipeCard
                match={match}
                isSaved={libraryByRecipeId.has(match.recipe.id)}
                onOpen={openRecipe}
                onToggleSaved={onBuiltInRecipe}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="discover-empty">
          <h2>No recipes found.</h2>
          <p>Try another search or adjust your filters.</p>
        </div>
      )}
    </section>
  )
}

export default Discover
