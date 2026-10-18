import { Dumbbell } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { navigationItems } from './navigation'

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-line bg-panel px-5 py-7 lg:flex">
      <Link to="/" className="mb-10 flex items-center gap-3 px-2 text-ink">
        <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-white">
          <Dumbbell aria-hidden="true" size={20} />
        </span>
        <span className="text-lg font-semibold tracking-tight">Gym Tracker</span>
      </Link>
      <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
        Workspace
      </p>
      <nav aria-label="Main navigation" className="flex flex-col gap-1">
        {navigationItems.map(({ label, icon: Icon, href }) =>
          href ? (
            <NavLink
              key={label}
              to={href}
              end={href === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-muted hover:bg-hover hover:text-ink'
                }`
              }
            >
              <Icon aria-hidden="true" size={18} />
              {label}
            </NavLink>
          ) : (
            <button
              key={label}
              type="button"
              disabled
              aria-label={`${label}, coming soon`}
              title="Coming soon"
              className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted/60"
            >
              <Icon aria-hidden="true" size={18} />
              <span>{label}</span>
              <span className="ml-auto text-[10px] font-medium uppercase tracking-wide">
                Soon
              </span>
            </button>
          ),
        )}
      </nav>
    </aside>
  )
}

export default Sidebar
