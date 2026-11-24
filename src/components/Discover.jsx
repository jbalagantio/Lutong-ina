import recipes from '../data/recipes.js'
import DiscoverRecipeCard from './DiscoverRecipeCard.jsx'

const catalog = [...recipes].sort((first, second) => first.name.localeCompare(second.name, 'en'))

const Discover = () => {
  return (
    <section className="discover" aria-labelledby="discover-heading">
      <h1 id="discover-heading" lang="fil" tabIndex={-1}>Ma, <em>anong ulam?</em></h1>
      <p className="discover-count">{catalog.length} recipes</p>
      <ul className="discover-grid" role="list">
        {catalog.map((recipe) => (
          <li key={recipe.id}><DiscoverRecipeCard recipe={recipe} /></li>
        ))}
      </ul>
    </section>
  )
}

export default Discover
