import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CheckCircle2,
  Footprints,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
} from 'lucide-react'
import { Badge, Button, Input, Modal } from '../../../components/common'
import { logSteps } from '../../../db/repositories/bodyMetrics'
import { formatLocalDate } from '../../../lib/dateTime'
import type { StepLog } from '../../../types/records'
import {
  getLastGoogleFitSyncTime,
  isGoogleFitConnected,
  saveGoogleFitConfig,
  syncStepsFromGoogleFit,
} from '../../integrations/googleFitService'
import { GoogleFitModal } from '../../integrations/components/GoogleFitModal'

interface LogStepsModalProps {
  open: boolean
  onClose: () => void
  onSaved?: (log?: StepLog) => void
  initialCount?: number
  initialTarget?: number
  initialDate?: string
}

const QUICK_INCREMENTS = [1000, 2500, 5000, 10000]

export function LogStepsModal({
  open,
  onClose,
  onSaved,
  initialCount,
  initialTarget = 10000,
  initialDate,
}: LogStepsModalProps) {
  const isConnected = isGoogleFitConnected()
  const [tab, setTab] = useState<'demo' | 'manual'>(isConnected ? 'demo' : 'manual')
  const [date, setDate] = useState(initialDate ?? formatLocalDate(new Date()))
  const [stepCount, setStepCount] = useState(initialCount ? String(initialCount) : '')
  const [targetSteps, setTargetSteps] = useState(String(initialTarget))
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [googleModalOpen, setGoogleModalOpen] = useState(false)
  const [lastSync, setLastSync] = useState(getLastGoogleFitSyncTime())

  useEffect(() => {
    if (open) {
      const connected = isGoogleFitConnected()
      setTab(connected ? 'demo' : 'manual')
      setDate(initialDate ?? formatLocalDate(new Date()))
      setStepCount(initialCount ? String(initialCount) : '')
      setTargetSteps(String(initialTarget || 10000))
      setError(null)
      setStatusMsg(null)
      setLastSync(getLastGoogleFitSyncTime())
    }
  }, [open, initialDate, initialCount, initialTarget])

  const handleQuickAdd = (amount: number) => {
    const current = Number(stepCount) || 0
    setStepCount(String(current + amount))
  }

  const handleSyncDemo = async (days = 7) => {
    setSyncing(true)
    setError(null)
    setStatusMsg(null)
    try {
      const result = await syncStepsFromGoogleFit({ days })
      setLastSync(result.lastSyncAt)
      setStepCount(String(result.todaySteps))
      setStatusMsg(
        `Demo sync saved ${result.syncedDays} new days and preserved existing logs. Today: ${result.todaySteps.toLocaleString()} steps.`,
      )
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo step sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  const handleEnableDemoSimulation = async () => {
    saveGoogleFitConfig({ isSimulation: true })
    await handleSyncDemo(7)
  }

  const handleSubmitManual = async (e: FormEvent) => {
    e.preventDefault()
    const parsedCount = Number(stepCount)
    const parsedTarget = Number(targetSteps)

    if (!stepCount.trim() || !Number.isInteger(parsedCount) || parsedCount < 0) {
      setError('Please enter a valid step count (0 or greater).')
      return
    }

    if (!targetSteps.trim() || !Number.isInteger(parsedTarget) || parsedTarget <= 0) {
      setError('Target steps must be greater than zero.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const saved = await logSteps({
        localDate: date,
        stepCount: parsedCount,
        targetSteps: parsedTarget,
      })
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save step count.')
    } finally {
      setSaving(false)
    }
  }

  const connectedNow = isGoogleFitConnected()

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
              <Footprints size={18} />
            </span>
            <span>Steps Tracker</span>
          </div>
        }
        footer={
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button variant="ghost" onClick={onClose} disabled={saving || syncing}>
              Close
            </Button>
            {tab === 'manual' && (
              <Button type="submit" form="log-steps-form" loading={saving}>
                Save Manual Steps
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {/* Mode Tab Switcher */}
          <div className="flex rounded-xl bg-surface p-1 border border-line">
            <button
              type="button"
              onClick={() => {
                setTab('demo')
                setError(null)
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                tab === 'demo'
                  ? 'bg-accent text-accent-fg shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Sparkles size={14} />
              <span>Demo Steps</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('manual')
                setError(null)
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                tab === 'manual'
                  ? 'bg-accent text-accent-fg shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Plus size={14} />
              <span>Manual Entry</span>
            </button>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-danger/20 bg-danger-soft p-3 text-xs text-danger"
            >
              {error}
            </p>
          )}

          {statusMsg && (
            <p
              role="status"
              className="rounded-lg border border-success/30 bg-success-soft p-3 text-xs text-success"
            >
              {statusMsg}
            </p>
          )}

          {/* TAB 1: DEMO STEPS */}
          {tab === 'demo' ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex size-9 items-center justify-center rounded-xl ${
                        connectedNow
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : 'bg-muted/15 text-muted'
                      }`}
                    >
                      {connectedNow ? <CheckCircle2 size={18} /> : <Sparkles size={18} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-ink">
                          {connectedNow ? 'Demo Simulation Active' : 'Demo Simulation'}
                        </p>
                        <Badge variant={connectedNow ? 'success' : 'default'}>
                          {connectedNow ? 'Demo active' : 'Demo off'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted">
                        {connectedNow
                          ? lastSync
                            ? `Last demo sync: ${new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : 'Ready to generate sample steps'
                          : 'Creates sample steps only; it does not read device activity'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setGoogleModalOpen(true)}
                    className="rounded-lg border border-line p-2 text-muted hover:bg-hover hover:text-ink transition-colors"
                    title="Configure step sync demo"
                  >
                    <Settings size={15} />
                  </button>
                </div>

                {connectedNow ? (
                  <div className="mt-4 space-y-3">
                    <Button
                      variant="primary"
                      className="w-full justify-center"
                      icon={RefreshCw}
                      loading={syncing}
                      onClick={() => void handleSyncDemo(7)}
                    >
                      Sync Demo Steps
                    </Button>

                    <p className="text-center text-[11px] text-muted">
                      Stores sample steps for today and the last 7 days in your local database.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <Button
                      variant="primary"
                      className="w-full justify-center"
                      icon={Sparkles}
                      onClick={() => void handleEnableDemoSimulation()}
                    >
                      Enable Demo Simulation
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TAB 2: MANUAL ENTRY */
            <form id="log-steps-form" onSubmit={handleSubmitManual} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />

                <Input
                  label="Daily Target Steps"
                  type="number"
                  step="100"
                  min={1000}
                  max={100000}
                  required
                  value={targetSteps}
                  onChange={(e) => setTargetSteps(e.target.value)}
                />
              </div>

              <Input
                label="Total Steps Taken"
                type="number"
                step="1"
                min={0}
                max={200000}
                required
                autoFocus
                placeholder="e.g. 8500"
                value={stepCount}
                onChange={(e) => setStepCount(e.target.value)}
              />

              {/* Quick Add Buttons */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Quick Add Steps
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {QUICK_INCREMENTS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => handleQuickAdd(amount)}
                      className="flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-hover transition-colors"
                    >
                      <Plus size={14} className="text-accent" />
                      <span>+{amount.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Step Sync Demo Configuration Modal */}
      {googleModalOpen && (
        <GoogleFitModal
          open
          onClose={() => {
            setGoogleModalOpen(false)
            setLastSync(getLastGoogleFitSyncTime())
          }}
          onSynced={(steps) => {
            setStepCount(String(steps))
            setLastSync(getLastGoogleFitSyncTime())
            onSaved?.()
          }}
        />
      )}
    </>
  )
}
export default LogStepsModal
