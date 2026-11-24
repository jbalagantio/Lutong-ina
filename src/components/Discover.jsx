const Discover = () => {
  return (
    <section className="screen-panel" aria-labelledby="discover-heading">
      <p className="discover-label">Discover</p>
      <h1 id="discover-heading" lang="fil">Ma, <em>anong ulam?</em></h1>
      <p>Find something delicious to cook today.</p>
      <div className="search-field">
        <label htmlFor="recipe-search">Search recipes</label>
        <input
          id="recipe-search"
          type="search"
          placeholder="Search dishes or ingredients..."
          aria-describedby="search-status"
          disabled
        />
        <p id="search-status">Recipe search is unavailable in this version.</p>
      </div>
    </section>
  )
}

export default Discover
