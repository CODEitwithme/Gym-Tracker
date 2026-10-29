import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id?: string
  label: string
  helperText?: string
  error?: string
  wrapperClassName?: string
}

function Input({
  id,
  label,
  helperText,
  error,
  required,
  disabled,
  className = '',
  wrapperClassName = '',
  ...props
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const helperId = `${inputId}-helper`
  const errorId = `${inputId}-error`
  const describedBy =
    [helperText && helperId, error && errorId].filter(Boolean).join(' ') ||
    undefined

  return (
    <div className={['flex flex-col gap-1.5', wrapperClassName].join(' ')}>
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
        )}
      </label>
      <input
        {...props}
        id={inputId}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          'min-h-10 w-full rounded-lg border bg-panel px-3 py-2 text-sm text-ink',
          'placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-1',
          'disabled:cursor-not-allowed disabled:bg-hover disabled:text-muted',
          error
            ? 'border-red-500 focus-visible:outline-red-500'
            : 'border-line focus-visible:outline-accent',
          className,
        ].join(' ')}
      />
      {helperText && (
        <p id={helperId} className="text-xs leading-5 text-muted">
          {helperText}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs leading-5 text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

export default Input
