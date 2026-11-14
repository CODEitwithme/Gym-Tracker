import { useState } from 'react'
import { Dumbbell, Mic, MicOff, Sparkles } from 'lucide-react'
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

export interface LogWorkoutModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void | Promise<void>
  initialMode?: 'manual' | 'ai'
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

function getDefaultTimeRange() {
  const now = new Date()
  const endHours = String(now.getHours()).padStart(2, '0')
  const endMins = String(now.getMinutes()).padStart(2, '0')
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const startHours = String(oneHourAgo.getHours()).padStart(2, '0')
  const startMins = String(oneHourAgo.getMinutes()).padStart(2, '0')
  return {
    startTime: `${startHours}:${startMins}`,
    endTime: `${endHours}:${endMins}`,
  }
}

function createDefaultEmptyWorkout(): ParsedWorkout {
  return {
    exercises: [
      {
        exercise: '',
        weight: null,
        unit: 'kg',
        reps: 10,
        sets: 3,
        durationSeconds: null,
        notes: '',
      },
    ],
    exercise: '',
    weight: null,
    unit: 'kg',
    reps: 10,
    sets: 3,
    durationSeconds: null,
    notes: '',
    confidence: 'high',
    followUpQuestion: null,
  }
}

function LogWorkoutDialog({
  onClose,
  onSaved,
  initialMode = 'manual',
  initialPrompt = '',
  initialParsedWorkout = null,
  initialSessionName = 'Workout',
  initialDate,
  initialStartTime,
  initialEndTime,
}: Omit<LogWorkoutModalProps, 'open'>) {
  const defaultTimes = getDefaultTimeRange()
  const [sessionName, setSessionName] = useState(initialSessionName)
  const [date, setDate] = useState(() => initialDate ?? formatLocalDate(new Date()))
  const [startTime, setStartTime] = useState(initialStartTime ?? defaultTimes.startTime)
  const [endTime, setEndTime] = useState(initialEndTime ?? defaultTimes.endTime)
  const [prompt, setPrompt] = useState(initialPrompt)
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>(() => {
    if (initialParsedWorkout) return 'manual'
    if (initialPrompt) return 'ai'
    return initialMode
  })
  const [parsing, setParsing] = useState(false)
  const [parsedWorkout, setParsedWorkout] = useState<ParsedWorkout>(() => {
    return initialParsedWorkout ?? createDefaultEmptyWorkout()
  })
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

  const handleReset = () => {
    stopListening()
    clearVoiceError()
    setPrompt('')
    setParsedWorkout(createDefaultEmptyWorkout())
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

      if (context.sessionName) setSessionName(context.sessionName)
      if (context.date) setDate(context.date)
      if (context.startTime) setStartTime(context.startTime)
      if (context.endTime) setEndTime(context.endTime)
      setParsedWorkout(result)
      setActiveTab('manual')
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
      open
      onClose={handleClose}
      closeBlocked={parsing || saving}
      title="Log Completed Workout"
      footer={
        activeTab === 'ai' ? (
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
              Parse &amp; Fill Form
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Mode selector tab */}
        <div className="flex items-center rounded-xl border border-line bg-surface p-1">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
              activeTab === 'manual'
                ? 'bg-panel text-ink shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            <Dumbbell className="size-3.5" />
            Manual Entry
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
              activeTab === 'ai'
                ? 'bg-panel text-ink shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            <Sparkles className="size-3.5 text-accent" />
            AI / Voice Assistant
          </button>
        </div>

        {(error || voiceError) && (
          <div
            role="alert"
            className="flex items-start justify-between gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs text-danger"
          >
            <span>{voiceError || error}</span>
            {voiceError && (
              <button
                type="button"
                onClick={clearVoiceError}
                className="shrink-0 text-danger hover:opacity-80"
                aria-label="Dismiss voice error"
              >
                &times;
              </button>
            )}
          </div>
        )}

        {activeTab === 'manual' ? (
          <div className="space-y-4">
            {/* Session info: Name, Date, Start Time, End Time */}
            <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-line bg-surface p-3 sm:grid-cols-4 text-xs">
              <div>
                <label className="text-muted block font-medium">Session Name</label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g. Chest Day"
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

            <ParsedWorkoutPreview
              workout={parsedWorkout}
              saving={saving}
              onCancel={handleClose}
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
                  Tell us when &amp; what you worked out
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
                <span>Tip: Include start &amp; end times (e.g. 6 to 7:15 PM) to auto-log duration.</span>
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

export function LogWorkoutModal(props: LogWorkoutModalProps) {
  if (!props.open) return null
  return (
    <LogWorkoutDialog
      key={`${props.initialPrompt ?? ''}-${props.initialDate ?? ''}-${props.initialSessionName ?? ''}-${props.initialMode ?? 'manual'}`}
      {...props}
    />
  )
}

// Backwards-compatible alias
export const AiLogWorkoutModal = LogWorkoutModal

export default LogWorkoutModal
