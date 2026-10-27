import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Apple,
  Bot,
  CheckCircle,
  Dumbbell,
  Key,
  Send,
  Sparkles,
  WifiOff,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { Badge, Button, Card, EmptyState } from '../../components/common'
import PageContainer from '../../components/layout/PageContainer'
import ParsedWorkoutPreview from './components/ParsedWorkoutPreview'
import ParsedMealPreview from './components/ParsedMealPreview'
import {
  getAiCredentials,
  isWorkerConfigured,
  parseMealMessage,
  parseWorkoutMessage,
  saveAiMeal,
  saveAiWorkout,
} from './aiLoggerService'
import {
  addUserMessage,
  clearPendingMeal,
  clearPendingWorkout,
  setLoggerMode,
  setParseError,
  setParseMealResult,
  setParseResult,
  setSaveError,
  setSaveSuccess,
  startParsing,
  startSaving,
} from './aiLoggerSlice'
import type { ConfirmedMeal, ConfirmedWorkout } from './types'

export function AiLoggerPage() {
  const dispatch = useAppDispatch()
  const [searchParams] = useSearchParams()
  const {
    mode,
    conversation,
    parsing,
    parseError,
    pendingWorkout,
    pendingMeal,
    saving,
    saveError,
    savedMessage,
  } = useAppSelector((state) => state.aiLogger)

  const [messageText, setMessageText] = useState('')
  const [credentialStatus, setCredentialStatus] = useState<{
    provider: string | null
    hasKey: boolean
  } | null>(null)
  const isConfigured = isWorkerConfigured()
  const [loadingCredentials, setLoadingCredentials] = useState(isConfigured)
  const [workerUnavailable, setWorkerUnavailable] = useState(!isConfigured)
  const conversationEndRef = useRef<HTMLDivElement>(null)

  // Handle URL query ?mode=nutrition or ?mode=workout
  useEffect(() => {
    const urlMode = searchParams.get('mode')
    if (urlMode === 'nutrition' || urlMode === 'food') {
      dispatch(setLoggerMode('nutrition'))
    } else if (urlMode === 'workout') {
      dispatch(setLoggerMode('workout'))
    }
  }, [searchParams, dispatch])

  useEffect(() => {
    if (!isConfigured) return

    let isMounted = true
    const checkCredentials = async () => {
      try {
        const creds = await getAiCredentials()
        if (isMounted) {
          setCredentialStatus(creds)
          setWorkerUnavailable(false)
        }
      } catch {
        if (isMounted) {
          setWorkerUnavailable(true)
          setCredentialStatus(null)
        }
      } finally {
        if (isMounted) {
          setLoadingCredentials(false)
        }
      }
    }

    void checkCredentials()

    return () => {
      isMounted = false
    }
  }, [isConfigured])

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation, parsing, pendingWorkout, pendingMeal])

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = messageText.trim()
    if (!trimmed || parsing || saving) return

    dispatch(addUserMessage(trimmed))
    setMessageText('')
    dispatch(startParsing())

    try {
      if (mode === 'nutrition') {
        const result = await parseMealMessage(trimmed)
        const assistantMessage = result.followUpQuestion
          ? `I parsed your meal, but I have a question: ${result.followUpQuestion}`
          : `I parsed: ${result.mealName} (${result.servingDescription}) — ~${result.calories} kcal (${result.proteinG}g P, ${result.carbsG}g C, ${result.fatG}g F). Review and confirm below.`
        dispatch(setParseMealResult({ result, assistantMessage }))
      } else {
        const result = await parseWorkoutMessage(trimmed)
        const assistantMessage = result.followUpQuestion
          ? `I parsed your workout, but I have a question: ${result.followUpQuestion}`
          : `I parsed: ${result.sets ? `${result.sets} sets of ` : ''}${result.exercise}${result.reps ? ` x ${result.reps} reps` : ''}${result.weight ? ` @ ${result.weight}${result.unit ?? 'kg'}` : ''}. Review and confirm below.`
        dispatch(setParseResult({ result, assistantMessage }))
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : `Failed to parse ${mode === 'nutrition' ? 'meal' : 'workout'} with AI.`
      dispatch(setParseError(message))
    }
  }

  const handleConfirmWorkout = async (confirmed: ConfirmedWorkout) => {
    dispatch(startSaving())
    try {
      await saveAiWorkout(confirmed)
      dispatch(
        setSaveSuccess('Workout saved! View in your workout history.'),
      )
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to save workout session.'
      dispatch(setSaveError(message))
    }
  }

  const handleConfirmMeal = async (confirmed: ConfirmedMeal) => {
    dispatch(startSaving())
    try {
      await saveAiMeal(confirmed)
      dispatch(
        setSaveSuccess('Meal logged! View in your nutrition tracker.'),
      )
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to log meal.'
      dispatch(setSaveError(message))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <PageContainer>
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Bot aria-hidden="true" size={16} />
            </span>
            <p className="text-sm font-medium text-accent">Smart Logger</p>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            AI Workout &amp; Nutrition Logger
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Describe your workouts or meals in natural language. The AI parses
            exercises, sets, weights, meals, and macronutrients directly into your
            logs.
          </p>
        </div>
        <Link to="/settings/ai">
          <Button variant="outline" size="small" icon={Key}>
            AI Settings
          </Button>
        </Link>
      </header>

      {/* Mode Selector Toggle */}
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-line bg-surface p-1.5 sm:w-fit">
        <button
          type="button"
          onClick={() => dispatch(setLoggerMode('workout'))}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
            mode === 'workout'
              ? 'bg-accent text-surface shadow-sm'
              : 'text-muted hover:text-ink hover:bg-hover'
          }`}
        >
          <Dumbbell aria-hidden="true" size={16} />
          <span>Workouts</span>
        </button>
        <button
          type="button"
          onClick={() => dispatch(setLoggerMode('nutrition'))}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
            mode === 'nutrition'
              ? 'bg-accent text-surface shadow-sm'
              : 'text-muted hover:text-ink hover:bg-hover'
          }`}
        >
          <Apple aria-hidden="true" size={16} />
          <span>Food &amp; Nutrition</span>
        </button>
      </div>

      {workerUnavailable && (
        <Card
          title="Cloudflare Worker Not Configured"
          description="The AI service requires the local or deployed Cloudflare Worker."
          actions={<Badge variant="warning">Connection Error</Badge>}
          className="mb-6"
        >
          <div className="flex items-start gap-3">
            <WifiOff
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-amber-400"
            />
            <div className="space-y-2 text-sm text-muted">
              <p className="text-ink">
                Could not connect to the worker backend at{' '}
                <code className="rounded bg-hover px-1.5 py-0.5 text-xs text-ink">
                  {import.meta.env.VITE_WORKER_URL ?? 'http://localhost:8787'}
                </code>
                .
              </p>
              <p>For local development, start the worker in another terminal:</p>
              <pre className="rounded-lg border border-line bg-surface p-3 font-mono text-xs text-accent">
                cd worker &amp;&amp; npm run dev
              </pre>
              <p>
                In production, set{' '}
                <code className="rounded bg-hover px-1 text-xs text-ink">
                  VITE_WORKER_URL
                </code>{' '}
                to your deployed worker endpoint.
              </p>
            </div>
          </div>
        </Card>
      )}

      {!loadingCredentials &&
        !workerUnavailable &&
        credentialStatus &&
        !credentialStatus.hasKey && (
          <Card
            title="Setup Required"
            description="Bring Your Own Key (BYOK) for private, zero-subscription AI logging."
            actions={<Badge variant="warning">No API Key</Badge>}
            className="mb-6"
          >
            <div className="space-y-4 text-sm text-muted">
              <p>
                Set up your Gemini API key in AI Settings to use this feature.
                Google Gemini offers a free tier with no credit card required.
              </p>
              <div>
                <Link to="/settings/ai">
                  <Button variant="primary" icon={Key}>
                    Configure Gemini API Key
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        )}

      {savedMessage && (
        <div
          role="status"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle
              aria-hidden="true"
              className="size-5 shrink-0 text-emerald-400"
            />
            <span>{savedMessage}</span>
          </div>
          <Link
            to={savedMessage.includes('Meal') ? '/nutrition' : '/workouts'}
            className="text-xs font-semibold text-accent hover:underline"
          >
            {savedMessage.includes('Meal')
              ? 'View in nutrition tracker \u2192'
              : 'View in workout history \u2192'}
          </Link>
        </div>
      )}

      {(parseError || saveError) && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
        >
          {parseError || saveError}
        </div>
      )}

      <div className="space-y-6">
        <Card
          title={mode === 'nutrition' ? 'Nutrition Conversation' : 'Workout Conversation'}
          description={
            mode === 'nutrition'
              ? 'Describe breakfast, lunch, snacks, or meal macros.'
              : 'Log sets, ask questions, or describe an entire workout session.'
          }
        >
          {conversation.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No messages yet"
              description={
                mode === 'nutrition'
                  ? "Type something like: 'Bowl of oatmeal with 100g blueberries, a banana, and a scoop of whey protein' or '2 slices of sourdough with 3 eggs and half an avocado for breakfast'."
                  : "Type something like: '3 sets of 10 bench press at 80kg, felt smooth' or 'Did 4 sets of 8 pullups and 3 sets of 12 dips'."
              }
            />
          ) : (
            <div className="space-y-4 py-2">
              {conversation.map((turn) => {
                const isUser = turn.role === 'user'
                return (
                  <div
                    key={turn.id}
                    className={`flex flex-col ${
                      isUser ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="flex max-w-[90%] items-start gap-2.5 sm:max-w-[75%]">
                      {!isUser && (
                        <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                          <Bot aria-hidden="true" size={16} />
                        </span>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                          isUser
                            ? 'bg-accent font-medium text-surface'
                            : 'border border-line bg-panel text-ink'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {turn.content}
                        </p>
                      </div>
                    </div>
                    <span className="mt-1 px-1 text-[10px] text-muted">
                      {new Intl.DateTimeFormat(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(turn.timestamp))}
                    </span>
                  </div>
                )
              })}

              {parsing && (
                <div className="flex items-start gap-2.5">
                  <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <Bot aria-hidden="true" size={16} />
                  </span>
                  <div className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-muted">
                    <span className="inline-flex items-center gap-2">
                      <Sparkles
                        aria-hidden="true"
                        className="size-4 animate-spin text-accent"
                      />
                      {mode === 'nutrition'
                        ? 'Estimating nutrition & meal details…'
                        : 'Parsing workout details…'}
                    </span>
                  </div>
                </div>
              )}

              <div ref={conversationEndRef} />
            </div>
          )}
        </Card>

        {pendingWorkout !== null && (
          <ParsedWorkoutPreview
            key={`${pendingWorkout.exercise}-${pendingWorkout.sets}-${pendingWorkout.reps}-${pendingWorkout.weight}`}
            workout={pendingWorkout}
            onConfirm={handleConfirmWorkout}
            onCancel={() => dispatch(clearPendingWorkout())}
            saving={saving}
          />
        )}

        {pendingMeal !== null && (
          <ParsedMealPreview
            key={`${pendingMeal.mealName}-${pendingMeal.calories}-${pendingMeal.proteinG}`}
            meal={pendingMeal}
            onConfirm={handleConfirmMeal}
            onCancel={() => dispatch(clearPendingMeal())}
            saving={saving}
          />
        )}

        {credentialStatus?.hasKey && !workerUnavailable && (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-3">
              <label
                htmlFor="ai-chat-input"
                className="block text-sm font-medium text-ink"
              >
                {mode === 'nutrition'
                  ? 'Describe what you ate or drank'
                  : 'Describe your workout'}
              </label>
              <textarea
                id="ai-chat-input"
                rows={3}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={2000}
                disabled={parsing || saving}
                placeholder={
                  mode === 'nutrition'
                    ? 'e.g. 200g grilled salmon with 1 cup cooked quinoa and steamed asparagus for dinner'
                    : 'e.g. Incline dumbbell press 4 sets of 8 reps with 30kg each side. Last set was tough.'
                }
                className="w-full resize-y rounded-xl border border-line bg-surface p-3 text-sm text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted">
                  {messageText.length}/2000 characters · Press Enter to send,
                  Shift+Enter for newline
                </span>
                <Button
                  variant="primary"
                  type="submit"
                  loading={parsing}
                  disabled={
                    parsing ||
                    saving ||
                    !messageText.trim() ||
                    messageText.length > 2000
                  }
                  icon={Send}
                >
                  Send to AI
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </PageContainer>
  )
}

export default AiLoggerPage
