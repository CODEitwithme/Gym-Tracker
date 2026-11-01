import { Dumbbell, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useTheme } from '../../app/useTheme'
import { navigationItems } from './navigation'
import { springSmooth } from '../../lib/motion'

function Header() {
  const { theme, toggleTheme } = useTheme()
  const shouldReduceMotion = useReducedMotion()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        data-scrolled={scrolled || undefined}
        className="app-header sticky top-0 z-30 border-b border-line bg-panel/80"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex min-h-14 w-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-10 lg:max-w-7xl 2xl:max-w-[1536px] lg:mx-auto 2xl:px-16">
          {/* Wordmark */}
          <Link
            to="/"
            className="group flex shrink-0 items-center gap-2.5 text-ink transition-opacity hover:opacity-90"
          >
            <motion.span
              whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
              className="logo-mark flex size-8 items-center justify-center rounded-lg text-accent-fg"
            >
              <Dumbbell aria-hidden="true" size={16} />
            </motion.span>
            <span className="text-sm font-bold tracking-[0.12em] lg:text-base">
              FORGE<span className="text-accent">/</span>FIT
            </span>
          </Link>

          {/* Desktop inline nav (lg+) */}
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-1 lg:flex xl:gap-1.5"
          >
            {navigationItems.map(({ label, href }) => (
              <NavLink
                key={label}
                to={href ?? '/'}
                end={href === '/'}
                className={({ isActive }) =>
                  `relative min-h-9 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent xl:px-3.5 ${
                    isActive ? 'text-accent font-semibold' : 'text-muted hover:bg-hover hover:text-ink'
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
                        className="absolute inset-0 rounded-xl bg-accent/12 ring-1 ring-accent/30 shadow-[0_4px_18px_-6px_var(--theme-accent)]"
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
          </div>
        </div>
      </header>
    </>
  )
}

export default Header
