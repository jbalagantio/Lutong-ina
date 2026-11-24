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

const openPhotoStore = () => new Promise((resolve, reject) => {
  const request = indexedDB.open('lutong-ina-photos', 1)
  let blocked = false
  request.onblocked = () => {
    blocked = true
    reject(new Error('Photo storage is open in another tab.'))
  }
  request.onupgradeneeded = () => request.result.createObjectStore('photos')
  request.onsuccess = () => {
    if (blocked) request.result.close()
    else resolve(request.result)
  }
  request.onerror = () => reject(request.error)
})

const accessPhotos = async (mode, operation) => {
  const database = await openPhotoStore()
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
export const deleteRecipePhoto = (photoId) => accessPhotos('readwrite', (store) => store.delete(photoId))

export const getUnusedPhotoIds = (photoIds, recipes) => {
  const usedPhotoIds = new Set(recipes.map((recipe) => recipe.photoId))
  return [...photoIds].filter((photoId) => !usedPhotoIds.has(photoId))
}
