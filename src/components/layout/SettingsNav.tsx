import { Bot, Database } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export function SettingsNav() {
  return (
    <nav
      aria-label="Settings navigation"
      className="mb-6 flex flex-wrap gap-2 border-b border-line pb-3"
    >
      <NavLink
        to="/settings/ai"
        className={({ isActive }) =>
          `flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            isActive
              ? 'bg-accent text-surface shadow-sm'
              : 'text-muted hover:bg-hover hover:text-ink'
          }`
        }
      >
        <Bot size={16} aria-hidden="true" />
        <span>AI Logger Settings</span>
      </NavLink>
      <NavLink
        to="/settings/data"
        className={({ isActive }) =>
          `flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            isActive
              ? 'bg-accent text-surface shadow-sm'
              : 'text-muted hover:bg-hover hover:text-ink'
          }`
        }
      >
        <Database size={16} aria-hidden="true" />
        <span>Data Management</span>
      </NavLink>
    </nav>
  )
}

export default SettingsNav

