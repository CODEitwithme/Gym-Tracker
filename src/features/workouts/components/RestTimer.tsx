import { useEffect, useRef, useState } from 'react'
import { Bell, BellOff, Pause, Play, Plus, RotateCcw, X } from 'lucide-react'
import { motion } from 'motion/react'
import { playTimerCompletionSound } from '../../../lib/audioTimer'

interface RestTimerProps {
  initialSeconds?: number
  onDismiss: () => void
}

export function RestTimer({ initialSeconds = 90, onDismiss }: RestTimerProps) {
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds)
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds)
  const [isRunning, setIsRunning] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [hasCompleted, setHasCompleted] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isRunning || secondsLeft <= 0) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    timerRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          setIsRunning(false)
          setHasCompleted(true)
          if (soundEnabled) {
            playTimerCompletionSound()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRunning, secondsLeft, soundEnabled])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const handleAdjust = (delta: number) => {
    setSecondsLeft((prev) => Math.max(0, prev + delta))
    setTotalSeconds((prev) => Math.max(prev, secondsLeft + delta))
    setHasCompleted(false)
  }

  const handlePreset = (seconds: number) => {
    setTotalSeconds(seconds)
    setSecondsLeft(seconds)
    setIsRunning(true)
    setHasCompleted(false)
  }

  const progressPercent = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 100

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-lg rounded-2xl border p-4 shadow-2xl backdrop-blur-md transition-colors sm:bottom-6 ${
        hasCompleted
          ? 'border-emerald-500/60 bg-emerald-950/90 text-emerald-100 ring-2 ring-emerald-500/30'
          : 'border-line/80 bg-panel/95 text-ink'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Time display */}
        <div className="flex items-center gap-3">
          <div className="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface font-mono text-lg font-bold text-ink">
            {hasCompleted ? (
              <span className="text-emerald-400">✓</span>
            ) : (
              <span>{formatTime(secondsLeft)}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                {hasCompleted ? 'Rest Complete!' : 'Rest Timer'}
              </span>
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                aria-label={soundEnabled ? 'Mute timer chime' : 'Enable timer chime'}
                className="text-muted hover:text-ink transition-colors"
                title={soundEnabled ? 'Chime sound is ON' : 'Chime sound is MUTED'}
              >
                {soundEnabled ? <Bell size={13} /> : <BellOff size={13} />}
              </button>
            </div>
            <p className="text-sm font-medium text-ink">
              {hasCompleted ? 'Ready for your next set!' : `${formatTime(secondsLeft)} remaining`}
            </p>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleAdjust(30)}
            aria-label="Add 30 seconds"
            className="flex items-center gap-0.5 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-medium text-ink hover:bg-hover active:scale-95 transition-all"
          >
            <Plus size={12} />
            <span>30s</span>
          </button>

          {!hasCompleted && (
            <button
              type="button"
              onClick={() => setIsRunning(!isRunning)}
              aria-label={isRunning ? 'Pause rest timer' : 'Resume rest timer'}
              className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-fg hover:opacity-90 active:scale-95 transition-all"
            >
              {isRunning ? <Pause size={14} /> : <Play size={14} />}
            </button>
          )}

          {hasCompleted && (
            <button
              type="button"
              onClick={() => handlePreset(initialSeconds)}
              aria-label="Restart rest timer"
              className="flex size-8 items-center justify-center rounded-lg bg-emerald-500 text-white hover:opacity-90 active:scale-95 transition-all"
            >
              <RotateCcw size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close rest timer"
            className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink transition-all"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Progress line */}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full transition-all duration-300 ${
            hasCompleted ? 'bg-emerald-400' : 'bg-accent'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
        />
      </div>

      {/* Presets footer */}
      <div className="mt-2.5 flex items-center justify-between gap-1 text-[11px] text-muted">
        <span>Quick switch:</span>
        <div className="flex items-center gap-1">
          {[60, 90, 120, 180].map((presetSecs) => (
            <button
              key={presetSecs}
              type="button"
              onClick={() => handlePreset(presetSecs)}
              className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
                totalSeconds === presetSecs && !hasCompleted
                  ? 'bg-accent/20 text-accent font-semibold'
                  : 'hover:bg-hover hover:text-ink'
              }`}
            >
              {presetSecs >= 60 ? `${presetSecs / 60}m` : `${presetSecs}s`}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
