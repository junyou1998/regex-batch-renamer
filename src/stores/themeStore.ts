import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export type ThemeMode = 'auto' | 'light' | 'dark'

export const useThemeStore = defineStore('theme', () => {
  // Load saved preference from localStorage, default to 'auto'
  const savedTheme = localStorage.getItem('theme-mode') as ThemeMode | null
  const themeMode = ref<ThemeMode>(savedTheme || 'auto')
  
  // System theme preference
  const systemTheme = ref<'light' | 'dark'>('dark')
  
  // Computed effective theme
  const effectiveTheme = computed(() => {
    if (themeMode.value === 'auto') {
      return systemTheme.value
    }
    return themeMode.value
  })
  
  // Update system theme based on media query
  function updateSystemTheme() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    systemTheme.value = isDark ? 'dark' : 'light'
  }
  
  // Set theme mode
  function setTheme(mode: ThemeMode) {
    themeMode.value = mode
    localStorage.setItem('theme-mode', mode)
  }
  
  // Initialize system theme detection
  updateSystemTheme()
  
  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', updateSystemTheme)
  
  // Apply theme to document
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
