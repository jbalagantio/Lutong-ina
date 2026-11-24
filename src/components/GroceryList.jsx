import { useLayoutEffect, useRef, useState } from 'react'
import { filterGroceryItems, groceryStorageWarnings, groceryUnsavedWarning } from '../utils/groceryList.js'
import { getIngredientMatchName, pantryCategories } from '../utils/pantry.js'
import GroceryItemForm from './GroceryItemForm.jsx'

const GroceryList = ({ groceryList, pantryStorageStatus, onRetry, onReplace, onSave, onRemove, onPurchase, onTransfer, onDraftChange }) => {
  const heading = useRef(null)
  const addButton = useRef(null)
  const searchInput = useRef(null)
  const formTrigger = useRef(null)
  const purchaseInputs = useRef(new Map())
  const pendingPurchaseFocus = useRef(null)
  const transferFeedback = useRef(null)
  const draftChanged = useRef(false)
  const editorNumber = useRef(0)
  const [editor, setEditor] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [transferResult, setTransferResult] = useState(null)
  const { items, storageStatus, replacementError, hasUnsavedChanges } = groceryList
  const visibleItems = filterGroceryItems(items, search, category)
  const purchasedCount = items.filter((item) => item.isPurchased).length
  const groups = [
    { title: 'To buy', items: visibleItems.filter((item) => !item.isPurchased) },
    { title: 'Purchased', items: visibleItems.filter((item) => item.isPurchased) },
  ]
  const needsReplacement = storageStatus === 'invalid' || storageStatus === 'partial'
  const warning = groceryStorageWarnings[storageStatus]
  const showPantryRecovery = pantryStorageStatus !== 'ready' &&
    ['pantry-protected', 'pantry-failed'].includes(transferResult?.status)
  const hasPendingCleanup = transferResult?.status === 'grocery-failed' && items.some((item) => (
    item.isPurchased && transferResult.pendingNames.get(item.id) === getIngredientMatchName(item.name)
  ))
  const showGroceryRecovery = warning && (transferResult?.status === 'grocery-protected' || hasPendingCleanup)
  const showTransferFeedback = transferResult &&
    (!['pantry-protected', 'pantry-failed'].includes(transferResult.status) || showPantryRecovery) &&
    (transferResult.status !== 'grocery-protected' || showGroceryRecovery) &&
    (transferResult.status !== 'grocery-failed' || hasPendingCleanup)

  useLayoutEffect(() => {
    const id = pendingPurchaseFocus.current
    if (id === null) return
    pendingPurchaseFocus.current = null
    const target = purchaseInputs.current.get(id) ?? searchInput.current
    target?.focus()
  }, [items])

  const trackPurchaseInput = (id, input) => {
    if (input) purchaseInputs.current.set(id, input)
    else purchaseInputs.current.delete(id)
  }

  const clearTransferFeedback = (changedId, currentName) => {
    // A grocery save can succeed without completing a previously failed cleanup.
    setTransferResult((previous) => {
      if (previous?.status !== 'grocery-failed') return null
      const pendingName = previous.pendingNames.get(changedId)
      if (!pendingName || pendingName === currentName) return previous
      const pendingNames = new Map(previous.pendingNames)
      pendingNames.delete(changedId)
      return pendingNames.size > 0 ? { ...previous, pendingNames } : null
    })
  }

  const changePurchase = (item, isPurchased) => {
    if (!onPurchase(item.id, isPurchased)) return
    pendingPurchaseFocus.current = item.id
    clearTransferFeedback(item.id, isPurchased ? getIngredientMatchName(item.name) : undefined)
  }

  const retry = () => {
    const { storageStatus: status, remappedIds } = onRetry()
    const remappedId = remappedIds?.get(editor?.id)
    if (remappedId) {
      setEditor({ ...editor, id: remappedId })
      formTrigger.current = null
    }
    if (status === 'ready' || (storageStatus === 'read-failed' && status !== 'read-failed')) {
      clearTransferFeedback()
      heading.current?.focus()
    }
  }

  const replace = () => {
    if (onReplace()) {
      clearTransferFeedback()
      heading.current?.focus()
    }
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
      clearTransferFeedback(result.item.id, getIngredientMatchName(result.item.name))
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
    clearTransferFeedback(item.id)
    setAnnouncement(`Removed ${item.name}.`)
    if (closesEditor) closeEditor(addButton.current)
    else addButton.current?.focus()
  }

  const transferPurchased = (event) => {
    const result = onTransfer((representedIds) => (
      !representedIds.has(editor?.id) || !draftChanged.current ||
      window.confirm('This transfer will remove the item you are editing. Discard its unsaved changes if the transfer succeeds?')
    ))
    if (result.status === 'cancelled') {
      event.currentTarget.focus()
      return
    }
    let message = ''
    if (result.status === 'pantry-protected') message = 'Recover saved Pantry data before transferring.'
    if (result.status === 'grocery-protected') message = 'Recover the saved grocery list before transferring.'
    if (result.status === 'empty') message = 'No eligible purchased items to transfer.'
    if (result.status === 'pantry-failed') message = 'Pantry could not be saved. Purchased items were kept.'
    if (result.status === 'grocery-failed') {
      message = 'Pantry is saved. Grocery cleanup failed, so purchased items were kept. Try the transfer again.'
    }
    if (result.status === 'transferred') {
      const count = result.representedIds.size
      message = `Transferred ${count} grocery ${count === 1 ? 'item' : 'items'}.`
    }
    if (result.created?.length) message += ` ${result.created.length} new.`
    if (result.restocked?.length) message += ` ${result.restocked.length} restocked.`
    if (result.alreadyAvailable?.length) message += ` ${result.alreadyAvailable.length} already available.`
    if (result.skipped?.length) message += ` ${result.skipped.length} skipped.`
    const pendingNames = new Map()
    if (result.status === 'grocery-failed') {
      for (const item of items) {
        if (result.representedIds.has(item.id)) pendingNames.set(item.id, getIngredientMatchName(item.name))
      }
    }
    setTransferResult({ status: result.status, message, pendingNames })
    if (result.status === 'transferred' && result.representedIds.has(editor?.id)) {
      closeEditor(transferFeedback.current)
    } else {
      transferFeedback.current?.focus()
    }
  }

  return (
    <section className="grocery-list" aria-labelledby="grocery-heading">
      <div className="pantry-header">
        <h2 id="grocery-heading" ref={heading} tabIndex={-1}>Grocery List</h2>
        <button ref={addButton} className="pantry-button pantry-primary" type="button"
          onClick={(event) => openEditor(null, event.currentTarget)}>Add item</button>
      </div>
      {warning && (
        <div className="storage-warning grocery-warning" id="grocery-storage-warning" tabIndex={-1}>
          <p role="alert">
            {warning} {groceryStorageWarnings[replacementError]}
            {needsReplacement && ' Saved data stays protected until you confirm replacement.'}
            {hasUnsavedChanges && ` ${groceryUnsavedWarning}`}
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
      <p className="grocery-transfer-feedback" role="status" tabIndex={-1} ref={transferFeedback}>
        {showTransferFeedback && transferResult.message}
      </p>
      {showPantryRecovery && (
        <a href="#pantry-storage-warning">Pantry storage options</a>
      )}
      {showGroceryRecovery && (
        <a href="#grocery-storage-warning">Grocery storage options</a>
      )}
      {items.length === 0 && !needsReplacement && storageStatus !== 'read-failed' && <p className="pantry-empty">Your grocery list is empty.</p>}
      {items.length > 0 && visibleItems.length === 0 && <p className="pantry-empty" role="status">No matching grocery items.</p>}
      {items.length > 0 && (
        <>
          <p className="grocery-count">{purchasedCount} of {items.length} purchased</p>
          {purchasedCount > 0 && (
            <button className="pantry-button grocery-transfer" type="button" onClick={transferPurchased}>
              Add purchased items to pantry (all {purchasedCount})
            </button>
          )}
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
                        <label className="grocery-purchase">
                          <input type="checkbox" checked={item.isPurchased} aria-label={`Purchased: ${item.name}`}
                            ref={(input) => trackPurchaseInput(item.id, input)}
                            onChange={(event) => changePurchase(item, event.target.checked)} />
                        </label>
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
