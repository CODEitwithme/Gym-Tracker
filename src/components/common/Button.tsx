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
    'border border-transparent bg-accent text-surface hover:bg-accent-hover active:bg-accent-hover disabled:bg-accent/60',
  secondary:
    'border border-transparent bg-hover text-ink hover:bg-line active:bg-line disabled:text-muted/60',
  outline:
    'border border-line bg-panel text-ink hover:bg-hover active:bg-hover disabled:text-muted/60',
  ghost:
    'border border-transparent bg-transparent text-muted hover:bg-hover hover:text-ink active:bg-hover disabled:text-muted/50',
  danger:
    'border border-transparent bg-danger-fill text-white hover:bg-danger-hover active:bg-danger-hover disabled:bg-danger-fill/60',
}

const sizeClasses: Record<ButtonSize, string> = {
  small: 'min-h-10 gap-1.5 rounded-xl px-3 text-xs',
  medium: 'min-h-10 gap-2 rounded-xl px-4 text-sm',
  large: 'min-h-12 gap-2.5 rounded-2xl px-5 text-base',
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
    'inline-flex items-center justify-center font-semibold',
    'transition-all duration-100 ease-out',
    'active:scale-[0.96]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'disabled:cursor-not-allowed disabled:active:scale-100',
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
