import { useCallback, useEffect, useState } from 'react'
import { nextThemePreference, normalizeThemePreference, resolveTheme, THEME_STORAGE_KEY } from '../lib/theme'

const query = () => window.matchMedia('(prefers-color-scheme: dark)')

export function useTheme() {
  const [preference, setPreferenceState] = useState(() => normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY)))
  const [systemDark, setSystemDark] = useState(() => query().matches)
  const resolvedTheme = resolveTheme(preference, systemDark)

  const setPreference = useCallback((value) => {
    const next = normalizeThemePreference(value)
    localStorage.setItem(THEME_STORAGE_KEY, next)
    setPreferenceState(next)
  }, [])

  const cyclePreference = useCallback(() => setPreference(nextThemePreference(preference)), [preference, setPreference])

  useEffect(() => {
    const media = query()
    const update = (event) => setSystemDark(event.matches)
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.dataset.themePreference = preference
    document.documentElement.style.colorScheme = resolvedTheme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme === 'dark' ? '#08101c' : '#f3f6fb')
  }, [preference, resolvedTheme])

  return { preference, resolvedTheme, setPreference, cyclePreference }
}
