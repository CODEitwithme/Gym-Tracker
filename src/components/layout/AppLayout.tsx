import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import BottomNavigation from './BottomNavigation'
import Header from './Header'
import Sidebar from './Sidebar'

function AppLayout() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <Sidebar />
      <div className="min-h-screen lg:pl-64">
        <Header />
        <Suspense
          fallback={
            <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
              <p role="status" aria-live="polite" className="text-sm text-muted">
                Loading page…
              </p>
            </main>
          }
        >
          <Outlet />
        </Suspense>
      </div>
      <BottomNavigation />
    </div>
  )
}

export default AppLayout
