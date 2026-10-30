import { useEffect, useState } from 'react'
import { Mic, MicOff, Sparkles } from 'lucide-react'
import { Button, Modal } from '../../../components/common'
import { formatLocalDate } from '../../../lib/dateTime'
import {
  parseWorkoutMessage,
  saveAiWorkout,
} from '../../ai-logger/aiLoggerService'
import { ParsedWorkoutPreview } from '../../ai-logger/components/ParsedWorkoutPreview'
import type { ConfirmedWorkout, ParsedWorkout } from '../../ai-logger/types'
import { extractWorkoutContext } from '../workoutTimeParser'
import { useVoiceDictation } from '../useVoiceDictation'

export interface AiLogWorkoutModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void | Promise<void>
  initialPrompt?: string
  initialParsedWorkout?: ParsedWorkout | null
  initialSessionName?: string
  initialDate?: string
  initialStartTime?: string
  initialEndTime?: string
}

const QUICK_PROMPTS = [
  'Chest & Triceps (5:30 to 6:45 PM): Bench Press 4x10 at 80kg, Incline DB Press 3x12 at 28kg, Tricep pushdowns 3x15 at 30kg',
  'Leg Day (Morning 7 to 8:15 AM): Barbell Squats 4x8 at 100kg, Leg Press 3x12 at 180kg, Hamstring Curls 3x15 at 40kg',
  'Back & Biceps (Yesterday 6 to 7 PM): Deadlift 3x5 at 140kg, Lat Pulldown 3x10 at 65kg, Barbell Curls 3x12 at 30kg',
]

export function AiLogWorkoutModal({
  open,
  onClose,
  onSaved,
  initialPrompt = '',
  initialParsedWorkout = null,
  initialSessionName = 'Workout',
  initialDate,
  initialStartTime,
  initialEndTime,
}: AiLogWorkoutModalProps) {
  const [sessionName, setSessionName] = useState(initialSessionName)
  const [date, setDate] = useState(() => initialDate ?? formatLocalDate(new Date()))
  const [startTime, setStartTime] = useState(initialStartTime ?? '17:00')
  const [endTime, setEndTime] = useState(initialEndTime ?? '18:15')
  const [prompt, setPrompt] = useState(initialPrompt)
  const [parsing, setParsing] = useState(false)
  const [parsedWorkout, setParsedWorkout] = useState<ParsedWorkout | null>(
    initialParsedWorkout,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    isListening,
    isSupported,
    error: voiceError,
    toggleListening,
    stopListening,
    clearError: clearVoiceError,
  } = useVoiceDictation((transcript) => {
    setPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript))
  })

  useEffect(() => {
    if (!open) {
      stopListening()
      return
    }
    clearVoiceError()
    setPrompt(initialPrompt)
    setParsedWorkout(initialParsedWorkout)
    setSessionName(initialSessionName)
    setDate(initialDate ?? formatLocalDate(new Date()))
    setStartTime(initialStartTime ?? '17:00')
    setEndTime(initialEndTime ?? '18:15')
    setError(null)
    setParsing(false)
    setSaving(false)
  }, [
    open,
    initialPrompt,
    initialParsedWorkout,
    initialSessionName,
    initialDate,
    initialStartTime,
    initialEndTime,
    stopListening,
    clearVoiceError,
  ])

  const handleReset = () => {
    stopListening()
    clearVoiceError()
    setPrompt('')
    setParsedWorkout(null)
    setError(null)
    setParsing(false)
    setSaving(false)
  }

  const handleClose = () => {
    if (parsing || saving) return
    handleReset()
    onClose()
  }

  const handleParse = async () => {
    const trimmed = prompt.trim()
    if (!trimmed || parsing) return

    stopListening()
    setParsing(true)
    setError(null)
    try {
      const result = await parseWorkoutMessage(trimmed)
      const context = extractWorkoutContext(trimmed, result)

      setSessionName(context.sessionName)
      setDate(context.date)
      setStartTime(context.startTime)
      setEndTime(context.endTime)
      setParsedWorkout(result)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to parse workout with AI. Please check your text.',
      )
    } finally {
      setParsing(false)
    }
  }

  const handleConfirm = async (confirmed: ConfirmedWorkout) => {
    if (saving) return

    setSaving(true)
    setError(null)
    try {
      const [startH, startM] = (startTime || '17:00').split(':').map(Number)
      const [endH, endM] = (endTime || '18:15').split(':').map(Number)
      const [year, month, day] = date.split('-').map(Number)

      const startDate = new Date(year, month - 1, day, startH, startM, 0, 0)
      let endDate = new Date(year, month - 1, day, endH, endM, 0, 0)

      if (Number.isNaN(startDate.getTime())) {
        throw new Error('Invalid start date or time.')
      }
      if (Number.isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) {
        endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
      }

      const payload: ConfirmedWorkout = {
        ...confirmed,
        sessionName: confirmed.sessionName || sessionName.trim() || 'Workout',
        startedAt: startDate.toISOString(),
        completedAt: endDate.toISOString(),
      }

      await saveAiWorkout(payload)
      await onSaved()
      handleClose()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save completed workout.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      closeBlocked={parsing || saving}
      title="Log Completed Workout"
      footer={
        parsedWorkout ? undefined : (
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button variant="ghost" disabled={parsing} onClick={handleClose}>
              Cancel
            </Button>
            <Button
              icon={Sparkles}
              loading={parsing}
              disabled={parsing || !prompt.trim()}
              onClick={() => void handleParse()}
            >
              Parse & Review
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {(error || voiceError) && (
          <div
            role="alert"
            className="flex items-start justify-between gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300"
          >
            <span>{voiceError || error}</span>
            {voiceError && (
              <button
                type="button"
                onClick={clearVoiceError}
                className="shrink-0 text-red-400 hover:text-red-200"
                aria-label="Dismiss voice error"
              >
                &times;
              </button>
            )}
          </div>
        )}

        {parsedWorkout ? (
          <div className="space-y-4">
            {/* Context details banner */}
            <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-line bg-surface p-3 sm:grid-cols-4 text-xs">
              <div>
                <label className="text-muted block font-medium">Session Name</label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="mt-1 w-full rounded border border-line bg-panel px-2 py-1 font-semibold text-ink focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-muted block font-medium">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded border border-line bg-panel px-2 py-1 text-ink focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-muted block font-medium">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full rounded border border-line bg-panel px-2 py-1 text-ink focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-muted block font-medium">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 w-full rounded border border-line bg-panel px-2 py-1 text-ink focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">
                Review & adjust exercises
              </p>
              <button
                type="button"
                onClick={() => setParsedWorkout(null)}
                className="text-xs text-accent hover:underline"
              >
                Edit prompt
              </button>
            </div>

            <ParsedWorkoutPreview
              workout={parsedWorkout}
              saving={saving}
              onCancel={() => setParsedWorkout(null)}
              onConfirm={(confirmed) => void handleConfirm(confirmed)}
            />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="ai-workout-prompt"
                  className="block text-sm font-medium text-ink"
                >
                  Tell us when & what you worked out
                </label>
                <button
                  type="button"
                  onClick={toggleListening}
                  title={
                    !isSupported
                      ? 'Voice dictation is not supported in this browser. Please use Chrome, Edge, Safari, or your device keyboard dictation.'
                      : isListening
                        ? 'Listening... Click to stop'
                        : 'Click to dictate your workout by voice'
                  }
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse ring-2 ring-rose-400/50'
                      : 'bg-accent-soft text-accent hover:bg-accent/20'
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="size-3.5" />
                      Listening... Stop
                    </>
                  ) : (
                    <>
                      <Mic className="size-3.5" />
                      Voice Dictation
                    </>
                  )}
                </button>
              </div>

              <textarea
                id="ai-workout-prompt"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Trained today from 5:30 to 6:45 PM. Chest Day: Barbell Bench Press 4x10 at 80kg, Incline Dumbbell Press 3x12 at 28kg, Cable Pushdowns 4x15 at 25kg..."
                className="w-full rounded-xl border border-line bg-panel p-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    void handleParse()
                  }
                }}
              />
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Tip: Include start & end times (e.g. 6 to 7:15 PM) to auto-log duration.</span>
                <span>Ctrl + Enter</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted">Example templates:</p>
              <div className="flex flex-col gap-1.5">
                {QUICK_PROMPTS.map((qp, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setPrompt(qp)
                    }}
                    className="truncate rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left text-xs text-muted transition hover:border-accent/40 hover:text-ink"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

export default AiLogWorkoutModal
