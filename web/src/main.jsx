import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { DispatchProvider } from './context/DispatchContext.jsx'
import { FavoritesProvider } from './context/FavoritesContext.jsx'
import { LanguageProvider } from './i18n/LanguageContext.jsx'
import 'leaflet/dist/leaflet.css'
import './index.css'
import { installErrorReporter } from './lib/errorReporter'

installErrorReporter()

// Ilovani telefonga o'rnatish (PWA) va oflayn sahifa uchun
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <FavoritesProvider>
            <DispatchProvider>
              <App />
            </DispatchProvider>
          </FavoritesProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
    </LanguageProvider>
  </React.StrictMode>,
)
