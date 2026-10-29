import type { HTMLAttributes, ReactNode } from 'react'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

function Card({
  title,
  description,
  actions,
  children,
  className = '',
  ...props
}: CardProps) {
  const hasHeader = title != null || description != null || actions != null

  return (
    <div
      {...props}
      style={{ boxShadow: 'var(--shadow-card)', ...((props as { style?: React.CSSProperties }).style ?? {}) }}
      className={[
        'rounded-2xl border border-line bg-panel',
        className,
      ].join(' ')}
    >
      {hasHeader && (
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {title != null && (
              <h2 className="break-words text-base font-semibold text-ink">{title}</h2>
            )}
            {description != null && (
              <p className="mt-1 text-sm leading-5 text-muted">{description}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  )
}

export default Card
