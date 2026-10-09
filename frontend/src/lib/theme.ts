/** Mode sombre optionnel, mémorisé sur l'appareil. */
const KEY = 'gym.theme'

export function applyStoredTheme(): void {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(KEY)
  } catch {
    stored = null
  }
  const dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', dark)
}

export function toggleTheme(): boolean {
  const dark = !document.documentElement.classList.contains('dark')
  document.documentElement.classList.toggle('dark', dark)
  try {
    localStorage.setItem(KEY, dark ? 'dark' : 'light')
  } catch {
    // stockage indisponible (navigation privée) : le choix vaut pour la session
  }
  return dark
}
