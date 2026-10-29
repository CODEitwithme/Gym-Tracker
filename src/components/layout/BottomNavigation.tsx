import { NavLink, useLocation } from 'react-router-dom'
import { navigationItems } from './navigation'

const mobileNavigationLabels = new Set([
  'Dashboard',
  'Workouts',
  'Progress',
  'Nutrition',
  'Settings',
])

function BottomNavigation() {
  const { pathname } = useLocation()
  if (pathname === '/workouts/active') return null

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-4 bottom-4 z-20 lg:hidden"
      style={{
        bottom: 'calc(1rem + env(safe-area-inset-bottom))',
        boxShadow: 'var(--shadow-float)',
      }}
    >
      <div className="flex items-center justify-around rounded-2xl border border-line bg-panel px-1 py-1.5">
        {navigationItems
          .filter(({ label }) => mobileNavigationLabels.has(label))
          .map(({ label, icon: Icon, href }) => (
            <NavLink
              key={label}
              to={href ?? '/'}
              end={href === '/'}
              aria-label={label}
              className={({ isActive }) =>
                `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-colors duration-150 ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex size-8 items-center justify-center rounded-xl transition-all duration-150 ${
                      isActive
                        ? 'bg-accent text-surface scale-105'
                        : 'scale-100'
                    }`}
                  >
                    <Icon aria-hidden="true" size={17} />
                  </span>
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          ))}
      </div>
    </nav>
  )
}

export default BottomNavigation
