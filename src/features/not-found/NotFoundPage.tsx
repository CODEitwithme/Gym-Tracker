import { Link } from 'react-router-dom'
import PageContainer from '../../components/layout/PageContainer'

function NotFoundPage() {
  return (
    <PageContainer>
      <section className="rounded-2xl border border-line bg-panel px-6 py-12 text-center sm:px-10 sm:py-16">
        <p className="text-sm font-semibold text-accent">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          The page you’re looking for doesn’t exist.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Back to dashboard
        </Link>
      </section>
    </PageContainer>
  )
}

export default NotFoundPage
