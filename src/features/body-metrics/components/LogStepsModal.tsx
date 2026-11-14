import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Footprints,
  Plus,
  Sparkles,
} from 'lucide-react'
import { Button, Input, Modal } from '../../../components/common'
import { logSteps } from '../../../db/repositories/bodyMetrics'
import { formatLocalDate } from '../../../lib/dateTime'
import type { StepLog } from '../../../types/records'
import { syncStepsFromGoogleFit } from '../../integrations/googleFitService'

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
  const todayStr = useMemo(() => formatLocalDate(new Date()), [])
  const [date, setDate] = useState(() => initialDate ?? formatLocalDate(new Date()))
  const [stepCount, setStepCount] = useState(() => (initialCount ? String(initialCount) : ''))
  const [targetSteps, setTargetSteps] = useState(() => String(initialTarget || 10000))
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (open) {
      setDate(initialDate ?? formatLocalDate(new Date()))
      setStepCount(initialCount ? String(initialCount) : '')
      setTargetSteps(String(initialTarget || 10000))
      setError(null)
      setStatusMsg(null)
    }
  }, [open, initialDate, initialCount, initialTarget])

  const handleQuickAdd = (amount: number) => {
    const current = Number(stepCount) || 0
    setStepCount(String(current + amount))
  }

  const handleGenerateSampleSteps = async () => {
    setSyncing(true)
    setError(null)
    setStatusMsg(null)
    try {
      const result = await syncStepsFromGoogleFit({ days: 7 })
      setStepCount(String(result.todaySteps))
      setStatusMsg(`Generated sample step history for the last 7 days (Today: ${result.todaySteps.toLocaleString()} steps).`)
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sample step generation failed.')
    } finally {
      setSyncing(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
            <Footprints size={18} />
          </span>
          <span>Log Daily Steps</span>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center w-full">
          <button
            type="button"
            onClick={() => void handleGenerateSampleSteps()}
            disabled={saving || syncing}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors"
          >
            <Sparkles size={13} />
            <span>{syncing ? 'Generating…' : 'Generate sample data'}</span>
          </button>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose} disabled={saving || syncing}>
              Cancel
            </Button>
            <Button type="submit" form="log-steps-form" loading={saving} disabled={syncing}>
              Save Steps
            </Button>
          </div>
        </div>
      }
    >
      <form id="log-steps-form" onSubmit={handleSubmit} className="space-y-4">
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

        <Input
          label="Date"
          type="date"
          value={date}
          max={todayStr}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        <div className="space-y-2">
          <Input
            label="Total Steps Taken"
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 8500"
            value={stepCount}
            onChange={(e) => setStepCount(e.target.value)}
            autoFocus
            required
          />

          {/* Quick Increment Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-muted">Quick add:</span>
            {QUICK_INCREMENTS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleQuickAdd(amt)}
                className="flex items-center gap-0.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:bg-hover active:scale-95 transition-all"
              >
                <Plus size={11} />
                <span>{(amt / 1000).toLocaleString()}k</span>
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Daily Step Goal"
          type="number"
          min="1000"
          step="500"
          value={targetSteps}
          onChange={(e) => setTargetSteps(e.target.value)}
          required
        />
      </form>
    </Modal>
  )
}

export default LogStepsModal
