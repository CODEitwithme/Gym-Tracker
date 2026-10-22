import { Suspense } from 'react'
import { Link, Outlet } from 'react-router-dom'
import BottomNavigation from './BottomNavigation'
import Header from './Header'

function AppLayout() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <div className="min-h-screen">
        <Header />
        <Suspense
          fallback={
            <main className="mx-auto w-full max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:px-8 lg:pb-8">
              <p role="status" aria-live="polite" className="text-sm text-muted">
                Loading page…
              </p>
            </main>
          }
        >
          <Outlet />
        </Suspense>
        <footer className="border-t border-line bg-panel">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 pt-8 pb-24 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10 lg:py-8">
            <p>FORGE/FIT · Train with purpose.</p>
            <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2">
              <Link className="hover:text-accent" to="/workouts">Workouts</Link>
              <Link className="hover:text-accent" to="/nutrition">Nutrition</Link>
              <Link className="hover:text-accent" to="/progress">Progress</Link>
              <Link className="hover:text-accent" to="/settings/data">Privacy & data</Link>
            </nav>
          </div>
        </footer>
      </div>
      <BottomNavigation />
    </div>
  )
}

export default AppLayout
