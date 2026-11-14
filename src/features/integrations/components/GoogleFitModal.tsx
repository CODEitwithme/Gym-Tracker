import { useState } from 'react'
import { AlertCircle, RefreshCw, Sparkles } from 'lucide-react'
import { Button, Modal } from '../../../components/common'
import {
  disconnectGoogleFit,
  getGoogleFitConfig,
  getLastGoogleFitSyncTime,
  saveGoogleFitConfig,
  syncStepsFromGoogleFit,
} from '../googleFitService'

interface GoogleFitModalProps {
  open: boolean
  onClose: () => void
  onSynced?: (todaySteps: number) => void
}

export function GoogleFitModal({ open, onClose, onSynced }: GoogleFitModalProps) {
  const [config, setConfig] = useState(getGoogleFitConfig())
  const [lastSync, setLastSync] = useState(getLastGoogleFitSyncTime())
  const [syncing, setSyncing] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleToggleSimulation = () => {
    saveGoogleFitConfig({ isSimulation: true })
    setConfig(getGoogleFitConfig())
    setStatusMsg('Demo step simulation enabled. No Google account is connected.')
    setErrorMsg(null)
  }

  const handleDisableSimulation = () => {
    disconnectGoogleFit()
    setConfig(getGoogleFitConfig())
    setLastSync(null)
    setStatusMsg('Demo step simulation disabled.')
    setErrorMsg(null)
  }

  const handleSync = async () => {
    setSyncing(true)
    setStatusMsg(null)
    setErrorMsg(null)
    try {
      const result = await syncStepsFromGoogleFit({ days: 7 })
      setLastSync(result.lastSyncAt)
      setStatusMsg(
        `Demo sync saved ${result.syncedDays} new days and preserved existing step logs. Today: ${result.todaySteps.toLocaleString()} steps.`,
      )
      onSynced?.(result.todaySteps)
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Step synchronization failed.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
            <Sparkles size={18} />
          </span>
          <span>Step Sync Demo</span>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose} disabled={syncing}>
            Close
          </Button>
          {config.isSimulation ? (
            <Button
              variant="primary"
              loading={syncing}
              icon={RefreshCw}
              onClick={() => void handleSync()}
            >
              Sync Demo Steps
            </Button>
          ) : (
            <Button variant="primary" icon={Sparkles} onClick={handleToggleSimulation}>
              Enable Demo
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-ink">Live Google Fit sync is unavailable</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Google retired the Fitness API used for web-based syncing. This demo creates sample
            steps only; it does not connect to Google or read your phone or watch. You can still
            enter actual steps manually from the Dashboard.
          </p>
        </div>

        {statusMsg && (
          <p
            role="status"
            className="rounded-lg border border-success/30 bg-success-soft p-3 text-xs text-success"
          >
            {statusMsg}
          </p>
        )}
        {errorMsg && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs text-danger"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4">
          <div>
            <p className="text-sm font-medium text-ink">Demo simulation</p>
            <p className="text-xs text-muted">
              {config.isSimulation
                ? `Active${lastSync ? ` · Last demo sync ${new Date(lastSync).toLocaleString()}` : ''}`
                : 'Off'}
            </p>
          </div>
          {config.isSimulation ? (
            <Button variant="ghost" onClick={handleDisableSimulation} disabled={syncing}>
              Turn off
            </Button>
          ) : (
            <Button variant="outline" onClick={handleToggleSimulation}>
              Enable
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default GoogleFitModal
