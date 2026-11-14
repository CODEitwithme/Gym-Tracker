import { useState } from 'react'
import { CheckCircle2, RefreshCw, Sparkles } from 'lucide-react'
import { Badge, Button, Card } from '../../components/common'
import PageContainer from '../../components/layout/PageContainer'
import SettingsNav from '../../components/layout/SettingsNav'
import {
  disconnectGoogleFit,
  getGoogleFitConfig,
  getLastGoogleFitSyncTime,
  isGoogleFitConnected,
  saveGoogleFitConfig,
  syncStepsFromGoogleFit,
} from './googleFitService'

export function IntegrationsPage() {
  const [config, setConfig] = useState(getGoogleFitConfig())
  const [connected, setConnected] = useState(isGoogleFitConnected())
  const [lastSync, setLastSync] = useState(getLastGoogleFitSyncTime())
  const [syncing, setSyncing] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleToggleSimulation = (enable: boolean) => {
    if (enable) {
      saveGoogleFitConfig({ isSimulation: true })
      setStatusMsg('Demo step sync enabled. No Google account is connected.')
    } else {
      disconnectGoogleFit()
      setLastSync(null)
      setStatusMsg('Demo step sync disabled.')
    }

    setConfig(getGoogleFitConfig())
    setConnected(isGoogleFitConnected())
    setErrorMsg(null)
  }

  const handleToggleAutoSync = (autoSync: boolean) => {
    saveGoogleFitConfig({ autoSync })
    setConfig(getGoogleFitConfig())
  }

  const handleSync = async () => {
    setSyncing(true)
    setStatusMsg(null)
    setErrorMsg(null)
    try {
      const result = await syncStepsFromGoogleFit({ days: 7 })
      setConnected(true)
      setLastSync(result.lastSyncAt)
      setStatusMsg(
        `Demo sync saved ${result.syncedDays} new days and preserved existing step logs. Today: ${result.todaySteps.toLocaleString()} steps.`,
      )
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Step synchronization failed.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <PageContainer>
      <div className="lg:mx-auto lg:max-w-4xl xl:max-w-5xl">
        <header className="mb-7 border-b border-line pb-6 lg:mb-8">
          <p className="mb-2 text-sm font-medium text-accent">Settings</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl lg:text-5xl">
            Integrations
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Configure the local step-sync demo. You can also log real step counts manually from
            the Dashboard.
          </p>
        </header>

        <SettingsNav />

        {statusMsg && (
          <p
            role="status"
            className="mb-4 rounded-xl border border-success/30 bg-success-soft p-4 text-sm text-success"
          >
            {statusMsg}
          </p>
        )}
        {errorMsg && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger"
          >
            {errorMsg}
          </div>
        )}

        <section aria-labelledby="google-fit-section">
          <Card
            title="Google Fit steps (demo only)"
            description="Live Google Fit syncing is unavailable because Google retired the Fitness API. This demo generates sample steps and stores them locally; it does not connect to Google or read device activity."
            actions={
              <Badge variant={connected ? 'success' : 'default'}>
                {connected ? 'Demo active' : 'Demo off'}
              </Badge>
            }
          >
            <div className="space-y-5">
              <h2 id="google-fit-section" className="sr-only">
                Google Fit step sync demo
              </h2>

              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-11 items-center justify-center rounded-2xl ${
                      connected ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted/15 text-muted'
                    }`}
                  >
                    {connected ? <CheckCircle2 size={22} /> : <Sparkles size={22} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {connected ? 'Demo simulation active' : 'Demo simulation is off'}
                    </p>
                    <p className="text-xs text-muted">
                      {lastSync
                        ? `Last demo sync: ${new Intl.DateTimeFormat(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(Date.parse(lastSync))}`
                        : 'No demo steps synced yet'}
                    </p>
                  </div>
                </div>

                {connected ? (
                  <Button
                    variant="primary"
                    icon={RefreshCw}
                    loading={syncing}
                    disabled={syncing}
                    onClick={() => void handleSync()}
                  >
                    Sync 7 Demo Days
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    icon={Sparkles}
                    onClick={() => handleToggleSimulation(true)}
                  >
                    Enable Demo
                  </Button>
                )}
              </div>

              <div className="space-y-4 rounded-xl border border-line bg-surface/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink">Demo simulation</p>
                    <p className="text-xs text-muted">
                      Generate sample daily step counts for the last seven days.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <span className="sr-only">Enable demo step simulation</span>
                    <input
                      type="checkbox"
                      checked={config.isSimulation}
                      onChange={(event) => handleToggleSimulation(event.target.checked)}
                      className="sr-only peer"
                    />
                    <span className="h-5 w-9 rounded-full bg-line after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-line after:bg-white after:transition-all peer-checked:bg-accent peer-checked:after:translate-x-full peer-focus-visible:outline-2 peer-focus-visible:outline-accent" />
                  </label>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-line/60 pt-3">
                  <div>
                    <p className="text-sm font-medium text-ink">Auto-sync demo on Dashboard</p>
                    <p className="text-xs text-muted">
                      Run a new sample sync when the Dashboard opens. This never reads device data.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <span className="sr-only">Automatically sync demo steps on Dashboard</span>
                    <input
                      type="checkbox"
                      checked={config.autoSync}
                      disabled={!config.isSimulation}
                      onChange={(event) => handleToggleAutoSync(event.target.checked)}
                      className="sr-only peer"
                    />
                    <span className="h-5 w-9 rounded-full bg-line after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-line after:bg-white after:transition-all peer-checked:bg-accent peer-checked:after:translate-x-full peer-focus-visible:outline-2 peer-focus-visible:outline-accent peer-disabled:cursor-not-allowed peer-disabled:opacity-50" />
                  </label>
                </div>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </PageContainer>
  )
}

export default IntegrationsPage
