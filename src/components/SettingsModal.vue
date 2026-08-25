<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useSettingsStore } from '../stores/settingsStore'
import { useAiStore } from '../stores/aiStore'
import { useI18n } from 'vue-i18n'
import type { Locale } from '../services/preferences'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Info,
  Minus,
  Plus,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-vue-next'
import ClaudeIcon from './icons/ClaudeIcon.vue'
import CodexIcon from './icons/CodexIcon.vue'
import GrokIcon from './icons/GrokIcon.vue'
import GeminiIcon from './icons/GeminiIcon.vue'

const showApiKey = ref(false)

function selectModel(modelName: string) {
  aiStore.saveGeminiProfile({ model: modelName })
}

async function handleTestGeminiConnection() {
  await aiStore.testGeminiConnection()
}

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const settingsStore = useSettingsStore()
const aiStore = useAiStore()
const { locale } = useI18n()

const activeTab = ref<'general' | 'ai'>('general')

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const availableLocales = [
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'zh-CN', name: '简体中文' },
  { code: 'en-US', name: 'English' },
  { code: 'ja-JP', name: '日本語' },
] as const satisfies readonly { code: Locale; name: string }[]

const showLanguageMenu = ref(false)

const selectedLanguage = computed(() => {
  return availableLocales.find((lang) => lang.code === settingsStore.language) ?? availableLocales[0]
})

const themeOptions = [
  { value: 'auto', labelKey: 'theme.auto' },
  { value: 'light', labelKey: 'theme.light' },
  { value: 'dark', labelKey: 'theme.dark' },
] as const

watch(
  () => settingsStore.language,
  (newLang) => {
    locale.value = newLang
  },
  { immediate: true }
)

watch(isOpen, (open) => {
  if (open) {
    void aiStore.checkAllStatuses()
  } else {
    showLanguageMenu.value = false
  }
})

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

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})

function adjustZoom(delta: number) {
  const newValue = settingsStore.zoomLevel + delta
  settingsStore.setZoomLevel(newValue)
}

function handleThemeChange(event: MouseEvent, value: 'auto' | 'light' | 'dark') {
  const isAppearanceTransition =
    'startViewTransition' in document &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches

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
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @keydown="handleKeydown"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="isOpen = false"></div>

        <!-- Modal -->
        <div
          class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0"
          >
            <h2 class="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Settings class="w-5 h-5 text-slate-500" />
              {{ $t('settings.title') }}
            </h2>
            <button
              @click="isOpen = false"
              class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <!-- Tabs Navigation -->
          <div
            class="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 shrink-0"
          >
            <button
              type="button"
              @click="activeTab = 'general'"
              class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-all cursor-pointer"
              :class="[
                activeTab === 'general'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
              ]"
            >
              <SlidersHorizontal class="w-4 h-4" />
              {{ $t('settings.tabGeneral') }}
            </button>

            <button
              type="button"
              @click="activeTab = 'ai'"
              class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-all cursor-pointer"
              :class="[
                activeTab === 'ai'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
              ]"
            >
              <Sparkles class="w-4 h-4" />
              {{ $t('settings.tabAi') }}
            </button>
          </div>

          <!-- Content (Scrollable) -->
          <div class="px-6 py-5 space-y-6 overflow-y-auto custom-scrollbar flex-1">
            <!-- TAB 1: General Settings -->
            <div v-if="activeTab === 'general'" class="space-y-6">
              <!-- Default Settings Section -->
              <div class="space-y-4">
                <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {{ $t('settings.defaults') }}
                </h3>

                <label class="block cursor-pointer group/item select-none space-y-1">
                  <div class="flex items-center gap-2.5">
                    <div class="relative flex items-center justify-center shrink-0">
                      <input
                        type="checkbox"
                        v-model="settingsStore.defaultUseRegex"
                        class="sr-only peer"
                      />
                      <div
                        class="w-4 h-4 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/40 transition-all flex items-center justify-center shadow-2xs group-hover/item:border-slate-400 dark:group-hover/item:border-slate-500"
                      >
                        <Check
                          v-if="settingsStore.defaultUseRegex"
                          class="w-3 h-3 text-white stroke-[3.5]"
                        />
                      </div>
                    </div>
                    <span
                      class="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors leading-none pt-px"
                    >
                      {{ $t('settings.defaultUseRegex') }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400 pl-[26px]">
                    {{ $t('settings.defaultUseRegexDesc') }}
                  </p>
                </label>

                <label class="block cursor-pointer group/item select-none space-y-1">
                  <div class="flex items-center gap-2.5">
                    <div class="relative flex items-center justify-center shrink-0">
                      <input
                        type="checkbox"
                        v-model="settingsStore.processFilenameOnly"
                        class="sr-only peer"
                      />
                      <div
                        class="w-4 h-4 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/40 transition-all flex items-center justify-center shadow-2xs group-hover/item:border-slate-400 dark:group-hover/item:border-slate-500"
                      >
                        <Check
                          v-if="settingsStore.processFilenameOnly"
                          class="w-3 h-3 text-white stroke-[3.5]"
                        />
                      </div>
                    </div>
                    <span
                      class="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors leading-none pt-px"
                    >
                      {{ $t('settings.processFilenameOnly') }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400 pl-[26px]">
                    {{ $t('settings.processFilenameOnlyDesc') }}
                  </p>
                </label>
              </div>

              <hr class="border-slate-200 dark:border-slate-700" />

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
                    <button
                      type="button"
                      @click="toggleLanguageMenu"
                      class="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm border rounded-lg transition-all cursor-pointer bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                    >
                      <span class="truncate">{{ selectedLanguage.name }}</span>
                      <ChevronDown
                        :class="[
                          'w-4 h-4 text-slate-400 transition-transform',
                          showLanguageMenu ? 'rotate-180' : '',
                        ]"
                      />
                    </button>

                    <Transition name="dropdown">
                      <div
                        v-if="showLanguageMenu"
                        class="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/5 dark:ring-white/10"
                      >
                        <button
                          v-for="lang in availableLocales"
                          :key="lang.code"
                          type="button"
                          @click="selectLanguage(lang.code)"
                          :class="[
                            'w-full flex items-center justify-between px-3 py-2.5 text-left text-sm transition-colors cursor-pointer',
                            settingsStore.language === lang.code
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                          ]"
                        >
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
                    <button
                      v-for="option in themeOptions"
                      :key="option.value"
                      @click="handleThemeChange($event, option.value)"
                      :class="[
                        'flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-all cursor-pointer',
                        settingsStore.themeMode === option.value
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500',
                      ]"
                    >
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
                    <button
                      @click="adjustZoom(-10)"
                      :disabled="settingsStore.zoomLevel <= 80"
                      class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <Minus class="w-4 h-4" />
                    </button>
                    <input
                      type="range"
                      v-model.number="settingsStore.zoomLevel"
                      min="80"
                      max="200"
                      step="10"
                      class="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <button
                      @click="adjustZoom(10)"
                      :disabled="settingsStore.zoomLevel >= 200"
                      class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <Plus class="w-4 h-4" />
                    </button>
                    <span
                      class="w-14 text-center text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      {{ settingsStore.zoomLevel }}%
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{ $t('settings.zoomLevelDesc') }}
                  </p>
                </div>
              </div>
            </div>

            <!-- TAB 2: AI Settings -->
            <div v-else class="space-y-6">
              <!-- AI Tool / Provider Selection -->
              <div class="space-y-3">
                <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {{ $t('settings.aiProvider') }}
                </h3>

                <div class="grid grid-cols-1 gap-2.5">
                  <!-- Option 1: Claude Code CLI -->
                  <div
                    @click="aiStore.setProvider('claude')"
                    class="p-3.5 rounded-xl transition-all cursor-pointer flex items-start gap-3"
                    :class="[
                      aiStore.selectedProvider === 'claude'
                        ? 'border-2 border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-xs ring-1 ring-blue-500/30'
                        : 'border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900/40',
                    ]"
                  >
                    <div class="p-2 rounded-lg bg-[#D97757]/15 dark:bg-[#D97757]/25 text-[#D97757] shrink-0 mt-0.5 flex items-center justify-center">
                      <ClaudeIcon className="w-4 h-4 text-[#D97757]" />
                    </div>
                    <div class="space-y-1 flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <span class="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          Claude Code CLI
                        </span>
                        <span
                          v-if="aiStore.selectedProvider === 'claude'"
                          class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 flex items-center gap-1"
                        >
                          <Check class="w-3 h-3 stroke-[3]" />
                          {{ $t('settings.aiActive') }}
                        </span>
                        <span
                          v-else
                          class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        >
                          {{ $t('settings.aiStatusAvailable') }}
                        </span>
                      </div>
                      <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {{ $t('settings.aiClaudeCliDesc') }}
                      </p>
                    </div>
                  </div>

                  <!-- Option 2: OpenAI Codex CLI -->
                  <div
                    @click="aiStore.setProvider('codex')"
                    class="p-3.5 rounded-xl transition-all cursor-pointer flex items-start gap-3"
                    :class="[
                      aiStore.selectedProvider === 'codex'
                        ? 'border-2 border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-xs ring-1 ring-blue-500/30'
                        : 'border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900/40',
                    ]"
                  >
                    <div class="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 shrink-0 mt-0.5 flex items-center justify-center">
                      <CodexIcon className="w-5 h-5" />
                    </div>
                    <div class="space-y-1 flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <span class="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          OpenAI Codex CLI
                        </span>
                        <span
                          v-if="aiStore.selectedProvider === 'codex'"
                          class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 flex items-center gap-1"
                        >
                          <Check class="w-3 h-3 stroke-[3]" />
                          {{ $t('settings.aiActive') }}
                        </span>
                        <span
                          v-else
                          class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        >
                          {{ $t('settings.aiStatusAvailable') }}
                        </span>
                      </div>
                      <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {{ $t('settings.aiCodexCliDesc') }}
                      </p>
                    </div>
                  </div>

                  <!-- Option 3: xAI Grok CLI -->
                  <div
                    @click="aiStore.setProvider('grok')"
                    class="p-3.5 rounded-xl transition-all cursor-pointer flex items-start gap-3"
                    :class="[
                      aiStore.selectedProvider === 'grok'
                        ? 'border-2 border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-xs ring-1 ring-blue-500/30'
                        : 'border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900/40',
                    ]"
                  >
                    <div class="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5 flex items-center justify-center">
                      <GrokIcon className="w-5 h-5" />
                    </div>
                    <div class="space-y-1 flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <span class="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          xAI Grok CLI
                        </span>
                        <span
                          v-if="aiStore.selectedProvider === 'grok'"
                          class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 flex items-center gap-1"
                        >
                          <Check class="w-3 h-3 stroke-[3]" />
                          {{ $t('settings.aiActive') }}
                        </span>
                        <span
                          v-else
                          class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        >
                          {{ $t('settings.aiStatusAvailable') }}
                        </span>
                      </div>
                      <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {{ $t('settings.aiGrokCliDesc') }}
                      </p>
                    </div>
                  </div>

                  <!-- Option 4: Google Gemini API -->
                  <div
                    @click="aiStore.setProvider('gemini_api')"
                    class="p-3.5 rounded-xl transition-all cursor-pointer flex items-start gap-3"
                    :class="[
                      aiStore.selectedProvider === 'gemini_api'
                        ? 'border-2 border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 shadow-xs ring-1 ring-purple-500/30'
                        : 'border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900/40',
                    ]"
                  >
                    <div class="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5 flex items-center justify-center">
                      <GeminiIcon class="w-5 h-5" />
                    </div>
                    <div class="space-y-1 flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <span class="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          Google Gemini API
                        </span>
                        <span
                          v-if="aiStore.selectedProvider === 'gemini_api'"
                          class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 flex items-center gap-1"
                        >
                          <Check class="w-3 h-3 stroke-[3]" />
                          {{ $t('settings.aiActive') }}
                        </span>
                        <span
                          v-else
                          class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        >
                          {{ $t('settings.aiStatusAvailable') }}
                        </span>
                      </div>
                      <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {{ $t('settings.aiGeminiApiDesc') }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <hr class="border-slate-200 dark:border-slate-700" />

              <!-- Case A: Gemini API Configuration Form -->
              <div v-if="aiStore.selectedProvider === 'gemini_api'" class="space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                    <GeminiIcon class="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>{{ $t('settings.geminiConfigTitle') }}</span>
                  </h3>
                  <button
                    type="button"
                    @click="handleTestGeminiConnection"
                    :disabled="aiStore.isTestingApi || !aiStore.geminiProfile.apiKey.trim()"
                    class="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': aiStore.isTestingApi }" />
                    {{ $t('settings.testConnection') }}
                  </button>
                </div>

                <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 space-y-3 text-xs shadow-2xs">
                  <!-- 1. 配置名稱 -->
                  <div class="grid grid-cols-1 sm:grid-cols-4 items-center gap-2">
                    <label class="font-medium text-slate-700 dark:text-slate-300">{{ $t('settings.profileName') }}</label>
                    <div class="sm:col-span-3">
                      <input
                        type="text"
                        v-model="aiStore.geminiProfile.name"
                        @change="aiStore.saveGeminiProfile({ name: aiStore.geminiProfile.name })"
                        :placeholder="$t('settings.profileNamePlaceholder')"
                        class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <!-- 2. 供應商 -->
                  <div class="grid grid-cols-1 sm:grid-cols-4 items-center gap-2">
                    <label class="font-medium text-slate-700 dark:text-slate-300">{{ $t('settings.apiProviderLabel') }}</label>
                    <div class="sm:col-span-3">
                      <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-xs font-medium">
                        <GeminiIcon class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>Gemini</span>
                      </div>
                    </div>
                  </div>

                  <!-- 3. API Key -->
                  <div class="grid grid-cols-1 sm:grid-cols-4 items-center gap-2">
                    <label class="font-medium text-slate-700 dark:text-slate-300">API Key</label>
                    <div class="sm:col-span-3 relative">
                      <input
                        :type="showApiKey ? 'text' : 'password'"
                        v-model="aiStore.geminiProfile.apiKey"
                        @change="aiStore.saveGeminiProfile({ apiKey: aiStore.geminiProfile.apiKey })"
                        placeholder="請輸入 API Key (AIzaSy...)"
                        class="w-full pl-3 pr-9 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-mono"
                      />
                      <button
                        type="button"
                        @click="showApiKey = !showApiKey"
                        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        :title="showApiKey ? '隱藏 API Key' : '顯示 API Key'"
                      >
                        <EyeOff v-if="showApiKey" class="w-3.5 h-3.5" />
                        <Eye v-else class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <!-- 4. Endpoint -->
                  <div class="grid grid-cols-1 sm:grid-cols-4 items-center gap-2">
                    <label class="font-medium text-slate-700 dark:text-slate-300">Endpoint</label>
                    <div class="sm:col-span-3">
                      <input
                        type="text"
                        v-model="aiStore.geminiProfile.endpoint"
                        @change="aiStore.saveGeminiProfile({ endpoint: aiStore.geminiProfile.endpoint })"
                        placeholder="https://generativelanguage.googleapis.com"
                        class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  <!-- 5. 預設模型 -->
                  <div class="grid grid-cols-1 sm:grid-cols-4 items-center gap-2">
                    <label class="font-medium text-slate-700 dark:text-slate-300">{{ $t('settings.defaultModel') }}</label>
                    <div class="sm:col-span-3 space-y-1.5">
                      <input
                        type="text"
                        list="gemini-models-list"
                        v-model="aiStore.geminiProfile.model"
                        @change="aiStore.saveGeminiProfile({ model: aiStore.geminiProfile.model })"
                        :placeholder="$t('settings.modelIdPlaceholder')"
                        class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-mono"
                      />
                      <datalist id="gemini-models-list">
                        <option value="gemini-2.5-flash" />
                        <option value="gemini-2.5-pro" />
                        <option value="gemini-1.5-flash" />
                        <option value="gemini-1.5-pro" />
                      </datalist>
                      <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span class="text-[10px] text-slate-400">快速選擇:</span>
                        <button
                          v-for="m in ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash']"
                          :key="m"
                          type="button"
                          @click="selectModel(m)"
                          class="px-1.5 py-0.5 rounded text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors cursor-pointer border border-purple-200/60 dark:border-purple-800/50"
                        >
                          {{ m }}
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Test Result Alert -->
                  <div
                    v-if="aiStore.apiTestResult"
                    class="p-2.5 rounded-lg text-[11px] flex items-start gap-2"
                    :class="aiStore.apiTestResult.success ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300'"
                  >
                    <Check v-if="aiStore.apiTestResult.success" class="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                    <AlertTriangle v-else class="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                    <span>{{ aiStore.apiTestResult.message }}</span>
                  </div>
                </div>
              </div>

              <!-- Case B: CLI Status & Details -->
              <div v-else class="space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                    <GrokIcon v-if="aiStore.selectedProvider === 'grok'" className="w-4 h-4" />
                    <CodexIcon v-else-if="aiStore.selectedProvider === 'codex'" className="w-4 h-4" />
                    <ClaudeIcon v-else className="w-3.5 h-3.5 text-[#D97757]" />
                    <span>
                      {{
                        aiStore.selectedProvider === 'grok'
                          ? $t('settings.aiGrokStatusTitle')
                          : aiStore.selectedProvider === 'codex'
                            ? $t('settings.aiCodexStatusTitle')
                            : $t('settings.aiStatusTitle')
                      }}
                    </span>
                  </h3>
                  <button
                    type="button"
                    @click="aiStore.checkStatus()"
                    :disabled="aiStore.isCheckingStatus"
                    class="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': aiStore.isCheckingStatus }" />
                    {{ $t('settings.aiRecheck') }}
                  </button>
                </div>

                <div
                  class="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 space-y-2.5 text-xs shadow-2xs"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-slate-500 dark:text-slate-400">{{ $t('settings.aiConnection') }}</span>
                    <div class="flex items-center gap-1.5 font-medium">
                      <span
                        class="w-2 h-2 rounded-full"
                        :class="aiStore.status?.ready ? 'bg-emerald-500' : 'bg-red-500'"
                      ></span>
                      <span :class="aiStore.status?.ready ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-500'">
                        {{ aiStore.status?.ready ? $t('settings.aiReady') : $t('settings.aiNotReady') }}
                      </span>
                    </div>
                  </div>

                  <div v-if="aiStore.status?.version" class="flex items-center justify-between">
                    <span class="text-slate-500 dark:text-slate-400">{{ $t('settings.aiVersion') }}</span>
                    <span class="font-mono text-slate-800 dark:text-slate-200">{{ aiStore.status.version }}</span>
                  </div>

                  <div v-if="aiStore.status?.path" class="flex flex-col gap-1">
                    <span class="text-slate-500 dark:text-slate-400">{{ $t('settings.aiPath') }}</span>
                    <span class="font-mono text-[11px] p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 break-all select-all">
                      {{ aiStore.status.path }}
                    </span>
                  </div>

                  <div v-if="!aiStore.status?.ready && aiStore.status?.message" class="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-2">
                    <AlertTriangle class="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{{ aiStore.status.message }}</span>
                  </div>
                </div>
              </div>

              <hr class="border-slate-200 dark:border-slate-700" />

              <!-- Automation Preferences -->
              <div class="space-y-4">
                <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {{ $t('settings.aiBehavior') }}
                </h3>

                <label class="block cursor-pointer group/item select-none space-y-1">
                  <div class="flex items-center gap-2.5">
                    <div class="relative flex items-center justify-center shrink-0">
                      <input
                        type="checkbox"
                        v-model="aiStore.autoApply"
                        class="sr-only peer"
                      />
                      <div
                        class="w-4 h-4 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/40 transition-all flex items-center justify-center shadow-2xs group-hover/item:border-slate-400 dark:group-hover/item:border-slate-500"
                      >
                        <Check
                          v-if="aiStore.autoApply"
                          class="w-3 h-3 text-white stroke-[3.5]"
                        />
                      </div>
                    </div>
                    <span
                      class="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors leading-none pt-px"
                    >
                      {{ $t('settings.aiAutoApply') }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400 pl-[26px]">
                    {{ $t('settings.aiAutoApplyDesc') }}
                  </p>
                </label>
              </div>

              <!-- Custom API Placeholder Notice -->
              <div class="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2.5">
                <Info class="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                <p class="leading-relaxed">
                  {{ $t('settings.aiApiNotice') }}
                </p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div
            class="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 shrink-0"
          >
            <button
              @click="isOpen = false"
              class="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
            >
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
