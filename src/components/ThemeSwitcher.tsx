import { THEMES, type ThemeId } from '../hooks/useTheme'

interface Props {
  value: ThemeId
  onChange: (theme: ThemeId) => void
}

/** Each swatch carries its own data-theme, so it paints itself from that theme's tokens. */
export function ThemeSwitcher({ value, onChange }: Props) {
  return (
    <div className="theme-switcher" role="group" aria-label="Theme">
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          type="button"
          className="swatch"
          data-theme={theme.id}
          aria-pressed={value === theme.id}
          title={`${theme.name} (press T to cycle)`}
          onClick={() => onChange(theme.id)}
        >
          <span className="sr-only">{theme.name}</span>
        </button>
      ))}
    </div>
  )
}
