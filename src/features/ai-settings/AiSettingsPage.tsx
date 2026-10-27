import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle,
  Edit2,
  Key,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react'
import { Badge, Button, Card, Input, Modal } from '../../components/common'
import PageContainer from '../../components/layout/PageContainer'
import {
  deleteAiCredentials,
  getAiCredentials,
  saveAiCredentials,
  testAiConnection,
} from '../ai-logger/aiLoggerService'
import type { AiProvider } from '../ai-logger/types'

export function AiSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [credentialStatus, setCredentialStatus] = useState<{
    provider: AiProvider | null
    hasKey: boolean
  } | null>(null)

  const [provider, setProvider] = useState<AiProvider>('gemini')
  const [apiKey, setApiKey] = useState('')
  const [isEditingKey, setIsEditingKey] = useState(false)

  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    ok: boolean
    message: string
  } | null>(null)

  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true)
      const creds = await getAiCredentials()
      setCredentialStatus(creds)
      if (!creds.hasKey) {
        setIsEditingKey(true)
      } else {
        setIsEditingKey(false)
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not connect to the worker to fetch AI settings.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const init = async () => {
      try {
        const creds = await getAiCredentials()
        if (isMounted) {
          setCredentialStatus(creds)
          if (!creds.hasKey) {
            setIsEditingKey(true)
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : 'Could not connect to the worker to fetch AI settings.',
          )
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void init()

    return () => {
      isMounted = false
    }
  }, [])

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmedKey = apiKey.trim()
    if (!trimmedKey) {
      setErrorMessage('Please enter a valid Gemini API key.')
      return
    }

    setSaving(true)
    setErrorMessage(null)
    setStatusMessage(null)
    setTestResult(null)

    try {
      await saveAiCredentials(provider, trimmedKey)
      setApiKey('')
      setIsEditingKey(false)
      setStatusMessage(
        'API key saved and encrypted securely on the server.',
      )
      await loadStatus()
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to save API credentials.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    setErrorMessage(null)

    try {
      const res = await testAiConnection()
      setTestResult({
        ok: true,
        message: res.message || 'Connection successful! Gemini API is responding.',
      })
    } catch (err: unknown) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'AI connection test failed. Check your API key.',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setErrorMessage(null)
    setStatusMessage(null)
    setTestResult(null)

    try {
      await deleteAiCredentials()
      setDeleteModalOpen(false)
      setStatusMessage('AI API key was successfully deleted.')
      await loadStatus()
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to delete credentials.',
      )
    } finally {
      setDeleting(false)
    }
  }

  const hasConfiguredKey = credentialStatus?.hasKey === true

  return (
    <PageContainer>
      <header className="mb-7">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Key aria-hidden="true" size={16} />
          </span>
          <p className="text-sm font-medium text-accent">Settings</p>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          AI Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Configure your Bring-Your-Own-Key (BYOK) AI provider. Your API key is
          encrypted using AES-256-GCM and stored only on your private Cloudflare
          Worker. It is never exposed in the browser or logged.
        </p>
      </header>

      {statusMessage && (
        <div
          role="status"
          className="mb-6 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"
        >
          <CheckCircle aria-hidden="true" className="size-5 shrink-0 text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mb-6 flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
        >
          <XCircle aria-hidden="true" className="size-5 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="space-y-6">
        <section aria-labelledby="status-title">
          <Card
            title="Current Status"
            description="Active connection and encryption status for natural language logging."
            actions={
              loading ? (
                <Badge variant="default">Checking…</Badge>
              ) : hasConfiguredKey ? (
                <Badge variant="success">Gemini configured</Badge>
              ) : (
                <Badge variant="warning">No API key configured</Badge>
              )
            }
          >
            <h2 id="status-title" className="sr-only">
              Current AI Status
            </h2>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="space-y-1 text-sm text-muted">
                {hasConfiguredKey ? (
                  <>
                    <p className="font-medium text-ink">
                      Active Provider: Google Gemini
                    </p>
                    <p className="text-xs">
                      API key is securely encrypted with AES-256-GCM on the
                      server and associated with your device token.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-ink">No key configured</p>
                    <p className="text-xs">
                      Provide a free Google AI Studio API key below to enable the
                      natural language workout parser.
                    </p>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {hasConfiguredKey && (
                  <>
                    <Button
                      variant="outline"
                      icon={Wifi}
                      loading={testing}
                      disabled={testing || saving || deleting}
                      onClick={() => void handleTest()}
                    >
                      Test Connection
                    </Button>
                    <Button
                      variant="secondary"
                      icon={Edit2}
                      disabled={saving || deleting}
                      onClick={() => setIsEditingKey((prev) => !prev)}
                    >
                      {isEditingKey ? 'Close Editor' : 'Update Key'}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {testResult && (
              <div
                role={testResult.ok ? 'status' : 'alert'}
                className={`mt-4 flex items-start gap-2.5 rounded-xl border p-3.5 text-xs leading-5 ${
                  testResult.ok
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-red-500/30 bg-red-500/10 text-red-200'
                }`}
              >
                {testResult.ok ? (
                  <Wifi
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-emerald-400"
                  />
                ) : (
                  <WifiOff
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-red-400"
                  />
                )}
                <div>
                  <span className="font-semibold">
                    {testResult.ok ? 'Connection Test Passed: ' : 'Connection Failed: '}
                  </span>
                  {testResult.message}
                </div>
              </div>
            )}
          </Card>
        </section>

        {(!hasConfiguredKey || isEditingKey) && (
          <section aria-labelledby="setup-title">
            <Card
              title={hasConfiguredKey ? 'Update API Key' : 'Configure Gemini API Key'}
              description="Enter your Google Gemini API key to activate AI-powered workout logging."
              actions={<Badge variant="info">Free tier eligible</Badge>}
            >
              <h2 id="setup-title" className="sr-only">
                Configure Credentials
              </h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label
                    htmlFor="ai-provider-select"
                    className="mb-1.5 block text-sm font-medium text-ink"
                  >
                    AI Provider
                  </label>
                  <select
                    id="ai-provider-select"
                    value={provider}
                    disabled={saving}
                    onChange={(e) => setProvider(e.target.value as AiProvider)}
                    className="min-h-10 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                  >
                    <option value="gemini">Google Gemini (Recommended)</option>
                  </select>
                </div>

                <Input
                  id="gemini-api-key-input"
                  type="password"
                  label="Gemini API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  required
                  disabled={saving}
                  helperText="Get a key for free from Google AI Studio. Starts with 'AI'."
                />

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={saving}
                    disabled={saving || !apiKey.trim()}
                    icon={Key}
                  >
                    Save API Key
                  </Button>
                  {hasConfiguredKey && (
                    <Button
                      variant="ghost"
                      disabled={saving}
                      onClick={() => {
                        setIsEditingKey(false)
                        setApiKey('')
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </Card>
          </section>
        )}

        <section aria-labelledby="instructions-title">
          <Card
            title="Setup Instructions"
            description="How to obtain and configure your free Gemini API key."
          >
            <h2 id="instructions-title" className="sr-only">
              Setup Instructions
            </h2>
            <div className="space-y-4 text-sm leading-6 text-muted">
              <div>
                <h3 className="font-semibold text-ink">
                  How to get a Gemini API key:
                </h3>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>
                    Go to{' '}
                    <a
                      href="https://aistudio.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline underline-offset-4 hover:text-accent/80"
                    >
                      Google AI Studio (aistudio.google.com)
                    </a>
                    .
                  </li>
                  <li>Sign in with your standard Google account.</li>
                  <li>Click &quot;Get API key&quot; in the navigation.</li>
                  <li>Click &quot;Create API key&quot; (free tier, no credit card required).</li>
                  <li>Copy the key and paste it into the field above.</li>
                </ol>
              </div>

              <div className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-start gap-3">
                  <Sparkles
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-accent"
                  />
                  <div>
                    <h4 className="font-semibold text-ink">
                      Where does your data go?
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      Your key is encrypted on write with AES-256-GCM using your
                      worker&apos;s master key. It is never logged, never stored
                      in browser storage, and never transferred to third parties.
                      Workout messages are dispatched directly to the Google
                      Gemini API via your worker.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {hasConfiguredKey && (
          <section aria-labelledby="danger-zone-title">
            <Card
              title="Danger Zone"
              description="Remove your stored credentials from the worker."
              className="border-red-950/40"
            >
              <h2 id="danger-zone-title" className="sr-only">
                Danger Zone
              </h2>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="text-sm text-muted">
                  <p className="font-semibold text-ink">Delete Stored API Key</p>
                  <p className="text-xs">
                    This permanently deletes the encrypted key from the worker.
                    You will need to enter a key again to parse workouts.
                  </p>
                </div>
                <Button
                  variant="danger"
                  icon={Trash2}
                  disabled={saving || deleting}
                  onClick={() => setDeleteModalOpen(true)}
                >
                  Delete API Key
                </Button>
              </div>
            </Card>
          </section>
        )}
      </div>

      <Modal
        open={deleteModalOpen}
        onClose={() => {
          if (!deleting) setDeleteModalOpen(false)
        }}
        closeBlocked={deleting}
        title="Delete API key?"
        footer={
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button
              variant="ghost"
              disabled={deleting}
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              Delete Credential
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm leading-6 text-muted">
          <p>
            Are you sure you want to delete your stored Gemini API key?
          </p>
          <p className="font-semibold text-ink">
            AI workout parsing will be disabled until a new key is provided.
          </p>
          <p>
            Your existing workouts, exercises, and logs will remain completely intact.
          </p>
        </div>
      </Modal>
    </PageContainer>
  )
}

export default AiSettingsPage
