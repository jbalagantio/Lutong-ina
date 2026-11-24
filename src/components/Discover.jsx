import { useRef, useState } from 'react'
import recipes from '../data/recipes.js'
import { filterDiscoverRecipes, getDiscoverFilterOptions } from '../utils/discover.js'
import DiscoverRecipeCard from './DiscoverRecipeCard.jsx'

const { cuisines, difficulties } = getDiscoverFilterOptions(recipes)
const cookingTimeLimits = [30, 60, 90]
const defaultFilters = { query: '', cuisine: '', maxTime: '', difficulty: '' }

const Discover = () => {
  const [filters, setFilters] = useState(defaultFilters)
  const searchInput = useRef(null)
  const results = filterDiscoverRecipes(recipes, filters)
  const hasActiveFilters = filters.query.trim() || filters.cuisine || filters.maxTime || filters.difficulty

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

  return (
    <section className="discover" aria-labelledby="discover-heading">
      <h1 id="discover-heading" lang="fil" tabIndex={-1}>Ma, <em>anong ulam?</em></h1>
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
          {results.map((recipe) => (
            <li key={recipe.id}><DiscoverRecipeCard recipe={recipe} /></li>
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
