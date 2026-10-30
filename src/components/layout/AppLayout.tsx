import { Suspense, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import BottomNavigation from './BottomNavigation'
import Header from './Header'
import ActiveWorkoutBanner from './ActiveWorkoutBanner'
import BackgroundFx from './BackgroundFx'
import { installSpotlight } from '../../lib/spotlight'
import { pageVariants } from '../../lib/motion'

function AppLayout() {
  const location = useLocation()
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => installSpotlight(), [])

  return (
    <div className="min-h-screen bg-transparent text-ink selection:bg-accent selection:text-[var(--theme-background)]">
      <BackgroundFx />
      <Header />

      <Suspense
        fallback={
          <main className="w-full px-4 py-8 pb-28 sm:px-6 lg:px-10 lg:pb-8 2xl:px-16">
            <p role="status" aria-live="polite" className="text-sm text-muted">
              Loading page…
            </p>
          </main>
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={shouldReduceMotion ? undefined : pageVariants}
            initial={shouldReduceMotion ? { opacity: 0 } : 'initial'}
            animate={shouldReduceMotion ? { opacity: 1 } : 'animate'}
            exit={shouldReduceMotion ? { opacity: 0 } : 'exit'}
            transition={
              shouldReduceMotion
                ? { duration: 0.1 }
                : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
            }
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </Suspense>

      {/* Footer — only visible on desktop (hidden on mobile to save space) */}
      <footer className="hidden border-t border-line bg-panel lg:block">
        <div className="flex w-full flex-col gap-5 px-5 pt-8 pb-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10 2xl:px-16">
          <p>FORGE/FIT · Train with purpose.</p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link className="transition-colors hover:text-accent" to="/workouts">
              Workouts
            </Link>
            <Link className="transition-colors hover:text-accent" to="/nutrition">
              Nutrition
            </Link>
            <Link className="transition-colors hover:text-accent" to="/progress">
              Progress
            </Link>
            <Link className="transition-colors hover:text-accent" to="/settings/data">
              Privacy &amp; data
            </Link>
          </nav>
        </div>
      </footer>

      {/* Floating bottom nav (mobile) */}
      <BottomNavigation />

      {/* Floating active workout indicator */}
      <ActiveWorkoutBanner />
    </div>
  )
}

export default AppLayout
