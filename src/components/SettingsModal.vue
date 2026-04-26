<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n } from 'vue-i18n'
import type { Locale } from '../services/preferences'
import { Check, ChevronDown, Minus, Plus, Settings, X } from 'lucide-vue-next'

const props = defineProps<{
    modelValue: boolean
}>()

const emit = defineEmits<{
    'update:modelValue': [value: boolean]
}>()

const settingsStore = useSettingsStore()
const { locale } = useI18n()

const isOpen = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const availableLocales = [
    { code: 'zh-TW', name: '繁體中文' },
    { code: 'zh-CN', name: '简体中文' },
    { code: 'en-US', name: 'English' },
    { code: 'ja-JP', name: '日本語' }
] as const satisfies readonly { code: Locale; name: string }[]

const showLanguageMenu = ref(false)

const selectedLanguage = computed(() => {
    return availableLocales.find(lang => lang.code === settingsStore.language) ?? availableLocales[0]
})

const themeOptions = [
    { value: 'auto', labelKey: 'theme.auto' },
    { value: 'light', labelKey: 'theme.light' },
    { value: 'dark', labelKey: 'theme.dark' }
] as const


watch(() => settingsStore.language, (newLang) => {
    locale.value = newLang
}, { immediate: true })

function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
        if (showLanguageMenu.value) {
            showLanguageMenu.value = false
            return
        }
        isOpen.value = false
    }
}

function toggleLanguageMenu() {
    showLanguageMenu.value = !showLanguageMenu.value
}

function selectLanguage(value: Locale) {
    settingsStore.setLanguage(value)
    showLanguageMenu.value = false
}

function handleDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement
    if (!target.closest('.language-select')) {
        showLanguageMenu.value = false
    }
}

watch(showLanguageMenu, (open) => {
    if (open) {
        document.addEventListener('click', handleDocumentClick)
    } else {
        document.removeEventListener('click', handleDocumentClick)
    }
})

watch(isOpen, (open) => {
    if (!open) {
        showLanguageMenu.value = false
    }
})

onBeforeUnmount(() => {
    document.removeEventListener('click', handleDocumentClick)
})

function adjustZoom(delta: number) {
    const newValue = settingsStore.zoomLevel + delta
    settingsStore.setZoomLevel(newValue)
}

function handleThemeChange(event: MouseEvent, value: 'auto' | 'light' | 'dark') {

    const isAppearanceTransition = 'startViewTransition' in document
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!isAppearanceTransition) {
        settingsStore.setThemeMode(value)
        return
    }

    const x = event.clientX
    const y = event.clientY
    const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
    )

    const html = document.documentElement
    const isDark = html.classList.contains('dark')
    html.setAttribute('data-vt-from', isDark ? 'dark' : 'light')

    const transition = document.startViewTransition(async () => {
        settingsStore.setThemeMode(value)
        await nextTick()
    })

    transition.ready.then(() => {
        const createWavyPolygon = (radius: number, waveCount: number = 8, waveAmp: number = 0.08) => {
            const points = []
            const steps = 100
            for (let i = 0; i < steps; i++) {
                const angle = (i / steps) * 2 * Math.PI
                const r = radius * (1 + waveAmp * Math.sin(angle * waveCount))
                const px = x + r * Math.cos(angle)
                const py = y + r * Math.sin(angle)
                points.push(`${px.toFixed(1)}px ${py.toFixed(1)}px`)
            }
            return `polygon(${points.join(', ')})`
        }

        const clipPathStart = createWavyPolygon(0)
        const clipPathEnd = createWavyPolygon(endRadius * 1.5)
        const expand = [clipPathStart, clipPathEnd]
        const collapse = [clipPathEnd, clipPathStart]

        if (isDark) {
            document.documentElement.animate(
                { clipPath: collapse },
                { duration: 600, easing: 'ease-in-out', pseudoElement: '::view-transition-old(root)' }
            )
        } else {
            document.documentElement.animate(
                { clipPath: expand },
                { duration: 600, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' }
            )
        }

        transition.finished.finally(() => {
            html.removeAttribute('data-vt-from')
        })
    })
}
</script>

<template>
    <Teleport to="body">
        <Transition name="fade">
            <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4" @keydown="handleKeydown">
                <!-- Backdrop -->
                <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="isOpen = false"></div>

                <!-- Modal -->
                <div
                    class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden">
                    <!-- Header -->
                    <div
                        class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                        <h2 class="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                            <Settings class="w-5 h-5 text-slate-500" />
                            {{ $t('settings.title') }}
                        </h2>
                        <button @click="isOpen = false"
                            class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                            <X class="h-5 w-5" />
                        </button>
                    </div>

                    <!-- Content -->
                    <div class="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        <!-- Default Settings Section -->
                        <div class="space-y-4">
                            <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                {{ $t('settings.defaults') }}
                            </h3>

                            <label class="flex items-start gap-3 cursor-pointer group">
                                <input type="checkbox" v-model="settingsStore.defaultUseRegex"
                                    class="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                                <div>
                                    <span
                                        class="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {{ $t('settings.defaultUseRegex') }}
                                    </span>
                                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {{ $t('settings.defaultUseRegexDesc') }}
                                    </p>
                                </div>
                            </label>

                            <label class="flex items-start gap-3 cursor-pointer group">
                                <input type="checkbox" v-model="settingsStore.processFilenameOnly"
                                    class="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                                <div>
                                    <span
                                        class="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {{ $t('settings.processFilenameOnly') }}
                                    </span>
                                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {{ $t('settings.processFilenameOnlyDesc') }}
                                    </p>
                                </div>
                            </label>
                        </div>

                        <hr class="border-slate-200 dark:border-slate-700">

                        <!-- Appearance Section -->
                        <div class="space-y-4">
                            <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                {{ $t('settings.appearance') }}
                            </h3>

                            <!-- Language -->
                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-slate-700 dark:text-slate-200">
                                    {{ $t('settings.language') }}
                                </label>
                                <div class="language-select relative" @click.stop>
                                    <button type="button" @click="toggleLanguageMenu"
                                        class="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm border rounded-lg transition-all cursor-pointer bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50">
                                        <span class="truncate">{{ selectedLanguage.name }}</span>
                                        <ChevronDown
                                            :class="['w-4 h-4 text-slate-400 transition-transform', showLanguageMenu ? 'rotate-180' : '']" />
                                    </button>

                                    <Transition name="dropdown">
                                        <div v-if="showLanguageMenu"
                                            class="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
                                            <button v-for="lang in availableLocales" :key="lang.code" type="button"
                                                @click="selectLanguage(lang.code)" :class="[
                                                    'w-full flex items-center justify-between px-3 py-2.5 text-left text-sm transition-colors cursor-pointer',
                                                    settingsStore.language === lang.code
                                                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                                                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                                                ]">
                                                <span>{{ lang.name }}</span>
                                                <Check v-if="settingsStore.language === lang.code" class="w-4 h-4" />
                                            </button>
                                        </div>
                                    </Transition>
                                </div>
                            </div>

                            <!-- Theme -->
                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-slate-700 dark:text-slate-200">
                                    {{ $t('settings.theme') }}
                                </label>
                                <div class="flex gap-2">
                                    <button v-for="option in themeOptions" :key="option.value"
                                        @click="handleThemeChange($event, option.value)" :class="[
                                            'flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-all cursor-pointer',
                                            settingsStore.themeMode === option.value
                                                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                                                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500'
                                        ]">
                                        {{ $t(option.labelKey) }}
                                    </button>
                                </div>
                            </div>

                            <!-- Zoom Level -->
                            <div class="space-y-2">
                                <label class="block text-sm font-medium text-slate-700 dark:text-slate-200">
                                    {{ $t('settings.zoomLevel') }}
                                </label>
                                <div class="flex items-center gap-3">
                                    <button @click="adjustZoom(-10)" :disabled="settingsStore.zoomLevel <= 80"
                                        class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors">
                                        <Minus class="w-4 h-4" />
                                    </button>
                                    <input type="range" v-model.number="settingsStore.zoomLevel" min="80" max="200"
                                        step="10"
                                        class="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500">
                                    <button @click="adjustZoom(10)" :disabled="settingsStore.zoomLevel >= 200"
                                        class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors">
                                        <Plus class="w-4 h-4" />
                                    </button>
                                    <span
                                        class="w-14 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {{ settingsStore.zoomLevel }}%
                                    </span>
                                </div>
                                <p class="text-xs text-slate-500 dark:text-slate-400">
                                    {{ $t('settings.zoomLevelDesc') }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div
                        class="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <button @click="isOpen = false"
                            class="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm cursor-pointer">
                            {{ $t('common.done') }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
