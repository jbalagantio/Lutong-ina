import { useRef, useState } from 'react'
import { filterGroceryItems } from '../utils/groceryList.js'
import { pantryCategories } from '../utils/pantry.js'
import GroceryItemForm from './GroceryItemForm.jsx'

const storageWarnings = {
  'read-failed': 'Could not open the saved grocery list.',
  invalid: 'The saved grocery list is unreadable.',
  partial: 'Some saved grocery items could not be recovered.',
  'write-failed': 'Could not save the grocery list.',
  'quota-exceeded': 'Browser storage is full. Grocery items could not be saved.',
}

const GroceryList = ({ groceryList, onRetry, onReplace, onSave, onRemove, onDraftChange }) => {
  const heading = useRef(null)
  const addButton = useRef(null)
  const searchInput = useRef(null)
  const formTrigger = useRef(null)
  const draftChanged = useRef(false)
  const editorNumber = useRef(0)
  const [editor, setEditor] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const { items, storageStatus, replacementError, hasUnsavedChanges } = groceryList
  const visibleItems = filterGroceryItems(items, search, category)
  const purchasedCount = items.filter((item) => item.isPurchased).length
  const groups = [
    { title: 'To buy', items: visibleItems.filter((item) => !item.isPurchased) },
    { title: 'Purchased', items: visibleItems.filter((item) => item.isPurchased) },
  ]
  const needsReplacement = storageStatus === 'invalid' || storageStatus === 'partial'
  const warning = storageWarnings[storageStatus]

  const retry = () => {
    const { storageStatus: status, remappedIds } = onRetry()
    const remappedId = remappedIds?.get(editor?.id)
    if (remappedId) {
      setEditor({ ...editor, id: remappedId })
      formTrigger.current = null
    }
    if (status === 'ready' || (storageStatus === 'read-failed' && status !== 'read-failed')) {
      heading.current?.focus()
    }
  }

  const replace = () => {
    if (onReplace()) heading.current?.focus()
  }

  const updateDraftChanged = (changed) => {
    draftChanged.current = changed
    onDraftChange(changed)
  }

  const openEditor = (item, trigger) => {
    if (editor && editor.id === (item?.id ?? null)) return
    if (draftChanged.current && !window.confirm('Discard unsaved grocery item changes?')) {
      trigger.focus()
      return
    }
    updateDraftChanged(false)
    formTrigger.current = trigger
    editorNumber.current += 1
    setEditor({ item, id: item?.id ?? null, key: editorNumber.current })
  }

  const closeEditor = (target = formTrigger.current) => {
    updateDraftChanged(false)
    setEditor(null)
    formTrigger.current = null
    const focusTarget = target?.isConnected ? target : addButton.current
    focusTarget?.focus()
  }

  const cancelEditor = (event) => {
    if (draftChanged.current && !window.confirm('Discard unsaved grocery item changes?')) {
      event.currentTarget.focus()
      return
    }
    closeEditor()
  }

  const saveItem = (values) => {
    const result = onSave(values, editor.id)
    if (!result.error) {
      const remainsVisible = filterGroceryItems([result.item], search, category).length > 0
      setAnnouncement(editor.item ? `Updated ${result.item.name}.` : `Added ${result.item.name}.`)
      closeEditor(remainsVisible ? formTrigger.current : searchInput.current)
    }
    return result
  }

  const confirmRemove = (item, trigger) => {
    const closesEditor = editor?.id === item.id
    let message = `Remove "${item.name}" from your grocery list?`
    if (closesEditor && draftChanged.current) message += ' Its unsaved edits will be discarded.'
    if (!window.confirm(message)) {
      trigger.focus()
      return
    }
    onRemove(item.id)
    setAnnouncement(`Removed ${item.name}.`)
    if (closesEditor) closeEditor(addButton.current)
    else addButton.current?.focus()
  }

  return (
    <section className="grocery-list" aria-labelledby="grocery-heading">
      <div className="pantry-header">
        <h2 id="grocery-heading" ref={heading} tabIndex={-1}>Grocery List</h2>
        <button ref={addButton} className="pantry-button pantry-primary" type="button"
          onClick={(event) => openEditor(null, event.currentTarget)}>Add item</button>
      </div>
      {warning && (
        <div className="storage-warning grocery-warning">
          <p role="alert">
            {warning} {storageWarnings[replacementError]}
            {needsReplacement && ' Saved data stays protected until you confirm replacement.'}
            {hasUnsavedChanges && ' Changes are only in memory and may be lost on refresh.'}
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
      {editor && (
        <GroceryItemForm key={editor.key} item={editor.item}
          onSave={saveItem} onCancel={cancelEditor} onDraftChange={updateDraftChanged} />
      )}
      <div className="pantry-fields grocery-filters" role="group" aria-label="Filter grocery items">
        <label>
          <span className="visually-hidden">Search grocery items</span>
          <input ref={searchInput} type="search" placeholder="Search grocery items" value={search}
            onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          <span className="visually-hidden">Filter grocery items by category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {pantryCategories.map((entry) => <option key={entry}>{entry}</option>)}
          </select>
        </label>
      </div>
      <p className="visually-hidden" role="status">{announcement}</p>
      {items.length === 0 && !needsReplacement && storageStatus !== 'read-failed' && <p className="pantry-empty">Your grocery list is empty.</p>}
      {items.length > 0 && visibleItems.length === 0 && <p className="pantry-empty" role="status">No matching grocery items.</p>}
      {items.length > 0 && (
        <>
          <p className="grocery-count">{purchasedCount} of {items.length} purchased</p>
          {groups
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
                      <div className="pantry-actions">
                        <button className="icon-button" type="button" aria-label={`Edit ${item.name}`} title="Edit"
                          onClick={(event) => openEditor(item, event.currentTarget)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="m14 6 4 4M4 20l1-5L16 4a2.8 2.8 0 0 1 4 4L9 19z" />
                          </svg>
                        </button>
                        <button className="icon-button destructive-button" type="button" aria-label={`Remove ${item.name}`} title="Remove"
                          onClick={(event) => confirmRemove(item, event.currentTarget)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M3 6h18M9 6V3h6v3M6 6l1 14h10l1-14M10 10v6m4-6v6" />
                          </svg>
                        </button>
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
