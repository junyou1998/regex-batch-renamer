import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { defaultSettings, loadSettings, saveSettings, type Settings, type ThemeMode } from '../services/preferences'

export const useSettingsStore = defineStore('settings', () => {
    const initial = loadSettings()

    const defaultUseRegex = ref(initial.defaultUseRegex)
    const processFilenameOnly = ref(initial.processFilenameOnly)
    const language = ref(initial.language)
    const themeMode = ref<ThemeMode>(initial.themeMode)
    const zoomLevel = ref(initial.zoomLevel)

    function persistSettings() {
        const settings: Settings = {
            defaultUseRegex: defaultUseRegex.value,
            processFilenameOnly: processFilenameOnly.value,
            language: language.value,
            themeMode: themeMode.value,
            zoomLevel: zoomLevel.value
        }
        saveSettings(settings)
    }

    function applyZoom() {
        const factor = zoomLevel.value / 100
        if (window.ipcRenderer?.setZoomFactor) {
            window.ipcRenderer.setZoomFactor(factor)
        }
    }

    watch([defaultUseRegex, processFilenameOnly, language, themeMode, zoomLevel], () => {
        persistSettings()
    }, { deep: true })

    watch(zoomLevel, () => {
        applyZoom()
    })

    function setDefaultUseRegex(value: boolean) {
        defaultUseRegex.value = value
    }

    function setProcessFilenameOnly(value: boolean) {
        processFilenameOnly.value = value
    }

    function setLanguage(value: Settings['language']) {
        language.value = value
    }

    function setThemeMode(value: ThemeMode) {
        themeMode.value = value
    }

    function setZoomLevel(value: number) {
        zoomLevel.value = Math.max(80, Math.min(200, value))
    }

    function resetToDefaults() {
        defaultUseRegex.value = defaultSettings.defaultUseRegex
        processFilenameOnly.value = defaultSettings.processFilenameOnly
        language.value = defaultSettings.language
        themeMode.value = defaultSettings.themeMode
        zoomLevel.value = defaultSettings.zoomLevel
    }

    function initZoom() {
        applyZoom()
    }

    return {
        defaultUseRegex,
        processFilenameOnly,
        language,
        themeMode,
        zoomLevel,
        setDefaultUseRegex,
        setProcessFilenameOnly,
        setLanguage,
        setThemeMode,
        setZoomLevel,
        resetToDefaults,
        initZoom
    }
})
