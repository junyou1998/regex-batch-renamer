import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useSettingsStore } from './settingsStore'

export type ThemeMode = 'auto' | 'light' | 'dark'

export const useThemeStore = defineStore('theme', () => {
  const settingsStore = useSettingsStore()
  const themeMode = computed<ThemeMode>(() => settingsStore.themeMode)


  const systemTheme = ref<'light' | 'dark'>('dark')


  const effectiveTheme = computed(() => {
    if (themeMode.value === 'auto') {
      return systemTheme.value
    }
    return themeMode.value
  })


  function updateSystemTheme() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    systemTheme.value = isDark ? 'dark' : 'light'
  }


  function setTheme(mode: ThemeMode) {
    settingsStore.setThemeMode(mode)
  }


  updateSystemTheme()


  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', updateSystemTheme)


  watch(effectiveTheme, (theme) => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, { immediate: true })

  return {
    themeMode,
    effectiveTheme,
    setTheme
  }
})
