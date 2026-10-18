import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type EmptyStateProps = {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
}

function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      {Icon && (
        <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Icon aria-hidden="true" size={21} />
        </span>
      )}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description != null && (
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted">
          {description}
        </p>
      )}
      {action != null && <div className="mt-5">{action}</div>}
    </div>
  )
}

export default EmptyState
