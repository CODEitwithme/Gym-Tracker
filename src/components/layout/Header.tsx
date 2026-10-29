import { Dumbbell, Moon, Sun, X, Menu } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useTheme } from '../../app/useTheme'
import { navigationItems } from './navigation'

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b border-line/60 bg-panel/90 backdrop-blur-md"
        style={{ boxShadow: '0 1px 0 0 var(--theme-border)' }}
      >
        <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          {/* Wordmark */}
          <Link to="/" className="flex shrink-0 items-center gap-2.5 text-ink">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-surface">
              <Dumbbell aria-hidden="true" size={16} />
            </span>
            <span className="text-sm font-bold tracking-[0.12em]">
              FORGE<span className="text-accent">/</span>FIT
            </span>
          </Link>

          {/* Desktop inline nav (xl+) */}
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
                  `min-h-9 rounded-xl px-3 py-1.5 text-sm font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : 'text-muted hover:bg-hover hover:text-ink'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              onClick={toggleTheme}
              className="flex size-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-hover hover:text-ink active:scale-90"
            >
              {theme === 'dark' ? (
                <Sun aria-hidden="true" size={18} />
              ) : (
                <Moon aria-hidden="true" size={18} />
              )}
            </button>
            {/* Hamburger only between sm and xl */}
            <button
              type="button"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-site-menu"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex size-10 items-center justify-center rounded-xl text-ink transition-colors hover:bg-hover active:scale-90 xl:hidden"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Slide-down menu (sm → xl) */}
        {menuOpen && (
          <nav
            id="mobile-site-menu"
            aria-label="Main navigation"
            className="absolute inset-x-0 top-full border-b border-line bg-panel/95 p-3 backdrop-blur-md xl:hidden"
            style={{ boxShadow: 'var(--shadow-float)' }}
          >
            <div className="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
              {navigationItems.map(({ label, icon: Icon, href }) => (
                <NavLink
                  key={label}
                  to={href ?? '/'}
                  end={href === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                      isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-hover hover:text-ink'
                    }`
                  }
                >
                  <Icon size={17} aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>
    </>
  )
}

export default Header
