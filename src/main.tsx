import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Providers from './app/providers'
import { requestStoragePersistence } from './lib/storagePersistence'
import ErrorBoundary from './components/common/ErrorBoundary'

// Auto-request persistent storage to mitigate iOS/WebKit 7-day eviction
void requestStoragePersistence().catch(() => {})

// Register offline Service Worker in production
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.warn('Service worker registration failed:', err))
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Providers>
        <App />
      </Providers>
    </ErrorBoundary>
  </StrictMode>,
)

