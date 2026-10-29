/**
 * Sheet — context-aware bottom sheet (mobile) / side panel (desktop-wide)
 * powered by motion.dev (motion/react).
 *
 * Focus management, Escape handling, body scroll locking, and backdrop click
 * are strictly preserved while transitions use spring physics and AnimatePresence.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import {
  backdropVariants,
  sheetBottomVariants,
  sheetRightVariants,
} from '../../lib/motion'

type SheetProps = {
  open: boolean
  onClose: () => void
  closeBlocked?: boolean
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  /**
   * 'bottom'  — always bottom sheet regardless of viewport (default).
   * 'adaptive' — bottom sheet on mobile, right panel on lg+.
   */
  variant?: 'bottom' | 'adaptive'
}

/** Shared stack so Sheet and Modal cooperate on Esc / focus trap */
const openLayerIds: string[] = []
let savedBodyOverflow: string | null = null

export function Sheet({
  open,
  onClose,
  closeBlocked = false,
  title,
  children,
  footer,
  variant = 'bottom',
}: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const layerId = useId()
  const onCloseRef = useRef(onClose)
  const closeBlockedRef = useRef(closeBlocked)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    closeBlockedRef.current = closeBlocked
  }, [closeBlocked])

  /* Focus trap + Escape */
  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement
    if (openLayerIds.length === 0) {
      savedBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    openLayerIds.push(layerId)

    const getFocusable = () =>
      sheetRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )

    const firstFocusable = getFocusable()?.[0]
    ;(firstFocusable ?? sheetRef.current)?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (openLayerIds.at(-1) !== layerId) return
      if (e.key === 'Escape') {
        if (closeBlockedRef.current) return
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const focusable = getFocusable()
      if (!focusable?.length) {
        e.preventDefault()
        sheetRef.current?.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      const idx = openLayerIds.lastIndexOf(layerId)
      if (idx !== -1) openLayerIds.splice(idx, 1)
      if (openLayerIds.length === 0) {
        document.body.style.overflow = savedBodyOverflow ?? ''
        savedBodyOverflow = null
      }
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus()
      }
    }
  }, [layerId, open])

  if (typeof document === 'undefined') return null

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      e.target === e.currentTarget &&
      !closeBlockedRef.current &&
      openLayerIds.at(-1) === layerId
    ) {
      onCloseRef.current()
    }
  }

  const isAdaptiveSide = variant === 'adaptive'

  // Variants selection: if reduced motion, fade only; otherwise use spring slide
  const sheetVariants = shouldReduceMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : isAdaptiveSide && typeof window !== 'undefined' && window.innerWidth >= 1024
      ? sheetRightVariants
      : sheetBottomVariants

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key={layerId}
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex bg-ink/50 backdrop-blur-[2px]"
          onClick={handleBackdrop}
          aria-hidden={!open}
        >
          {/* Sheet panel */}
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ boxShadow: 'var(--shadow-sheet)' }}
            className={[
              /* base */
              'absolute flex flex-col bg-panel outline-none',
              /* mobile: bottom sheet */
              'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl',
              /* lg+: right side panel when adaptive */
              isAdaptiveSide
                ? 'lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:bottom-auto lg:max-h-none lg:w-[440px] lg:rounded-none lg:rounded-l-3xl'
                : '',
            ].join(' ')}
          >
            {/* Handle bar (mobile only) */}
            <div
              className="flex shrink-0 justify-center pt-3 pb-1 lg:hidden"
              aria-hidden="true"
            >
              <div className="h-1 w-10 rounded-full bg-line" />
            </div>

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
              <h2 id={titleId} className="text-base font-semibold text-ink">
                {title}
              </h2>
              <motion.button
                type="button"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
                onClick={() => {
                  if (!closeBlocked) onCloseRef.current()
                }}
                disabled={closeBlocked}
                aria-label="Close"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X aria-hidden="true" size={18} />
              </motion.button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {children}
            </div>

            {/* Footer */}
            {footer != null && (
              <div className="shrink-0 border-t border-line px-5 py-4 pb-safe-4 sm:px-6">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export default Sheet
