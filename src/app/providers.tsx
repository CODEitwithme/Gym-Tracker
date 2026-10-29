import type { PropsWithChildren } from 'react'
import { Provider } from 'react-redux'
import { store } from './store'
import { ThemeProvider } from './theme'

function Providers({ children }: PropsWithChildren) {
  return (
    <Provider store={store}>
      <ThemeProvider>{children}</ThemeProvider>
    </Provider>
  )
}

export default Providers
