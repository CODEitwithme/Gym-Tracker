import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, CheckCircle, Key, Send, Sparkles, WifiOff } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { Badge, Button, Card, EmptyState } from '../../components/common'
import PageContainer from '../../components/layout/PageContainer'
import ParsedWorkoutPreview from './components/ParsedWorkoutPreview'
import {
  getAiCredentials,
  isWorkerConfigured,
  parseWorkoutMessage,
  saveAiWorkout,
} from './aiLoggerService'
import {
  addUserMessage,
  clearPendingWorkout,
  setParseError,
  setParseResult,
  setSaveError,
  setSaveSuccess,
  startParsing,
  startSaving,
} from './aiLoggerSlice'
import type { ConfirmedWorkout } from './types'

export function AiLoggerPage() {
  const dispatch = useAppDispatch()
  const {
    conversation,
    parsing,
    parseError,
    pendingWorkout,
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
  }, [conversation, parsing, pendingWorkout])

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = messageText.trim()
    if (!trimmed || parsing || saving) return

    dispatch(addUserMessage(trimmed))
    setMessageText('')
    dispatch(startParsing())

    try {
      const result = await parseWorkoutMessage(trimmed)
      const assistantMessage = result.followUpQuestion
        ? `I parsed your workout, but I have a question: ${result.followUpQuestion}`
        : `I parsed: ${result.sets ? `${result.sets} sets of ` : ''}${result.exercise}${result.reps ? ` x ${result.reps} reps` : ''}${result.weight ? ` @ ${result.weight}${result.unit ?? 'kg'}` : ''}. Review and confirm below.`
      dispatch(setParseResult({ result, assistantMessage }))
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to parse workout with AI.'
      dispatch(setParseError(message))
    }
  }

  const handleConfirm = async (confirmed: ConfirmedWorkout) => {
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

  const handleCancel = () => {
    dispatch(clearPendingWorkout())
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
            AI Workout Logger
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Describe your workout in natural language. The AI parses exercises,
            sets, reps, and weights directly into your training log.
          </p>
        </div>
        <Link to="/settings/ai">
          <Button variant="outline" size="small" icon={Key}>
            AI Settings
          </Button>
        </Link>
      </header>

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
            description="Bring Your Own Key (BYOK) for private, zero-subscription AI workout logging."
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
            to="/workouts"
            className="text-xs font-semibold text-accent hover:underline"
          >
            View in workout history &rarr;
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
          title="Conversation"
          description="Log sets, ask questions, or describe an entire workout session."
        >
          {conversation.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No messages yet"
              description="Type something like: '3 sets of 10 bench press at 80kg, felt smooth' or 'Did 4 sets of 8 pullups and 3 sets of 12 dips'."
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
                      Parsing workout details…
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
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            saving={saving}
          />
        )}

        {credentialStatus?.hasKey && !workerUnavailable && (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-3">
              <label
                htmlFor="workout-chat-input"
                className="block text-sm font-medium text-ink"
              >
                Describe your workout
              </label>
              <textarea
                id="workout-chat-input"
                rows={3}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={2000}
                disabled={parsing || saving}
                placeholder="e.g. Incline dumbbell press 4 sets of 8 reps with 30kg each side. Last set was tough."
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
