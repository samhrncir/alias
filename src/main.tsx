import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/orbitron'
import '@fontsource/rajdhani/500.css'
import '@fontsource/rajdhani/600.css'
import '@fontsource/rajdhani/700.css'
import '@fontsource-variable/jetbrains-mono'
import './styles/themes.css'
import './styles/base.css'
import './styles/components.css'
import './styles/effects.css'
import App from './App'
import { ToastProvider } from './components/Toasts'
import { applyTheme, readStoredTheme } from './hooks/useTheme'

// Before React renders, so the page never flashes the default theme.
applyTheme(readStoredTheme())

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
