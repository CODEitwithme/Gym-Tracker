import { useState } from 'react'
import { Mic, MicOff, Sparkles } from 'lucide-react'
import { Button } from '../../../components/common'
import { useVoiceDictation } from '../useVoiceDictation'
import { parseWorkoutMessage } from '../../ai-logger/aiLoggerService'
import { extractWorkoutContext, type ParsedWorkoutContext } from '../workoutTimeParser'
import type { ParsedWorkout } from '../../ai-logger/types'

export interface PostWorkoutHeroCardProps {
  onParsedReady: (data: {
    prompt: string
    parsed: ParsedWorkout
    context: ParsedWorkoutContext
  }) => void
}

const FAST_TIME_CHIPS = [
  {
    label: '⚡ Just finished (last 1 hr)',
    prefix: 'Just finished my workout today (1 hour). ',
  },
  {
    label: '🌙 Evening (5:30 – 6:45 PM)',
    prefix: 'Trained today from 5:30 to 6:45 PM. ',
  },
  {
    label: '🌅 Morning (7:00 – 8:15 AM)',
    prefix: 'Trained today from 7:00 to 8:15 AM. ',
  },
  {
    label: '⏮️ Yesterday session',
    prefix: 'Trained yesterday from 6:00 to 7:15 PM. ',
  },
]

export function PostWorkoutHeroCard({ onParsedReady }: PostWorkoutHeroCardProps) {
  const [prompt, setPrompt] = useState('')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { isListening, isSupported, toggleListening, stopListening } =
    useVoiceDictation((transcript) => {
      setPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript))
    })

  const handleChipClick = (prefix: string) => {
    setPrompt((prev) => {
      if (!prev) return prefix
      // If prompt already has time prefix, replace or prepend
      return `${prefix}${prev}`
    })
  }

  const handleParse = async () => {
    const trimmed = prompt.trim()
    if (!trimmed || parsing) return

    stopListening()
    setParsing(true)
    setError(null)

    try {
      const parsed = await parseWorkoutMessage(trimmed)
      const context = extractWorkoutContext(trimmed, parsed)
      onParsedReady({
        prompt: trimmed,
        parsed,
        context,
      })
      setPrompt('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to parse workout. Please check your text.',
      )
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent/30 bg-panel p-4 shadow-sm shadow-ink/[0.04] sm:p-6">
      {/* Decorative gradient corner */}
      <div className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full bg-accent/10 blur-2xl" />

      <div className="relative space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink sm:text-lg">
                Log Today's Workout
              </h2>
              <p className="text-xs text-muted">
                Done with the gym? Drop your summary or speak hands-free.
              </p>
            </div>
          </div>

          {isSupported && (
            <button
              type="button"
              onClick={toggleListening}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse ring-2 ring-rose-400/50'
                  : 'border border-line bg-surface text-ink hover:border-accent hover:text-accent'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="size-3.5" />
                  Listening... Tap to Stop
                </>
              ) : (
                <>
                  <Mic className="size-3.5 text-accent" />
                  Voice Dictate
                </>
              )}
            </button>
          )}
        </div>

        {/* Quick Time Presets */}
        <div className="flex flex-wrap gap-1.5">
          {FAST_TIME_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleChipClick(chip.prefix)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-muted transition hover:border-accent/40 hover:text-ink"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
            {error}
          </p>
        )}

        {/* Input box */}
        <div className="relative">
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Trained today from 5:30 to 6:45 PM. Chest Day: Barbell Bench Press 4x10 at 80kg, Incline Dumbbell Press 3x12 at 28kg, Cable Pushdowns 4x15 at 25kg..."
            className="w-full rounded-xl border border-line bg-surface p-3 pr-20 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                void handleParse()
              }
            }}
          />
        </div>

        {/* Bottom row actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-xs text-muted">
            Tip: State your times (e.g. 6 to 7:15 PM) to record exact duration.
          </span>
          <Button
            icon={Sparkles}
            loading={parsing}
            disabled={parsing || !prompt.trim()}
            onClick={() => void handleParse()}
          >
            Parse & Review
          </Button>
        </div>
      </div>
    </div>
  )
}

export default PostWorkoutHeroCard
