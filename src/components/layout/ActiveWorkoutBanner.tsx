/**
 * ActiveWorkoutBanner — A compact floating pill that appears whenever a
 * workout is in progress and the user is NOT on the active workout page.
 *
 * It reads elapsed time from the workout's startedAt, stored in Redux.
 * Tapping it navigates to /workouts/active.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Dumbbell, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useAppSelector } from '../../app/hooks'
import { loadActiveWorkout } from '../../features/workouts/workoutService'
import { springTactile } from '../../lib/motion'

function formatElapsed(startedAt: string, now: number): string {
  const totalSeconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function ActiveWorkoutBanner() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const shouldReduceMotion = useReducedMotion()
  const activeWorkoutId = useAppSelector((s) => s.workoutUi.activeWorkoutId)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [workoutName, setWorkoutName] = useState<string>('')
  const [now, setNow] = useState(() => Date.now())

  /* Load startedAt when an active workout exists */
  useEffect(() => {
    if (!activeWorkoutId) return
    let cancelled = false
    void loadActiveWorkout().then((session) => {
      if (!cancelled && session) {
        setStartedAt(session.startedAt)
        setWorkoutName(session.name)
      }
    })
    return () => {
      cancelled = true
    }
  }, [activeWorkoutId])

  /* Tick every second */
  useEffect(() => {
    if (!activeWorkoutId || !startedAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [activeWorkoutId, startedAt])

  const effectiveStartedAt = activeWorkoutId ? startedAt : null
  const effectiveName = activeWorkoutId ? workoutName : ''
  const isVisible = Boolean(activeWorkoutId && effectiveStartedAt && pathname !== '/workouts/active')

  return (
    <AnimatePresence>
      {isVisible && effectiveStartedAt && (
        <motion.button
          key="active-workout-pill"
          type="button"
          aria-label="Return to active workout"
          onClick={() => navigate('/workouts/active')}
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 24, scale: 0.94 }
          }
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            transition: springTactile,
          }}
          exit={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 16, scale: 0.94, transition: { duration: 0.15 } }
          }
          whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
          whileHover={
            shouldReduceMotion
              ? undefined
              : { scale: 1.02, filter: 'brightness(1.05)' }
          }
          style={{
            boxShadow: 'var(--shadow-float)',
            bottom: 'calc(5.5rem + env(safe-area-inset-bottom))',
          }}
          className="fixed right-4 z-30 flex cursor-pointer items-center gap-3 rounded-2xl border border-accent/30 bg-accent px-4 py-2.5 text-accent-fg select-none lg:bottom-6 lg:right-6"
        >
          {/* Pulsing indicator & dumbbell icon */}
          <span className="relative flex size-7 shrink-0 items-center justify-center rounded-xl bg-accent-fg/15">
            <span
              className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent-fg animate-pulse"
              aria-hidden="true"
            />
            <Dumbbell aria-hidden="true" size={15} />
          </span>

          <span className="flex flex-col items-start text-left leading-tight">
            <span className="max-w-[140px] truncate text-[11px] font-medium text-surface/85">
              {effectiveName || 'Workout active'}
            </span>
            <time className="text-sm font-bold tabular-nums tracking-wide">
              {formatElapsed(effectiveStartedAt, now)}
            </time>
          </span>

          <ArrowRight aria-hidden="true" size={15} className="ml-0.5 opacity-80" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}

export default ActiveWorkoutBanner
