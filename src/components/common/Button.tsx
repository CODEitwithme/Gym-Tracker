import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'

export type ButtonSize = 'small' | 'medium' | 'large'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  loading?: boolean
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-transparent bg-accent text-white hover:bg-accent-hover disabled:bg-accent/60',
  secondary:
    'border border-transparent bg-hover text-ink hover:bg-line disabled:text-muted/60',
  outline:
    'border border-line bg-panel text-ink hover:bg-hover disabled:text-muted/60',
  ghost:
    'border border-transparent bg-transparent text-muted hover:bg-hover hover:text-ink disabled:text-muted/50',
  danger:
    'border border-transparent bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/60',
}

const sizeClasses: Record<ButtonSize, string> = {
  small: 'min-h-10 gap-1.5 rounded-md px-3 text-xs',
  medium: 'min-h-10 gap-2 rounded-lg px-4 text-sm',
  large: 'min-h-12 gap-2.5 rounded-lg px-5 text-base',
}

function Button({
  variant = 'primary',
  size = 'medium',
  icon: Icon,
  loading = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading
  const classes = [
    'inline-flex items-center justify-center font-semibold transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'disabled:cursor-not-allowed',
    variantClasses[variant],
    sizeClasses[size],
    className,
  ].join(' ')

  return (
    <button
      {...props}
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
      ) : (
        Icon && <Icon aria-hidden="true" size={16} />
      )}
      {children}
    </button>
  )
}

export default Button
