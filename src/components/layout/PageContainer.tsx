import type { PropsWithChildren } from 'react'

type PageContainerProps = PropsWithChildren<{
  className?: string
}>

function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <main
      className={`mx-auto w-full max-w-6xl px-5 py-8 pb-28 sm:px-8 sm:py-10 sm:pb-32 lg:px-10 lg:pb-12 ${className}`}
    >
      {children}
    </main>
  )
}

export default PageContainer
