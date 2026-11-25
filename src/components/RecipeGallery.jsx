import { useState } from 'react'
import { recipeImages } from '../data/recipeImages.js'
import RecipeImage from './RecipeImage.jsx'

const RecipeGallery = ({ recipe, eager = false }) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const primary = recipeImages[recipe.id]
  const photos = primary ? [primary, ...(primary.gallery ?? [])] : []
  const selected = photos[selectedIndex]

  if (photos.length < 2) return <RecipeImage recipe={recipe} eager={eager} showCredit />

  return (
    <div className="recipe-gallery">
      <RecipeImage recipe={recipe} image={selected} eager={eager} showCredit />
      <div className="recipe-gallery-thumbnails" role="group" aria-label={`${recipe.name} photographs`}>
        {photos.map((photo, index) => (
          <button key={photo.url} type="button" className="recipe-gallery-thumbnail"
            aria-label={`Show photo ${index + 1}: ${photo.alt}`}
            aria-pressed={selectedIndex === index} onClick={() => setSelectedIndex(index)}>
            <RecipeImage recipe={recipe} image={photo} layout="thumbnail" />
          </button>
        ))}
      </div>
    </div>
  )
}

export default RecipeGallery
