import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'regex-batch-renamer-settings'

interface Settings {
    defaultUseRegex: boolean
    processFilenameOnly: boolean
    language: string
    themeMode: 'auto' | 'light' | 'dark'
}

const defaultSettings: Settings = {
    defaultUseRegex: true,
    processFilenameOnly: true,
    language: 'zh-TW',
    themeMode: 'auto'
}

function loadSettings(): Settings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            return { ...defaultSettings, ...JSON.parse(stored) }
        }
    } catch (e) {
        console.error('Failed to load settings:', e)
    }
    return { ...defaultSettings }
}

export const useSettingsStore = defineStore('settings', () => {
    const initial = loadSettings()

    const defaultUseRegex = ref(initial.defaultUseRegex)
    const processFilenameOnly = ref(initial.processFilenameOnly)
    const language = ref(initial.language)
    const themeMode = ref<'auto' | 'light' | 'dark'>(initial.themeMode)

    function saveSettings() {
        const settings: Settings = {
            defaultUseRegex: defaultUseRegex.value,
            processFilenameOnly: processFilenameOnly.value,
            language: language.value,
            themeMode: themeMode.value
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    }

    // Auto-save on any change
    watch([defaultUseRegex, processFilenameOnly, language, themeMode], () => {
        saveSettings()
    }, { deep: true })

    function setDefaultUseRegex(value: boolean) {
        defaultUseRegex.value = value
    }

    function setProcessFilenameOnly(value: boolean) {
        processFilenameOnly.value = value
    }

    function setLanguage(value: string) {
        language.value = value
    }

    function setThemeMode(value: 'auto' | 'light' | 'dark') {
        themeMode.value = value
    }

    function resetToDefaults() {
        defaultUseRegex.value = defaultSettings.defaultUseRegex
        processFilenameOnly.value = defaultSettings.processFilenameOnly
        language.value = defaultSettings.language
        themeMode.value = defaultSettings.themeMode
    }

    return {
        // State
        defaultUseRegex,
        processFilenameOnly,
        language,
        themeMode,
        // Actions
        setDefaultUseRegex,
        setProcessFilenameOnly,
        setLanguage,
        setThemeMode,
        resetToDefaults
    }
})
