import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Scale } from 'lucide-react'
import { Button, Input, Modal } from '../../../components/common'
import { logWeight } from '../../../db/repositories/bodyMetrics'
import { formatLocalDate } from '../../../lib/dateTime'
import { kilogramsToPounds, poundsToKilograms } from '../../../lib/units'
import type { WeightLog } from '../../../types/records'

interface LogWeightModalProps {
  open: boolean
  onClose: () => void
  onSaved?: (log: WeightLog) => void
  initialWeightKg?: number
  initialDate?: string
}

export function LogWeightModal({
  open,
  onClose,
  onSaved,
  initialWeightKg,
  initialDate,
}: LogWeightModalProps) {
  const [date, setDate] = useState(() => initialDate ?? formatLocalDate(new Date()))
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg')
  const [weight, setWeight] = useState(initialWeightKg ? String(initialWeightKg) : '')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDate(initialDate ?? formatLocalDate(new Date()))
      if (initialWeightKg) {
        setWeight(
          unit === 'kg'
            ? String(initialWeightKg)
            : String(Math.round(kilogramsToPounds(initialWeightKg) * 10) / 10),
        )
      }
      setError(null)
    }
  }, [open, initialDate, initialWeightKg, unit])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const parsed = Number(weight)
    if (!weight.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setError('Please enter a valid weight.')
      return
    }

    const weightKg = unit === 'kg' ? parsed : poundsToKilograms(parsed)
    if (weightKg < 25 || weightKg > 400) {
      setError('Weight must be within a realistic human range (25-400 kg).')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const saved = await logWeight({
        localDate: date,
        weightKg,
        unit,
        notes: notes.trim() || undefined,
      })
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save weigh-in.')
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
            <Scale size={18} />
          </span>
          <span>Log Body Weight</span>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="log-weight-form" loading={saving}>
            Save Weigh-In
          </Button>
        </div>
      }
    >
      <form id="log-weight-form" onSubmit={handleSubmit} className="space-y-4">
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

          <div>
            <label className="text-sm font-medium text-ink">Unit</label>
            <div className="mt-1.5 flex rounded-lg border border-line bg-surface p-1">
              <button
                type="button"
                onClick={() => {
                  if (unit === 'lb' && weight) {
                    setWeight(String(Math.round(poundsToKilograms(Number(weight)) * 10) / 10))
                  }
                  setUnit('kg')
                }}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                  unit === 'kg'
                    ? 'bg-panel text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                kg (Kilograms)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (unit === 'kg' && weight) {
                    setWeight(String(Math.round(kilogramsToPounds(Number(weight)) * 10) / 10))
                  }
                  setUnit('lb')
                }}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                  unit === 'lb'
                    ? 'bg-panel text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                lb (Pounds)
              </button>
            </div>
          </div>
        </div>

        <Input
          label={`Weight (${unit})`}
          type="number"
          step="0.1"
          required
          autoFocus
          placeholder={unit === 'kg' ? 'e.g. 74.5' : 'e.g. 164.2'}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />

        <Input
          label="Notes (Optional)"
          placeholder="e.g. Morning fasted weigh-in"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </form>
    </Modal>
  )
}
