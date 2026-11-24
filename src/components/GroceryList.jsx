import { useRef } from 'react'

const storageWarnings = {
  'read-failed': 'Could not open the saved grocery list.',
  invalid: 'The saved grocery list is unreadable.',
  partial: 'Some saved grocery items could not be recovered.',
  'write-failed': 'Could not save the grocery list.',
  'quota-exceeded': 'Browser storage is full. Grocery items could not be saved.',
}

const GroceryList = ({ groceryList, onRetry, onReplace }) => {
  const heading = useRef(null)
  const { items, storageStatus, replacementError } = groceryList
  const purchased = items.filter((item) => item.isPurchased)
  const unpurchased = items.filter((item) => !item.isPurchased)
  const needsReplacement = storageStatus === 'invalid' || storageStatus === 'partial'
  const warning = storageWarnings[storageStatus]

  const retry = () => {
    const status = onRetry()
    if (status === 'ready' || status === 'partial' || status === 'invalid') {
      heading.current?.focus()
    }
  }

  const replace = () => {
    if (onReplace()) heading.current?.focus()
  }

  return (
    <section className="grocery-list" aria-labelledby="grocery-heading">
      <h2 id="grocery-heading" ref={heading} tabIndex={-1}>Grocery List</h2>
      {warning && (
        <div className="storage-warning grocery-warning">
          <p role="alert">
            {warning} {storageWarnings[replacementError]}
            {needsReplacement && ' Saved data stays protected until you confirm replacement.'}
          </p>
          {needsReplacement ? (
            <button className="pantry-button" type="button" onClick={replace}>Replace saved grocery list</button>
          ) : (
            <button className="pantry-button" type="button" onClick={retry}>
              {storageStatus === 'read-failed' ? 'Retry loading grocery list' : 'Retry saving grocery list'}
            </button>
          )}
        </div>
      )}
      {items.length === 0 && !needsReplacement && storageStatus !== 'read-failed' && <p className="pantry-empty">Your grocery list is empty.</p>}
      {items.length > 0 && (
        <>
          <p className="grocery-count">{purchased.length} of {items.length} purchased</p>
          {[{ title: 'To buy', items: unpurchased }, { title: 'Purchased', items: purchased }]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <section className="grocery-group" key={group.title}>
                <h3>{group.title}</h3>
                <ul className="pantry-list" role="list">
                  {group.items.map((item) => (
                    <li className="pantry-item" key={item.id}>
                      <div className="pantry-item-name">
                        <strong>{item.name}</strong>
                        <p>{item.category}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </>
      )}
    </section>
  )
}

export default GroceryList
