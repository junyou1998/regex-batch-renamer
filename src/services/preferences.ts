export type Locale = 'zh-TW' | 'zh-CN' | 'en-US' | 'ja-JP'
export type ThemeMode = 'auto' | 'light' | 'dark'

export interface Settings {
  defaultUseRegex: boolean
  processFilenameOnly: boolean
  language: Locale
  themeMode: ThemeMode
  zoomLevel: number
}

const STORAGE_KEY = 'regex-batch-renamer-settings'
const LEGACY_LOCALE_KEY = 'locale'
const LEGACY_THEME_KEY = 'theme-mode'

export const defaultSettings: Settings = {
  defaultUseRegex: true,
  processFilenameOnly: true,
  language: 'zh-TW',
  themeMode: 'auto',
  zoomLevel: 100,
}

function isLocale(value: string): value is Locale {
  return value === 'zh-TW' || value === 'zh-CN' || value === 'en-US' || value === 'ja-JP'
}

function isThemeMode(value: string): value is ThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark'
}

function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null

  if (isLocale(value)) return value

  const lower = value.toLowerCase()
  if (['zh-tw', 'zh-hk', 'zh-mo', 'zh-hant'].includes(lower) || lower.startsWith('zh-hant')) {
    return 'zh-TW'
  }
  if (lower.startsWith('zh')) return 'zh-CN'
  if (lower.startsWith('ja')) return 'ja-JP'
  if (lower.startsWith('en')) return 'en-US'

  return null
}

function detectSystemLocale(): Locale {
  return normalizeLocale(typeof navigator !== 'undefined' ? navigator.language : '') ?? defaultSettings.language
}

export function loadSettings(): Settings {
  if (typeof localStorage === 'undefined') {
    return { ...defaultSettings, language: detectSystemLocale() }
  }

  let stored: Partial<Settings> | null = null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) stored = JSON.parse(raw)
  } catch (e) {
    console.error('Failed to load settings:', e)
  }

  const legacyLocale = normalizeLocale(localStorage.getItem(LEGACY_LOCALE_KEY))
  const legacyTheme = localStorage.getItem(LEGACY_THEME_KEY)

  const base: Settings = {
    ...defaultSettings,
    ...(stored ?? {}),
  }

  if (!stored?.language) {
    base.language = legacyLocale ?? detectSystemLocale()
  } else if (!isLocale(base.language)) {
    const normalized = normalizeLocale(String(base.language))
    base.language = normalized ?? legacyLocale ?? detectSystemLocale()
  }

  if (!stored?.themeMode) {
    if (legacyTheme && isThemeMode(legacyTheme)) {
      base.themeMode = legacyTheme
    }
  } else if (!isThemeMode(base.themeMode)) {
    base.themeMode = defaultSettings.themeMode
  }

  return base
}

export function saveSettings(settings: Settings): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function getInitialLocale(): Locale {
  return loadSettings().language
}
