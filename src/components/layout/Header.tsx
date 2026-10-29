import { Dumbbell, Moon, Sun, X, Menu } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useTheme } from '../../app/useTheme'
import { navigationItems } from './navigation'
import { springSmooth } from '../../lib/motion'

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const shouldReduceMotion = useReducedMotion()

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b border-line/60 bg-panel/90 backdrop-blur-md"
        style={{ boxShadow: '0 1px 0 0 var(--theme-border)' }}
      >
        <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          {/* Wordmark */}
          <Link
            to="/"
            className="group flex shrink-0 items-center gap-2.5 text-ink transition-opacity hover:opacity-90"
          >
            <motion.span
              whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
              className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-fg shadow-sm"
            >
              <Dumbbell aria-hidden="true" size={16} />
            </motion.span>
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
                  `relative min-h-9 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
                    isActive ? 'text-accent font-semibold' : 'text-muted hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="desktopNavIndicator"
                        transition={
                          shouldReduceMotion
                            ? { duration: 0 }
                            : springSmooth
                        }
                        className="absolute inset-0 rounded-xl bg-accent/10"
                        aria-hidden="true"
                      />
                    )}
                    <span className="relative z-10">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <motion.button
              type="button"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              onClick={toggleTheme}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.88, rotate: 15 }}
              whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
              className="flex size-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={shouldReduceMotion ? false : { opacity: 0, rotate: -30, scale: 0.8 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, rotate: 30, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center justify-center"
                >
                  {theme === 'dark' ? (
                    <Sun aria-hidden="true" size={18} />
                  ) : (
                    <Moon aria-hidden="true" size={18} />
                  )}
                </motion.span>
              </AnimatePresence>
            </motion.button>

            {/* Hamburger only between sm and xl */}
            <motion.button
              type="button"
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-site-menu"
              whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
              onClick={() => setMenuOpen((open) => !open)}
              className="flex size-10 items-center justify-center rounded-xl text-ink transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent xl:hidden"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </motion.button>
          </div>
        </div>

        {/* Slide-down menu (sm → xl) */}
        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              id="mobile-site-menu"
              aria-label="Main navigation"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-b border-line bg-panel/95 backdrop-blur-md xl:hidden"
              style={{ boxShadow: 'var(--shadow-float)' }}
            >
              <div className="mx-auto grid max-w-7xl gap-1 p-3 sm:grid-cols-2">
                {navigationItems.map(({ label, icon: Icon, href }) => (
                  <NavLink
                    key={label}
                    to={href ?? '/'}
                    end={href === '/'}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-accent/10 text-accent font-semibold'
                          : 'text-muted hover:bg-hover hover:text-ink'
                      }`
                    }
                  >
                    <Icon size={17} aria-hidden="true" />
                    {label}
                  </NavLink>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
    </>
  )
}

export default Header
