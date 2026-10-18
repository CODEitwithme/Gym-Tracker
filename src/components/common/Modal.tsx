import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'

type ModalProps = {
  open: boolean
  onClose: () => void
  closeBlocked?: boolean
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
}

const openModalIds: string[] = []
let bodyOverflowBeforeModal: string | null = null

function Modal({
  open,
  onClose,
  closeBlocked = false,
  title,
  children,
  footer,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const modalId = useId()
  const onCloseRef = useRef(onClose)
  const closeBlockedRef = useRef(closeBlocked)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    closeBlockedRef.current = closeBlocked
  }, [closeBlocked])

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement
    if (openModalIds.length === 0) {
      bodyOverflowBeforeModal = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    openModalIds.push(modalId)

    const getFocusableElements = () =>
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )

    const firstFocusable = getFocusableElements()?.[0]
    ;(firstFocusable ?? dialogRef.current)?.focus()

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (openModalIds.at(-1) !== modalId) return
      if (event.key === 'Escape') {
        if (closeBlockedRef.current) return
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return
      const focusableElements = getFocusableElements()
      if (!focusableElements?.length) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      const index = openModalIds.lastIndexOf(modalId)
      if (index !== -1) openModalIds.splice(index, 1)
      if (openModalIds.length === 0) {
        document.body.style.overflow = bodyOverflowBeforeModal ?? ''
        bodyOverflowBeforeModal = null
      }
      if (
        previouslyFocused instanceof HTMLElement &&
        previouslyFocused.isConnected
      ) {
        previouslyFocused.focus()
      }
    }
  }, [modalId, open])

  if (!open || typeof document === 'undefined') return null

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (
      event.target === event.currentTarget &&
      !closeBlocked &&
      openModalIds.at(-1) === modalId
    ) {
      onCloseRef.current()
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-panel shadow-xl outline-none sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => {
              if (!closeBlocked) onCloseRef.current()
            }}
            disabled={closeBlocked}
            aria-label="Close dialog"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="px-5 py-5 sm:px-6">{children}</div>
        {footer != null && (
          <div className="border-t border-line px-5 py-4 sm:px-6">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}

export default Modal
