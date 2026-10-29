import type { Transition, Variants } from 'motion/react'

/**
 * Standard spring and easing presets for Gym Tracker.
 * Tuned for mobile-first, high-framerate, tactile fitness interactions.
 */

export const springTactile: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
  mass: 0.8,
}

export const springSheet: Transition = {
  type: 'spring',
  damping: 30,
  stiffness: 340,
  mass: 0.9,
}

export const springSmooth: Transition = {
  type: 'spring',
  damping: 26,
  stiffness: 320,
}

export const springBounce: Transition = {
  type: 'spring',
  stiffness: 600,
  damping: 24,
}

export const transitionMicro: Transition = {
  duration: 0.14,
  ease: [0.22, 1, 0.36, 1],
}

export const transitionStandard: Transition = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
}

export const transitionFade: Transition = {
  duration: 0.18,
  ease: 'easeOut',
}

/** Micro-interaction presets */
export const tapScaleButton = { scale: 0.97 }
export const tapScaleSmall = { scale: 0.94 }
export const tapScalePill = { scale: 0.92 }

/** Backdrop variant for sheets and modals */
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
}

/** Bottom sheet animation variants */
export const sheetBottomVariants: Variants = {
  hidden: { y: '100%' },
  visible: {
    y: 0,
    transition: springSheet,
  },
  exit: {
    y: '100%',
    transition: { duration: 0.2, ease: [0.32, 0, 0.67, 0] },
  },
}

/** Right sheet animation variants (adaptive desktop) */
export const sheetRightVariants: Variants = {
  hidden: { x: '100%' },
  visible: {
    x: 0,
    transition: springSheet,
  },
  exit: {
    x: '100%',
    transition: { duration: 0.2, ease: [0.32, 0, 0.67, 0] },
  },
}

/** Modal dialog animation variants */
export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springSmooth,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 6,
    transition: { duration: 0.16, ease: 'easeIn' },
  },
}

/** Page transition variants */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.12, ease: 'easeIn' },
  },
}

/** Card and list item entry/exit */
export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springSmooth,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.14, ease: 'easeIn' },
  },
}

