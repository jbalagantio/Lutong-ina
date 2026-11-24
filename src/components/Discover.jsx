const Discover = () => {
  return (
    <section className="screen-panel" aria-labelledby="discover-heading">
      <h1 id="discover-heading">Discover</h1>
      <p id="search-status">Recipe search is unavailable in this version.</p>
      <div className="search-field">
        <label htmlFor="recipe-search">Search recipes</label>
        <input
          id="recipe-search"
          type="search"
          placeholder="Ma, anong ulam?"
          aria-describedby="search-status"
          disabled
        />
      </div>
    </section>
  )
}

export default Discover
