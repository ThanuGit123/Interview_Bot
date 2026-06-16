const KEY = 'caliber-theme'

export function getTheme() {
  return localStorage.getItem(KEY) || 'dark'
}

export function applyTheme(theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  localStorage.setItem(KEY, theme)
}

export function initTheme() {
  applyTheme(getTheme())
}
