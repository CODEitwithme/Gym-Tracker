import { Dumbbell } from 'lucide-react'

function Header() {
  return (
    <header className="flex h-[72px] items-center border-b border-line bg-panel px-5 sm:px-8 lg:px-10">
      <div className="flex items-center gap-2.5 lg:hidden">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-white">
          <Dumbbell aria-hidden="true" size={16} />
        </span>
        <span className="font-semibold tracking-tight text-ink">Gym Tracker</span>
      </div>
      <div className="hidden text-sm font-medium text-muted lg:block">
        Personal fitness
      </div>
    </header>
  )
}

export default Header
