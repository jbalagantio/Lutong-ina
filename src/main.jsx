import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerPhotoSession } from './utils/recipePhotos.js'

registerPhotoSession().then((canReconcilePhotos) => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App canReconcilePhotos={canReconcilePhotos} />
    </StrictMode>,
  )
})
