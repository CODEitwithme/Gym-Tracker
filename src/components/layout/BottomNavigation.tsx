import { NavLink } from 'react-router-dom'
import { navigationItems } from './navigation'

function BottomNavigation() {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-panel/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {navigationItems.map(({ label, icon: Icon, href }) =>
        href ? (
          <NavLink
            key={label}
            to={href}
            end={href === '/'}
            aria-label={label}
            className={({ isActive }) =>
              `flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium ${
                isActive ? 'text-accent' : 'text-muted'
              }`
            }
          >
            <Icon aria-hidden="true" size={19} />
            <span>{label}</span>
          </NavLink>
        ) : (
          <button
            key={label}
            type="button"
            disabled
            aria-label={`${label}, coming soon`}
            className="flex min-h-16 cursor-not-allowed flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted/50"
          >
            <Icon aria-hidden="true" size={19} />
            <span>{label}</span>
          </button>
        ),
      )}
    </nav>
  )
}

export default BottomNavigation
