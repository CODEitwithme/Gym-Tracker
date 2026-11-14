import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Footprints, Plus } from 'lucide-react'
import { Button, Input, Modal } from '../../../components/common'
import { logSteps } from '../../../db/repositories/bodyMetrics'
import { formatLocalDate } from '../../../lib/dateTime'
import type { StepLog } from '../../../types/records'

interface LogStepsModalProps {
  open: boolean
  onClose: () => void
  onSaved?: (log: StepLog) => void
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
  const [date, setDate] = useState(initialDate ?? formatLocalDate(new Date()))
  const [stepCount, setStepCount] = useState(initialCount ? String(initialCount) : '')
  const [targetSteps, setTargetSteps] = useState(String(initialTarget))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDate(initialDate ?? formatLocalDate(new Date()))
      setStepCount(initialCount ? String(initialCount) : '')
      setTargetSteps(String(initialTarget || 10000))
      setError(null)
    }
  }, [open, initialDate, initialCount, initialTarget])

  const handleQuickAdd = (amount: number) => {
    const current = Number(stepCount) || 0
    setStepCount(String(current + amount))
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
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Footprints size={18} />
          </span>
          <span>Log Daily Steps</span>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="log-steps-form" loading={saving}>
            Save Steps
          </Button>
        </div>
      }
    >
      <form id="log-steps-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg border border-danger/20 bg-danger-soft p-3 text-xs text-danger">
            {error}
          </p>
        )}

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
    </Modal>
  )
}
