export const THEME_STORAGE_KEY = 'dse-theme-preference'
export const THEME_PREFERENCES = ['system', 'light', 'dark']

export function normalizeThemePreference(value) {
  return THEME_PREFERENCES.includes(value) ? value : 'system'
}

export function resolveTheme(preference, systemDark = false) {
  const normalized = normalizeThemePreference(preference)
  return normalized === 'system' ? (systemDark ? 'dark' : 'light') : normalized
}

export function nextThemePreference(preference) {
  const normalized = normalizeThemePreference(preference)
  return THEME_PREFERENCES[(THEME_PREFERENCES.indexOf(normalized) + 1) % THEME_PREFERENCES.length]
}
