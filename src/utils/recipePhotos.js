export const photoTypes = ['image/jpeg', 'image/png', 'image/webp']
export const photoSizeLimit = 10 * 1024 * 1024

export const getPhotoFileError = (file) => {
  if (file.size > photoSizeLimit) return 'Choose a photo under 10 MB.'
  if (file.size === 0) return 'Could not read this photo.'
  return ''
}

export const getPhotoType = (bytes) => {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return 'image/png'
  const header = String.fromCharCode(...bytes)
  if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') return 'image/webp'
  return ''
}

export const prepareRecipePhoto = async (file) => {
  const fileError = getPhotoFileError(file)
  if (fileError) throw new Error(fileError)

  const type = getPhotoType(new Uint8Array(await file.slice(0, 12).arrayBuffer()))
  if (!type) throw new Error('Choose a JPEG, PNG, or WebP photo.')

  const source = file.slice(0, file.size, type)
  const url = URL.createObjectURL(source)
  try {
    const image = new Image()
    image.src = url
    try {
      await image.decode()
    } catch {
      throw new Error('Could not read this photo.')
    }
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) return source
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const compressed = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86))
    if (compressed && (scale < 1 || compressed.size < source.size)) return compressed
    return source
  } finally {
    URL.revokeObjectURL(url)
  }
}

const openPhotoStore = (create) => new Promise((resolve, reject) => {
  const request = indexedDB.open('lutong-ina-photos', 1)
  let blocked = false
  let missing = false
  request.onblocked = () => {
    blocked = true
    reject(new Error('Photo storage is open in another tab.'))
  }
  request.onupgradeneeded = () => {
    if (create) {
      request.result.createObjectStore('photos')
    } else {
      missing = true
      request.transaction.abort()
    }
  }
  request.onsuccess = () => {
    if (blocked) request.result.close()
    else resolve(request.result)
  }
  request.onerror = () => {
    if (missing) resolve(null)
    else reject(request.error)
  }
})

const accessPhotos = async (mode, operation, create = true) => {
  const database = await openPhotoStore(create)
  if (!database) return
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction('photos', mode)
      const request = operation(transaction.objectStore('photos'))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = () => reject(transaction.error ?? new Error('Photo storage was interrupted.'))
    })
  } finally {
    database.close()
  }
}

export const loadRecipePhoto = (photoId) => accessPhotos('readonly', (store) => store.get(photoId))
export const saveRecipePhoto = (photoId, blob) => accessPhotos('readwrite', (store) => store.add(blob, photoId))

export const getUnusedPhotoIds = (photoIds, recipes) => {
  const usedPhotoIds = new Set(recipes.map((recipe) => recipe.photoId))
  return [...photoIds].filter((photoId) => !usedPhotoIds.has(photoId))
}

export const getOrphanedPhotoIds = (photoIds, savedDishes, activeDishes) => {
  if (savedDishes?.storageStatus !== 'ready' || activeDishes?.storageStatus !== 'ready') {
    return []
  }
  const recipes = [...savedDishes.personalRecipes, ...activeDishes.personalRecipes]
  return getUnusedPhotoIds(photoIds, recipes).filter((photoId) => typeof photoId === 'string')
}

const photoSessionGate = 'lutong-ina-photo-session-gate'
const openPhotoSessions = 'lutong-ina-open-photo-sessions'

export const registerPhotoSession = async () => {
  const locks = navigator.locks
  if (!locks) return false

  // Register before reading recipes. The browser releases this shared lock when the document closes.
  return locks.request(photoSessionGate, () => new Promise((resolve) => {
    locks.request(openPhotoSessions, { mode: 'shared' }, () => {
      resolve(true)
      return new Promise(() => {})
    }).catch(() => resolve(false))
  })).catch(() => false)
}

export const reconcileRecipePhotos = (readSavedDishes, readActiveDishes) =>
  navigator.locks.request(photoSessionGate, async () => {
    // While the gate is held, another tab cannot register and read recipes.
    const { held } = await navigator.locks.query()
    if (held.filter((lock) => lock.name === openPhotoSessions).length !== 1) return false
    if (readActiveDishes()?.storageStatus !== 'ready' || readSavedDishes()?.storageStatus !== 'ready') return false

    let checked = false
    const photoKeys = await accessPhotos('readwrite', (store) => {
      const keys = store.getAllKeys()
      keys.onsuccess = () => {
        // Read both snapshots again immediately before issuing deletes.
        const savedDishes = readSavedDishes()
        const activeDishes = readActiveDishes()
        checked = savedDishes?.storageStatus === 'ready' && activeDishes?.storageStatus === 'ready'
        const unused = getOrphanedPhotoIds(keys.result, savedDishes, activeDishes)
        for (const photoId of unused) store.delete(photoId)
      }
      return keys
    }, false)
    return checked || photoKeys === undefined
  })
