import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Apple,
  ArrowRight,
  Bot,
  CheckCircle,
  Dumbbell,
  Key,
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
  WifiOff,
  XCircle,
} from 'lucide-react'
import { Badge, Button, Card } from '../../../components/common'
import {
  getAiCredentials,
  isWorkerConfigured,
  parseMealMessage,
  parseWorkoutMessage,
  saveAiMeal,
  saveAiWorkout,
} from '../../ai-logger/aiLoggerService'
import { ParsedMealPreview } from '../../ai-logger/components/ParsedMealPreview'
import { ParsedWorkoutPreview } from '../../ai-logger/components/ParsedWorkoutPreview'
import { useVoiceDictation } from '../../workouts/useVoiceDictation'
import type {
  AiLoggerMode,
  ConfirmedMeal,
  ConfirmedWorkout,
  ParsedMeal,
  ParsedWorkout,
} from '../../ai-logger/types'

const WORKOUT_EXAMPLES = [
  'Bench press 80kg 3x8, Incline DB press 24kg 3x10',
  'Squats 100kg 5x5, Leg press 180kg 3x10',
  'Pull-ups 4x10, Barbell rows 60kg 3x12',
  '5km run in 25 min',
]

const NUTRITION_EXAMPLES = [
  'Breakfast: 2 eggs & toast, Lunch: chicken & rice, Snack: protein shake',
  '2 eggs & toast with black coffee',
  'Lunch: 200g chicken breast, 150g rice, and broccoli',
  'Snack: Whey protein shake with milk and a banana',
]

interface DashboardAiLoggerProps {
  onActivityLogged?: () => void
  isDrawer?: boolean
}

export function DashboardAiLogger({ onActivityLogged, isDrawer }: DashboardAiLoggerProps) {
  const [mode, setMode] = useState<AiLoggerMode>('workout')
  const [inputText, setInputText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  const [pendingWorkout, setPendingWorkout] = useState<ParsedWorkout | null>(null)
  const [pendingMeal, setPendingMeal] = useState<ParsedMeal | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const isConfigured = isWorkerConfigured()
  const [loadingStatus, setLoadingStatus] = useState(isConfigured)
  const [hasKey, setHasKey] = useState(false)
  const [workerUnavailable, setWorkerUnavailable] = useState(!isConfigured)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    isListening,
    isSupported,
    error: voiceError,
    toggleListening,
    stopListening,
    clearError: clearVoiceError,
  } = useVoiceDictation((transcript) => {
    setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript))
  })

  useEffect(() => {
    if (!isConfigured) return

    let isMounted = true
    const checkCreds = async () => {
      try {
        const creds = await getAiCredentials()
        if (isMounted) {
          setHasKey(creds.hasKey)
          setWorkerUnavailable(false)
        }
      } catch {
        if (isMounted) {
          setWorkerUnavailable(true)
          setHasKey(false)
        }
      } finally {
        if (isMounted) {
          setLoadingStatus(false)
        }
      }
    }

    void checkCreds()
    return () => {
      isMounted = false
    }
  }, [isConfigured])

  const handleParse = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed || parsing || saving) return

    stopListening()
    clearVoiceError()
    setParsing(true)
    setParseError(null)
    setSaveSuccess(null)
    setSaveError(null)
    setPendingWorkout(null)
    setPendingMeal(null)

    try {
      if (mode === 'nutrition') {
        const result = await parseMealMessage(trimmed)
        setPendingMeal(result)
      } else {
        const result = await parseWorkoutMessage(trimmed)
        setPendingWorkout(result)
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : `Failed to parse ${mode === 'nutrition' ? 'meal' : 'workout'} with AI.`
      setParseError(msg)
    } finally {
      setParsing(false)
    }
  }

  const handleConfirmWorkout = async (confirmed: ConfirmedWorkout) => {
    setSaving(true)
    setSaveError(null)
    try {
      await saveAiWorkout(confirmed)
      const count = confirmed.exercises?.length ?? 1
      const names = confirmed.exercises
        ? confirmed.exercises.map((e) => e.exercise).join(', ')
        : confirmed.exercise
      setSaveSuccess(
        `Workout saved (${count} ${count === 1 ? 'exercise' : 'exercises'}: ${names})! Your progress charts have been updated.`,
      )
      setPendingWorkout(null)
      setInputText('')
      onActivityLogged?.()
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : 'Failed to save workout session.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmMeal = async (confirmed: ConfirmedMeal) => {
    setSaving(true)
    setSaveError(null)
    try {
      await saveAiMeal(confirmed)
      const count = confirmed.meals?.length ?? 1
      const cal = confirmed.calories ?? 0
      setSaveSuccess(
        `${count} ${count === 1 ? 'meal' : 'food items'} (~${cal} kcal) logged! Your nutrition totals have been updated.`,
      )
      setPendingMeal(null)
      setInputText('')
      onActivityLogged?.()
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : 'Failed to log meal intake.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleParse()
    }
  }

  const applyExample = (example: string) => {
    setInputText(example)
    textareaRef.current?.focus()
  }

  const Container = isDrawer ? 'div' : Card

  return (
    <Container className={isDrawer ? 'space-y-4' : 'border-accent/30 bg-gradient-to-b from-panel to-panel/80 shadow-sm'}>
      {/* Header bar */}
      <div className={`flex flex-wrap items-center justify-between gap-3 ${isDrawer ? 'pb-2' : 'mb-4 border-b border-line pb-4'}`}>
        <div className="flex items-center gap-3">
          {!isDrawer && (
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-sm">
              <Bot size={20} aria-hidden="true" />
            </span>
          )}
          <div>
            <div className="flex items-center gap-2">
              {!isDrawer && (
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  AI Quick Logger
                </h2>
              )}
              {loadingStatus ? (
                <Badge variant="default">Checking AI…</Badge>
              ) : workerUnavailable ? (
                <Badge variant="warning">Worker Offline</Badge>
              ) : hasKey ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  Gemini Ready
                </span>
              ) : (
                <Link to="/settings/ai">
                  <Badge variant="warning">API Key Required</Badge>
                </Link>
              )}
            </div>
            {!isDrawer && (
              <p className="text-xs text-muted">
                Log workouts or meals in plain English using Gemini AI.
              </p>
            )}
          </div>
        </div>

        {/* Action Links */}
        <div className="flex items-center gap-2">
          <Link
            to="/settings/ai"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Key size={13} aria-hidden="true" />
            <span>AI Settings</span>
          </Link>
          <Link
            to="/ai-logger"
            className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span>Full Logger</span>
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccess && (
        <div
          role="status"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200"
        >
          <div className="flex items-center gap-2">
            <CheckCircle
              aria-hidden="true"
              className="size-4 shrink-0 text-emerald-400"
            />
            <span>{saveSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccess(null)}
            className="shrink-0 text-xs font-medium text-emerald-300 underline hover:text-emerald-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Save Error */}
      {saveError && (
        <div
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200"
        >
          <XCircle aria-hidden="true" className="size-4 shrink-0 text-red-400" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Parse or Voice Error */}
      {(parseError || voiceError) && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <XCircle
                aria-hidden="true"
                className="size-4 shrink-0 text-red-400"
              />
              <span>{voiceError || parseError}</span>
            </div>
            {voiceError ? (
              <button
                type="button"
                onClick={clearVoiceError}
                className="shrink-0 text-xs font-semibold text-red-300 hover:text-white"
                aria-label="Dismiss error"
              >
                &times;
              </button>
            ) : (
              !hasKey && (
                <Link to="/settings/ai">
                  <Button size="small" variant="outline" icon={Key}>
                    Set API Key
                  </Button>
                </Link>
              )
            )}
          </div>
        </div>
      )}

      {/* Worker Offline alert */}
      {workerUnavailable && !loadingStatus && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200"
        >
          <WifiOff
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-amber-400"
          />
          <div className="space-y-1">
            <p className="font-semibold text-amber-100">
              AI Worker Backend Not Detected
            </p>
            <p className="text-amber-200/80">
              Run <code className="rounded bg-hover px-1 py-0.5">npm run dev:all</code> to
              start both the frontend and the AI worker proxy, then configure your key in{' '}
              <Link to="/settings/ai" className="underline hover:text-amber-100">
                AI Logger Settings
              </Link>.
            </p>
          </div>
        </div>
      )}

      {/* Missing Key prompt */}
      {!loadingStatus && !workerUnavailable && !hasKey && (
        <div
          role="note"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent/5 p-3.5 text-xs text-ink"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="size-4 text-accent" aria-hidden="true" />
            <span>
              Get started by adding your free Google Gemini API key to activate AI logging.
            </span>
          </div>
          <Link to="/settings/ai">
            <Button size="small" variant="primary" icon={Key}>
              Configure Key
            </Button>
          </Link>
        </div>
      )}

      {/* Mode Selector and Input */}
      {!pendingWorkout && !pendingMeal && (
        <form onSubmit={handleParse} className="space-y-3">
          {/* Mode Switcher */}
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-1 w-fit">
            <button
              type="button"
              onClick={() => {
                setMode('workout')
                setParseError(null)
              }}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                mode === 'workout'
                  ? 'bg-accent text-accent-fg shadow-sm'
                  : 'text-muted hover:text-ink hover:bg-hover'
              }`}
            >
              <Dumbbell aria-hidden="true" size={14} />
              <span>Workout</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('nutrition')
                setParseError(null)
              }}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                mode === 'nutrition'
                  ? 'bg-accent text-accent-fg shadow-sm'
                  : 'text-muted hover:text-ink hover:bg-hover'
              }`}
            >
              <Apple aria-hidden="true" size={14} />
              <span>Food &amp; Nutrition</span>
            </button>
          </div>

          {/* Text Area */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={parsing || saving}
              placeholder={
                mode === 'workout'
                  ? 'e.g. Bench press 80kg 3x8, Incline DB press 24kg 3x10, Lateral raise 10kg 3x15...'
                  : 'e.g. Breakfast: 2 eggs & toast. Lunch: 200g chicken with rice. Snack: protein shake...'
              }
              aria-label={
                mode === 'workout' ? 'Describe your workout' : 'Describe your meal'
              }
              className="w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
            />
          </div>

          {/* Example prompt pills & Action bar */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <span className="font-medium text-ink">Try:</span>
              {(mode === 'workout' ? WORKOUT_EXAMPLES : NUTRITION_EXAMPLES).map(
                (example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => applyExample(example)}
                    className="rounded-lg border border-line bg-surface px-2 py-0.5 text-[11px] text-muted transition-colors hover:border-accent hover:text-accent"
                  >
                    {example}
                  </button>
                ),
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={toggleListening}
                title={
                  !isSupported
                    ? 'Voice dictation is not supported in this browser. Please use Chrome, Edge, Safari, or device keyboard dictation.'
                    : isListening
                      ? 'Listening... Click to stop'
                      : 'Dictate with your microphone'
                }
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse ring-2 ring-rose-400/50'
                    : 'border border-line bg-surface text-ink hover:border-accent hover:text-accent'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff size={13} aria-hidden="true" />
                    <span>Listening…</span>
                  </>
                ) : (
                  <>
                    <Mic size={13} className="text-accent" aria-hidden="true" />
                    <span>Voice</span>
                  </>
                )}
              </button>
              {inputText.trim() && (
                <Button
                  type="button"
                  size="small"
                  variant="ghost"
                  icon={RotateCcw}
                  onClick={() => setInputText('')}
                  disabled={parsing}
                >
                  Clear
                </Button>
              )}
              <Button
                type="submit"
                size="small"
                variant="primary"
                icon={Sparkles}
                loading={parsing}
                disabled={!inputText.trim() || parsing || saving}
              >
                {parsing ? 'Parsing with AI…' : 'Log with AI'}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Review Parsed Workout */}
      {pendingWorkout && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              Step 2: Review and Save
            </p>
            <Button
              size="small"
              variant="ghost"
              onClick={() => setPendingWorkout(null)}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
          <ParsedWorkoutPreview
            workout={pendingWorkout}
            onConfirm={handleConfirmWorkout}
            onCancel={() => setPendingWorkout(null)}
            saving={saving}
          />
        </div>
      )}

      {/* Review Parsed Meal */}
      {pendingMeal && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              Step 2: Review and Save
            </p>
            <Button
              size="small"
              variant="ghost"
              onClick={() => setPendingMeal(null)}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
          <ParsedMealPreview
            meal={pendingMeal}
            onConfirm={handleConfirmMeal}
            onCancel={() => setPendingMeal(null)}
            saving={saving}
          />
        </div>
      )}
    </Container>
  )
}

export default DashboardAiLogger
