// Theme utilities — light/dark mode via CSS custom properties

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'muteform-theme'

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark') return 'dark'
  } catch {}
  return 'light'
}

export function setTheme(theme: Theme): void {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  root.classList.remove('theme-light', 'theme-dark')
  root.classList.add(`theme-${theme}`)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {}
}

export function toggleTheme(): Theme {
  const current = getTheme()
  const next: Theme = current === 'light' ? 'dark' : 'light'
  setTheme(next)
  return next
}
