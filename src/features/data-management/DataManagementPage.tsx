import { useRef, useState } from 'react'
import { Download, FileArchive, FileSpreadsheet, ShieldCheck } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { Badge, Button, Card, Modal } from '../../components/common'
import PageContainer from '../../components/layout/PageContainer'
import { loadActiveWorkoutThunk } from '../workouts/workoutThunks'
import {
  loadDashboardThunk,
} from '../dashboard/dashboardSlice'
import {
  BackupConflictError,
  CURRENT_APP_VERSION,
  createBackup,
  importBackup,
  summarizeBackup,
  type ImportStrategy,
} from './backupService'
import {
  MAX_BACKUP_BYTES,
  parseBackupText,
  serializeBackup,
  type GymTrackerBackup,
} from './backupFormat'
import { createCsvExport, type CsvExportKind } from './csvExport'
import { downloadTextFile } from './download'
import { formatLocalDate } from '../../lib/dateTime'

const csvOptions: Array<{ kind: CsvExportKind; label: string; filename: string }> = [
  {
    kind: 'workout-history',
    label: 'Completed workout history',
    filename: 'workout-history',
  },
  {
    kind: 'workout-sets',
    label: 'Workout exercises and sets',
    filename: 'workout-exercises-and-sets',
  },
  {
    kind: 'nutrition-logs',
    label: 'Nutrition meal logs',
    filename: 'nutrition-meal-logs',
  },
  {
    kind: 'saved-meals',
    label: 'Saved meals',
    filename: 'saved-meals',
  },
]

const tableLabels: Record<string, string> = {
  workoutSessions: 'Workout sessions',
  exercises: 'Exercises',
  workoutExercises: 'Workout-exercise records',
  exerciseSets: 'Exercise sets',
  savedMeals: 'Saved meals',
  mealLogs: 'Meal logs',
}

function dateSuffix(): string {
  return formatLocalDate(new Date())
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation failed.'
}

function DataManagementPage() {
  const dispatch = useAppDispatch()
  const period = useAppSelector((state) => state.dashboard.period)
  const [busy, setBusy] = useState(false)
  const [validating, setValidating] = useState(false)
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(null)
  const [selectedBackup, setSelectedBackup] = useState<GymTrackerBackup | null>(
    null,
  )
  const [strategy, setStrategy] = useState<ImportStrategy>('merge')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [replaceConfirmationOpen, setReplaceConfirmationOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const exportBackup = async () => {
    if (busy) return
    setBusy(true)
    setOperationError(null)
    setStatusMessage(null)
    try {
      const backup = await createBackup()
      const text = serializeBackup(backup)
      const filename = `gym-tracker-backup-${dateSuffix()}.json`
      downloadTextFile(filename, text, 'application/json;charset=utf-8')
      setLastExportedAt(new Date().toISOString())
      setStatusMessage(
        `Backup download started: ${filename}. Check your browser's download location.`,
      )
    } catch (exportError) {
      setOperationError(
        `Backup export failed: ${errorMessage(exportError)} No application data was changed.`,
      )
    } finally {
      setBusy(false)
    }
  }

  const validateFile = async (file: File | undefined) => {
    setSelectedBackup(null)
    setValidationError(null)
    setOperationError(null)
    setStatusMessage(null)
    if (!file) return
    if (file.size > MAX_BACKUP_BYTES) {
      setValidationError(
        `The selected file exceeds the ${Math.floor(MAX_BACKUP_BYTES / (1024 * 1024))} MB limit. No application data was changed.`,
      )
      return
    }
    setBusy(true)
    setValidating(true)
    try {
      const backup = parseBackupText(await file.text())
      setSelectedBackup(backup)
      setStatusMessage(
        'Backup validated successfully. No application data has been changed.',
      )
    } catch (validationFailure) {
      setValidationError(
        `${errorMessage(validationFailure)} No application data was changed.`,
      )
    } finally {
      setValidating(false)
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const restore = async () => {
    if (!selectedBackup || busy) return
    setBusy(true)
    setOperationError(null)
    setValidationError(null)
    setStatusMessage(null)
    try {
      const result = await importBackup(selectedBackup, strategy)
      setReplaceConfirmationOpen(false)
      const totalInserted = Object.values(result.inserted).reduce(
        (sum, count) => sum + count,
        0,
      )
      const totalAlreadyPresent = Object.values(result.alreadyPresent).reduce(
        (sum, count) => sum + count,
        0,
      )
      setStatusMessage(
        result.strategy === 'replace'
          ? `Restore complete. Replaced local records with ${totalInserted} backup records.`
          : `Merge complete. Added ${totalInserted} records; ${totalAlreadyPresent} identical records were already present.`,
      )
      void dispatch(loadDashboardThunk(period))
      void dispatch(loadActiveWorkoutThunk())
    } catch (restoreError) {
      if (restoreError instanceof BackupConflictError) {
        const conflictList = restoreError.conflicts
          .slice(0, 8)
          .map((conflict) => `${tableLabels[conflict.table]}: ${conflict.id}`)
          .join('; ')
        const more =
          restoreError.conflicts.length > 8
            ? `; and ${restoreError.conflicts.length - 8} more`
            : ''
        setOperationError(
          `${restoreError.message} Conflicts: ${conflictList}${more}`,
        )
      } else {
        setOperationError(
          `Restore failed: ${errorMessage(restoreError)} The database state remains unchanged; no partial restore was committed.`,
        )
      }
    } finally {
      setBusy(false)
    }
  }

  const beginRestore = () => {
    if (!selectedBackup || busy) return
    setOperationError(null)
    if (strategy === 'replace') {
      setReplaceConfirmationOpen(true)
    } else {
      void restore()
    }
  }

  const exportCsv = async (kind: CsvExportKind, filename: string) => {
    if (busy) return
    setBusy(true)
    setOperationError(null)
    setStatusMessage(null)
    try {
      const csv = await createCsvExport(kind)
      const fullName = `gym-tracker-${filename}-${dateSuffix()}.csv`
      downloadTextFile(fullName, csv, 'text/csv;charset=utf-8')
      setStatusMessage(
        `CSV download started: ${fullName}. CSV is a report, not a complete backup.`,
      )
    } catch (exportError) {
      setOperationError(
        `CSV export failed: ${errorMessage(exportError)} No application data was changed.`,
      )
    } finally {
      setBusy(false)
    }
  }

  const preview = selectedBackup ? summarizeBackup(selectedBackup) : null
  const appVersionWarning =
    preview && preview.appVersion !== CURRENT_APP_VERSION
      ? `Created by app version ${preview.appVersion}; this app is version ${CURRENT_APP_VERSION}.`
      : null

  return (
    <PageContainer>
      <header className="mb-7">
        <p className="mb-2 text-sm font-medium text-accent">Settings</p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Data management
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Export a portable backup of your local Gym Tracker records, restore a
          validated backup, or download CSV reports. Data stays in this browser
          unless you download or restore a file.
        </p>
      </header>

      {statusMessage && (
        <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {statusMessage}
        </p>
      )}
      {operationError && (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {operationError}
        </div>
      )}

      <div className="space-y-6">
        <section aria-labelledby="full-backup-title">
          <Card
            title="Full JSON backup"
            description="A versioned backup contains all six application tables, including soft-deleted records and historical snapshots."
            actions={<Badge variant="info">Format v1 · schema v1</Badge>}
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <h2 id="full-backup-title" className="sr-only">Full backup export</h2>
                <p className="text-sm leading-6 text-muted">
                  The browser will save a JSON file using its normal download
                  behavior. Choose a secure location and keep a separate copy.
                  Export reads a consistent database snapshot and does not alter
                  your records.
                </p>
                {lastExportedAt && (
                  <p className="mt-2 text-xs text-muted">
                    Last export initiated this session:{' '}
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(Date.parse(lastExportedAt))}
                  </p>
                )}
              </div>
              <Button
                size="large"
                icon={Download}
                loading={busy}
                disabled={busy}
                onClick={() => void exportBackup()}
              >
                Export full backup
              </Button>
            </div>
          </Card>
        </section>

        <section aria-labelledby="restore-backup-title">
          <Card
            title="Restore from backup"
            description="Select a Gym Tracker JSON backup. Validation and preview do not write to the database."
          >
            <h2 id="restore-backup-title" className="sr-only">Restore backup</h2>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="backup-file"
                  className="mb-2 block text-sm font-medium text-ink"
                >
                  Backup file (JSON)
                </label>
                <input
                  ref={fileInputRef}
                  id="backup-file"
                  type="file"
                  accept=".json,application/json"
                  disabled={busy}
                  onChange={(event) => {
                    void validateFile(event.currentTarget.files?.[0])
                  }}
                  className="block min-h-11 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink file:mr-3 file:min-h-8 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:font-medium file:text-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                />
                <p className="mt-2 text-xs text-muted">
                  Maximum file size: 25 MB. Supported backup format: Gym Tracker
                  backup v1 using the current database schema v1.
                </p>
              </div>

              {validating && (
                <p role="status" className="text-sm text-muted">Validating backup…</p>
              )}
              {validationError && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {validationError}
                </p>
              )}

              {preview && selectedBackup && (
                <BackupPreview
                  backup={selectedBackup}
                  appVersionWarning={appVersionWarning}
                />
              )}

              {selectedBackup && (
                <div className="space-y-4 border-t border-line pt-4">
                  <label className="flex max-w-lg flex-col gap-1.5 text-sm font-medium text-ink">
                    Restore strategy
                    <select
                      aria-label="Restore strategy"
                      value={strategy}
                      disabled={busy}
                      onChange={(event) => {
                        const selected = event.currentTarget.value
                        if (selected === 'merge' || selected === 'replace') {
                          setStrategy(selected)
                        }
                      }}
                      className="min-h-11 rounded-lg border border-line bg-panel px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                    >
                      <option value="merge">Merge without overwriting</option>
                      <option value="replace">Replace all local application records</option>
                    </select>
                  </label>
                  <p className="max-w-3xl text-xs leading-5 text-muted">
                    {strategy === 'merge'
                      ? 'Merge inserts records with new IDs, skips exact identical records, and stops without writing if any ID has different content.'
                      : 'Replacement deletes and restores all six application tables in one transaction. Export a backup of current data first. The database schema and indexes remain intact.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      loading={busy}
                      disabled={busy}
                      onClick={beginRestore}
                    >
                      {strategy === 'merge' ? 'Merge backup' : 'Continue to replacement confirmation'}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setSelectedBackup(null)
                        setStatusMessage('Restore canceled. No application data was changed.')
                        setValidationError(null)
                        setOperationError(null)
                      }}
                    >
                      Cancel preview
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>

        <section aria-labelledby="csv-exports-title">
          <Card
            title="CSV reports"
            description="Download spreadsheet-friendly reports of active records. CSV reports are not full backups and cannot restore relationships."
          >
            <h2 id="csv-exports-title" className="sr-only">CSV exports</h2>
            <p className="mb-4 text-xs leading-5 text-muted">
              User-entered text that could be interpreted as a spreadsheet
              formula is prefixed with an apostrophe. Numeric values remain
              numeric and use a locale-independent decimal representation.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {csvOptions.map(({ kind, label, filename }) => (
                <div key={kind} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-line p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileSpreadsheet className="shrink-0 text-accent" aria-hidden="true" size={18} />
                    <p className="text-sm font-medium text-ink">{label}</p>
                  </div>
                  <Button
                    size="small"
                    variant="outline"
                    icon={Download}
                    disabled={busy}
                    loading={busy}
                    onClick={() => void exportCsv(kind, filename)}
                  >
                    Download
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-4 inline-flex items-start gap-2 text-xs leading-5 text-muted">
              <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
              CSV exports omit soft-deleted records; the full JSON backup preserves them.
            </p>
          </Card>
        </section>

        <Card className="bg-surface">
          <div className="flex items-start gap-3">
            <FileArchive aria-hidden="true" className="mt-0.5 shrink-0 text-accent" size={20} />
            <div>
              <h2 className="text-sm font-semibold text-ink">Moving data to another browser or device</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                This app stores records locally in this browser. Export the JSON
                backup here, transfer the file securely, then validate and
                restore it on the other device. Browser downloads may be stored
                in the configured downloads folder.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        open={replaceConfirmationOpen}
        onClose={() => {
          if (!busy) setReplaceConfirmationOpen(false)
        }}
        closeBlocked={busy}
        title="Replace all local application data?"
        footer={
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setReplaceConfirmationOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={busy}
              onClick={() => void restore()}
            >
              Replace and restore
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm leading-6 text-muted">
          <p>
            This permanently replaces the workout sessions, exercises,
            workout-exercise links, sets, saved meals, and meal logs currently
            stored by this app with the validated backup.
          </p>
          <p className="font-semibold text-ink">
            Export a full backup of your current data before continuing.
          </p>
          <p>
            Replacement preserves the database schema and runs as one
            transaction. If a write fails, the transaction is rolled back.
          </p>
        </div>
      </Modal>
    </PageContainer>
  )
}

function BackupPreview({
  backup,
  appVersionWarning,
}: {
  backup: GymTrackerBackup
  appVersionWarning: string | null
}) {
  const preview = summarizeBackup(backup)
  const empty = preview.totalRecords === 0
  return (
    <section
      aria-labelledby="backup-preview-title"
      className="rounded-xl border border-line bg-surface p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="backup-preview-title" className="text-base font-semibold text-ink">
            Backup preview — not yet restored
          </h3>
          <p className="mt-1 text-sm text-muted">
            Exported{' '}
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(Date.parse(preview.exportedAt))}
          </p>
        </div>
        <Badge variant={empty ? 'warning' : 'success'}>
          {preview.totalRecords} records
        </Badge>
      </div>
      <p className="mt-2 text-xs text-muted">
        Backup format v{preview.backupVersion} · database schema v{preview.schemaVersion} · app {preview.appVersion}
      </p>
      {appVersionWarning && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Compatibility note: {appVersionWarning} The current schema is supported.
        </p>
      )}
      {empty && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          This backup contains no records. Restoring it with replacement would
          leave the application tables empty.
        </p>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[400px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">Table</th>
              <th scope="col" className="py-2 pr-3 font-medium">Total</th>
              <th scope="col" className="py-2 pr-3 font-medium">Active</th>
              <th scope="col" className="py-2 font-medium">Soft deleted</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(preview.tableCounts).map(([table, counts]) => (
              <tr key={table} className="border-b border-line last:border-0">
                <th scope="row" className="py-2 pr-3 font-medium text-ink">
                  {tableLabels[table]}
                </th>
                <td className="py-2 pr-3 tabular-nums text-ink">{counts.total}</td>
                <td className="py-2 pr-3 tabular-nums text-ink">{counts.active}</td>
                <td className="py-2 tabular-nums text-ink">{counts.softDeleted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default DataManagementPage
