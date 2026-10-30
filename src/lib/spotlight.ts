/**
 * Cursor spotlight for glass panels.
 *
 * One document-level pointer listener finds the glass panel under the
 * cursor and writes the pointer position into its --mx / --my custom
 * properties. The CSS in index.css turns those into a soft radial glow
 * that follows the cursor across the card.
 */
const PANEL_SELECTOR = '.bg-panel, [class*=" bg-panel/"], [class^="bg-panel/"]'

export function installSpotlight(): () => void {
  if (typeof window === 'undefined') return () => {}
  if (window.matchMedia('(hover: none)').matches) return () => {}

  let frame = 0
  let lastEvent: PointerEvent | null = null

  const update = () => {
    frame = 0
    const event = lastEvent
    if (!event) return
    const target = event.target as Element | null
    const panel = target?.closest?.(PANEL_SELECTOR) as HTMLElement | null
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    panel.style.setProperty('--mx', `${event.clientX - rect.left}px`)
    panel.style.setProperty('--my', `${event.clientY - rect.top}px`)
  }

  const onMove = (event: PointerEvent) => {
    lastEvent = event
    if (!frame) frame = requestAnimationFrame(update)
  }

  document.addEventListener('pointermove', onMove, { passive: true })
  return () => {
    document.removeEventListener('pointermove', onMove)
    if (frame) cancelAnimationFrame(frame)
  }
}
