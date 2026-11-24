const Discover = () => {
  return (
    <section className="screen-panel" aria-labelledby="discover-heading">
      <h1 id="discover-heading" lang="fil" tabIndex={-1}>Ma, <em>anong ulam?</em></h1>
      <div className="search-field">
        <label className="visually-hidden" htmlFor="recipe-search">Search recipes</label>
        <input
          id="recipe-search"
          type="search"
          placeholder="Search dishes or ingredients..."
          aria-describedby="search-status"
          disabled
        />
        <p id="search-status">Recipe search coming soon.</p>
      </div>
    </section>
  )
}

export default Discover
