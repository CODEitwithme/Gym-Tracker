import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children?: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

const CHUNK_RELOAD_KEY = 'forge_fit_chunk_reload_ts'

function isChunkLoadError(error: Error | null): boolean {
  if (!error?.message) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('loading chunk') ||
    msg.includes('error loading dynamically imported module')
  )
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo)

    // Auto-recovery for Vercel dynamic chunk invalidations
    if (isChunkLoadError(error)) {
      const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0')
      const now = Date.now()
      if (now - lastReload > 15000) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now))
        window.location.reload()
      }
    }
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-[var(--theme-background)] text-ink flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl text-center space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight text-ink">
                Something went wrong
              </h1>
              <p className="text-sm text-muted">
                Your workout and nutrition data in IndexedDB is safe. A temporary issue occurred while rendering this page.
              </p>
            </div>

            {this.state.error?.message && (
              <details className="rounded-lg bg-surface p-3 text-left text-xs text-muted font-mono cursor-pointer">
                <summary className="font-semibold text-ink select-none cursor-pointer">
                  Technical Details
                </summary>
                <p className="mt-2 break-words text-danger">{this.state.error.message}</p>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition hover:opacity-90 active:scale-95"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-elevated active:scale-95"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
