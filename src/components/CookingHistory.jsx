import { useRef, useState } from 'react'
import {
  cookingHistoryWarnings, countCookedDishes, historyUnsavedWarning, needsHistoryReplacement,
  pendingRecipeHistoryWarning, searchCookingHistory,
} from '../utils/cookingHistory.js'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' })
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' })

const CookingHistory = ({ history, onRemove, onRetry, onReplace, onOpenLibrary }) => {
  const [search, setSearch] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const searchInput = useRef(null)
  const heading = useRef(null)
  const { records, storageStatus, replacementError, hasUnsavedChanges, pendingRecordIds } = history
  const warning = cookingHistoryWarnings[storageStatus]
  const needsReplacement = needsHistoryReplacement(storageStatus)
  const visibleRecords = searchCookingHistory(records, search)
  const groups = new Map()
  for (const record of visibleRecords) {
    const date = dateFormat.format(new Date(record.cookedAt))
    if (!groups.has(date)) groups.set(date, [])
    groups.get(date).push(record)
  }

  const recover = () => {
    if (needsReplacement) {
      if (onReplace()) heading.current?.focus()
      return
    }
    const status = onRetry()
    if (status === 'ready' || (storageStatus === 'read-failed' && status !== 'read-failed')) {
      heading.current?.focus()
    }
  }

  const remove = (record, trigger) => {
    if (!window.confirm(`Remove this cooking record for "${record.recipeName}"?`)) {
      trigger.focus()
      return
    }
    if (!onRemove(record.id)) return
    setAnnouncement(`Removed cooking record for ${record.recipeName}.`)
    searchInput.current?.focus()
  }

  const dishCount = countCookedDishes(records)

  return (
    <section className="cooking-history" aria-labelledby="history-heading">
      <h2 id="history-heading" ref={heading} tabIndex={-1}>Cooking History</h2>
      {warning && (
        <div className="storage-warning">
          <p role="alert">{warning} {cookingHistoryWarnings[replacementError]}
            {needsReplacement && ' Saved data stays protected until you confirm replacement.'}
            {hasUnsavedChanges && ` ${historyUnsavedWarning}`}
          </p>
          <button className="pantry-button" type="button" onClick={recover}>
            {needsReplacement && 'Replace saved cooking history'}
            {storageStatus === 'read-failed' && 'Retry loading history'}
            {!needsReplacement && storageStatus !== 'read-failed' && 'Retry saving history'}
          </button>
        </div>
      )}
      {pendingRecordIds?.size > 0 && (
        <div className="storage-warning">
          <p role="alert">{pendingRecipeHistoryWarning} {historyUnsavedWarning}</p>
          <button className="pantry-button" type="button" onClick={onOpenLibrary}>Open Recipe Library</button>
        </div>
      )}
      <div className="cooking-history-search">
        <label className="pantry-fields">
          <span className="visually-hidden">Search cooking history</span>
          <input ref={searchInput} type="search" placeholder="Search cooking history" value={search}
            onChange={(event) => setSearch(event.target.value)} />
        </label>
        {search && <button className="pantry-button" type="button" onClick={() => {
          setSearch('')
          searchInput.current?.focus()
        }}>Clear search</button>}
      </div>
      <p className="visually-hidden" role="status">{announcement}</p>
      <p className="grocery-count">
        {records.length} {records.length === 1 ? 'meal' : 'meals'} cooked · {dishCount} unique {dishCount === 1 ? 'dish' : 'dishes'}
      </p>
      {records.length === 0 && <p className="pantry-empty">No cooking records yet.</p>}
      {records.length > 0 && visibleRecords.length === 0 && <p className="pantry-empty" role="status">No matching cooking records.</p>}
      {[...groups].map(([date, meals]) => (
        <section className="grocery-group" key={date}>
          <h3>{date}</h3>
          <ul className="pantry-list" role="list">
            {meals.map((record) => (
              <li className="pantry-item" key={record.id}>
                <div className="pantry-item-name">
                  <strong>{record.recipeName}</strong>
                  <p><time dateTime={record.cookedAt}>{timeFormat.format(new Date(record.cookedAt))}</time></p>
                </div>
                <button className="icon-button destructive-button" type="button" title="Remove record"
                  aria-label={`Remove cooking record for ${record.recipeName} at ${timeFormat.format(new Date(record.cookedAt))}`}
                  onClick={(event) => remove(record, event.currentTarget)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18M9 6V3h6v3M6 6l1 14h10l1-14M10 10v6m4-6v6" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  )
}

export default CookingHistory
