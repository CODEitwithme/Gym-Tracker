import type { PropsWithChildren } from 'react'

type PageContainerProps = PropsWithChildren<{
  className?: string
}>

function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <main
      className={`w-full px-4 py-6 pb-28 sm:px-6 sm:py-8 sm:pb-32 lg:px-10 lg:pb-12 2xl:px-16 ${className}`}
    >
      {children}
    </main>
  )
}

export default PageContainer
