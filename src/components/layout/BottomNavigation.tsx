import { NavLink, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { navigationItems } from './navigation'
import { springTactile } from '../../lib/motion'

const mobileNavigationLabels = new Set([
  'Dashboard',
  'Workouts',
  'Progress',
  'Nutrition',
  'Settings',
])

function BottomNavigation() {
  const { pathname } = useLocation()
  const shouldReduceMotion = useReducedMotion()

  // Hide on active workout session page to keep screen focused on lifting
  if (pathname === '/workouts/active') return null

  const items = navigationItems.filter(({ label }) =>
    mobileNavigationLabels.has(label),
  )

  return (
    <motion.nav
      aria-label="Mobile navigation"
      initial={shouldReduceMotion ? false : { y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-4 z-20 lg:hidden"
      style={{
        bottom: 'calc(1rem + env(safe-area-inset-bottom))',
        boxShadow: 'var(--shadow-float)',
      }}
    >
      <div className="flex items-center justify-around rounded-2xl border border-line/80 bg-panel/95 px-1 py-1.5 backdrop-blur-md">
        {items.map(({ label, icon: Icon, href }) => (
          <NavLink
            key={label}
            to={href ?? '/'}
            end={href === '/'}
            aria-label={label}
            className={({ isActive }) =>
              `relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1 text-[10px] font-medium transition-colors duration-150 ${
                isActive ? 'text-accent font-semibold' : 'text-muted hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <motion.span
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.88 }}
                  className="relative flex size-8 items-center justify-center rounded-xl"
                >
                  {isActive && (
                    <motion.span
                      layoutId="bottomNavActivePill"
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : springTactile
                      }
                      className="absolute inset-0 rounded-xl bg-accent shadow-sm"
                      aria-hidden="true"
                    />
                  )}
                  <Icon
                    aria-hidden="true"
                    size={17}
                    className={`relative z-10 transition-colors duration-150 ${
                      isActive ? 'text-accent-fg' : 'text-muted'
                    }`}
                  />
                </motion.span>
                <span className="relative z-10 truncate leading-tight">
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </motion.nav>
  )
}

export default BottomNavigation
