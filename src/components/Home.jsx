const cookingOptions = [
  {
    id: 'pantry',
    title: 'Use what I have',
    description: 'Cook with ingredients you already have.',
    symbol: '\u25a4',
  },
  {
    id: 'shopping',
    title: "I'll go grocery shopping",
    description: 'Find a dish you can shop for.',
    symbol: '+',
  },
  {
    id: 'new',
    title: 'Something new',
    description: 'Try a dish outside your usual rotation.',
    symbol: '\u2726',
  },
]

const Home = () => {
  return (
    <div className="home-layout">
      <section aria-labelledby="home-heading">
        <h1 id="home-heading">What should I <em>cook</em> today?</h1>
        <p id="options-status" className="intro-text">
          Cooking recommendations are unavailable in this version.
        </p>
        <ul className="option-list">
          {cookingOptions.map((option) => (
            <li key={option.id}>
              <button
                className={`option-card option-${option.id}`}
                type="button"
                aria-describedby="options-status"
                disabled
              >
                <span className="option-symbol" aria-hidden="true">{option.symbol}</span>
                <span className="option-title">{option.title}</span>
                <span className="option-description">{option.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="suggestion-panel" aria-labelledby="suggestion-heading">
        <h2 id="suggestion-heading">Today&rsquo;s Suggestion</h2>
        <div className="suggestion-empty">
          <span className="empty-mark" aria-hidden="true">&#9832;</span>
          <p className="empty-title">No dish to suggest yet</p>
          <p>Meal suggestions will appear here when recommendations are available.</p>
        </div>
      </section>
    </div>
  )
}

export default Home
