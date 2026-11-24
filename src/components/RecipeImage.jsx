import { useEffect, useState } from 'react'
import { recipeImages } from '../data/recipeImages.js'
import { loadRecipePhoto } from '../utils/recipePhotos.js'

const RecipePhoto = ({ recipe, image, externalUrl, draftPhoto, layout, eager = false, showCredit = false }) => {
  const photoId = draftPhoto === undefined ? recipe.photoId : undefined
  const [localPhoto, setLocalPhoto] = useState(null)
  const [failedLocal, setFailedLocal] = useState(null)
  const [unavailablePhotoId, setUnavailablePhotoId] = useState(null)
  const [failedExternal, setFailedExternal] = useState(null)

  useEffect(() => {
    if (!photoId && !draftPhoto) return
    let active = true
    let url
    const blobRequest = draftPhoto ? Promise.resolve(draftPhoto) : loadRecipePhoto(photoId)
    blobRequest.then((blob) => {
      if (active && blob) {
        url = URL.createObjectURL(blob)
        setLocalPhoto({ photoId, draftPhoto, url })
      } else if (active) {
        setUnavailablePhotoId(photoId)
      }
    }).catch(() => {
      if (active) setUnavailablePhotoId(photoId)
    })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [photoId, draftPhoto])

  const localUrl = localPhoto?.photoId === photoId && localPhoto?.draftPhoto === draftPhoto ? localPhoto?.url : undefined
  const useLocal = localUrl && localUrl !== failedLocal
  const useExternal = !useLocal && externalUrl && externalUrl !== failedExternal
  const url = useLocal ? localUrl : useExternal ? externalUrl : undefined
  const positionLayout = layout === 'catalog' ? 'landscape' : layout
  const objectPosition = useExternal ? image.objectPosition?.[positionLayout] : undefined

  return (
    <div className={`recipe-photo recipe-photo-${layout}`}>
      <div className="recipe-photo-frame">
        {url ? (
          <img
            key={url}
            src={url}
            alt={useExternal ? image.alt ?? recipe.name : `Photo of ${recipe.name || 'your recipe'}`}
            style={objectPosition ? { objectPosition } : undefined}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => useLocal ? setFailedLocal(url) : setFailedExternal(url)}
          />
        ) : (
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 21h32M13 21v13a4 4 0 0 0 4 4h14a4 4 0 0 0 4-4V21M8 28h5m22 0h5M14 17h20m-14 0v-3a4 4 0 0 1 8 0v3" />
          </svg>
        )}
      </div>
      {showCredit && useExternal && <RecipeImageCredit image={image} />}
      {layout === 'preview' && ((photoId && unavailablePhotoId === photoId) || (localUrl && failedLocal === localUrl)) && (
        <small className="pantry-error" role="status">Could not display the saved photo.</small>
      )}
    </div>
  )
}

export const RecipeImageCredit = ({ image }) => image?.sourceUrl && (
  <small className="recipe-photo-credit">
    Photo: <a href={image.sourceUrl}>{image.title}</a> by {image.creator} · <a href={image.licenseUrl}>{image.license}</a>
  </small>
)

const RecipeImage = (props) => {
  const { recipe, image = recipeImages[recipe.id], layout = 'landscape' } = props
  const externalUrl = layout === 'thumbnail' ? image?.thumbnailUrl ?? image?.url : image?.url
  const imageKey = JSON.stringify([recipe.id, recipe.photoId, externalUrl])
  return <RecipePhoto key={imageKey} {...props} image={image} layout={layout} externalUrl={externalUrl} />
}

export default RecipeImage

