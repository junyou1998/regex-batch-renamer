<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

const availableLocales = [
    { code: 'zh-TW', name: '繁體中文' },
    { code: 'zh-CN', name: '简体中文' },
    { code: 'en-US', name: 'English' }
]

function switchLanguage(code: string) {
    locale.value = code
    localStorage.setItem('locale', code)
}
</script>

<template>
    <div class="relative group">
        <button
            class="flex items-center gap-1 px-2 py-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                    d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            <!-- <span class="hidden sm:inline">{{ currentLocaleName }}</span> -->
        </button>

        <!-- Dropdown -->
        <div
            class="absolute right-0 top-full mt-1 w-32 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            <button v-for="lang in availableLocales" :key="lang.code" @click="switchLanguage(lang.code)"
                :class="['w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors', locale === lang.code ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300']">
                {{ lang.name }}
            </button>
        </div>
    </div>
</template>
