<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore, type ThemeMode } from '../stores/themeStore'
import { useI18n } from 'vue-i18n'

const themeStore = useThemeStore()
const { t } = useI18n()

// Cycle through themes: auto -> light -> dark -> auto
function cycleTheme() {
    const modes: ThemeMode[] = ['auto', 'light', 'dark']
    const currentIndex = modes.indexOf(themeStore.themeMode)
    const nextIndex = (currentIndex + 1) % modes.length
    themeStore.setTheme(modes[nextIndex])
}

// Get tooltip based on current theme mode
const themeTooltip = computed(() => {
    switch (themeStore.themeMode) {
        case 'auto': return t('theme.auto')
        case 'light': return t('theme.light')
        case 'dark': return t('theme.dark')
    }
})
</script>

<template>
    <button @click="cycleTheme" :title="themeTooltip"
        class="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
        <!-- Auto mode icon -->
        <svg v-if="themeStore.themeMode === 'auto'" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
                d="M9.75 17L9 20l-1 1h8l-1-1 .75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <!-- Light mode icon -->
        <svg v-else-if="themeStore.themeMode === 'light'" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <!-- Dark mode icon -->
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
    </button>
</template>
