import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export type ThemeMode = 'auto' | 'light' | 'dark'

export const useThemeStore = defineStore('theme', () => {
  const savedTheme = localStorage.getItem('theme-mode') as ThemeMode | null
  const themeMode = ref<ThemeMode>(savedTheme || 'auto')


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
    themeMode.value = mode
    localStorage.setItem('theme-mode', mode)
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
