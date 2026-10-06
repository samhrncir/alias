import { Cloud, CloudOff } from 'lucide-react'
import type { ThemeId } from '../hooks/useTheme'
import { ThemeSwitcher } from './ThemeSwitcher'

interface Props {
  theme: ThemeId
  onTheme: (theme: ThemeId) => void
  cloudConfigured: boolean
  email: string | null
  onAccount: () => void
}

export function TopBar({ theme, onTheme, cloudConfigured, email, onAccount }: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <h1 className="logo" data-text="ALIAS">
          ALIAS
        </h1>
        <span className="tagline">
          bash alias deck <span className="tagline-dim">// ~/.bashrc</span>
        </span>
      </div>
      <div className="topbar-actions">
        <ThemeSwitcher value={theme} onChange={onTheme} />
        {cloudConfigured && (
          <button type="button" className={`btn btn-sm${email ? '' : ' btn-ghost'}`} onClick={onAccount}>
            {email ? <Cloud size={16} /> : <CloudOff size={16} />}
            <span className="account-label">{email ?? 'Sign in to sync'}</span>
          </button>
        )}
      </div>
    </header>
  )
}
