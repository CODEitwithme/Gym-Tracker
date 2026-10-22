import { Dumbbell, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Button } from '../common'
import { navigationItems } from './navigation'

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 text-ink">
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-surface">
            <Dumbbell aria-hidden="true" size={19} />
          </span>
          <span className="font-bold tracking-tight">
            FORGE<span className="text-accent">/</span>FIT
          </span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-1 xl:flex"
        >
          {navigationItems.map(({ label, href }) => (
            <NavLink
              key={label}
              to={href ?? '/'}
              end={href === '/'}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <Link to="/workouts" className="hidden xl:block">
          <Button size="small">Start training</Button>
        </Link>
        <button
          type="button"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-site-menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex size-11 items-center justify-center rounded-lg text-ink hover:bg-hover xl:hidden"
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
      {menuOpen && (
        <nav
          id="mobile-site-menu"
          aria-label="Main navigation"
          className="absolute inset-x-0 top-full border-b border-line bg-panel p-3 shadow-xl xl:hidden"
        >
          <div className="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
            {navigationItems.map(({ label, icon: Icon, href }) => (
              <NavLink
                key={label}
                to={href ?? '/'}
                end={href === '/'}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium ${
                    isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-hover'
                  }`
                }
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}

export default Header
