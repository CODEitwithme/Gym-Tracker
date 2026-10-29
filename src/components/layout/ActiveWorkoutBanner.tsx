/**
 * ActiveWorkoutBanner — A compact floating pill that appears whenever a
 * workout is in progress and the user is NOT on the active workout page.
 *
 * It reads elapsed time from the workout's startedAt, stored in Redux.
 * Tapping it navigates to /workouts/active.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Dumbbell } from 'lucide-react'
import { useAppSelector } from '../../app/hooks'
import { loadActiveWorkout } from '../../features/workouts/workoutService'

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
  const activeWorkoutId = useAppSelector((s) => s.workoutUi.activeWorkoutId)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [workoutName, setWorkoutName] = useState<string>('')
  const [now, setNow] = useState(Date.now())

  /* Load startedAt when an active workout exists */
  useEffect(() => {
    if (!activeWorkoutId) {
      setStartedAt(null)
      setWorkoutName('')
      return
    }
    let cancelled = false
    void loadActiveWorkout().then((session) => {
      if (!cancelled && session) {
        setStartedAt(session.startedAt)
        setWorkoutName(session.name)
      }
    })
    return () => { cancelled = true }
  }, [activeWorkoutId])

  /* Tick every second */
  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [startedAt])

  /* Hide on the active workout page or when no active workout */
  if (!activeWorkoutId || !startedAt || pathname === '/workouts/active') return null

  return (
    <button
      type="button"
      aria-label="Return to active workout"
      onClick={() => navigate('/workouts/active')}
      style={{
        boxShadow: 'var(--shadow-float)',
        /* sit just above the floating bottom nav */
        bottom: 'calc(5.5rem + env(safe-area-inset-bottom))',
      }}
      className="animate-toast-in fixed right-4 z-30 flex items-center gap-2.5 rounded-2xl border border-accent/20 bg-accent px-3.5 py-2 text-surface transition-all duration-150 hover:bg-accent-hover active:scale-95 lg:bottom-6 lg:right-6"
    >
      <span className="flex size-6 shrink-0 items-center justify-center">
        <Dumbbell aria-hidden="true" size={14} />
      </span>
      <span className="flex flex-col items-start leading-none">
        <span className="text-[10px] font-medium opacity-80">
          {workoutName || 'Workout in progress'}
        </span>
        <time className="text-sm font-bold tabular-nums">
          {formatElapsed(startedAt, now)}
        </time>
      </span>
    </button>
  )
}

export default ActiveWorkoutBanner

