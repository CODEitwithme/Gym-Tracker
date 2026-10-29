import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Providers from './app/providers'
import { requestStoragePersistence } from './lib/storagePersistence'

// Auto-request persistent storage to mitigate iOS/WebKit 7-day eviction
void requestStoragePersistence().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)

