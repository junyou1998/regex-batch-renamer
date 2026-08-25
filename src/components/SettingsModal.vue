<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useSettingsStore } from '../stores/settingsStore'
import { useAiStore } from '../stores/aiStore'
import { useI18n } from 'vue-i18n'
import type { Locale } from '../services/preferences'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Minus,
  Plus,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-vue-next'
import ProviderIcon from './icons/ProviderIcon.vue'
import type { AiProfile, AiApiTestResult } from '../services/desktop/types'

const providerOptions = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    defaultEndpoint: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-7-sonnet-latest',
    models: ['claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'gpt-4.5-preview'],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    defaultEndpoint: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-3.6-flash',
    models: ['gemini-3.6-flash', 'gemini-3.6-pro', 'gemini-2.5-flash', 'gemini-1.5-flash'],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    defaultEndpoint: 'http://localhost:11434/v1',
    defaultModel: 'llama3.3',
    models: ['llama3.3', 'qwen2.5', 'deepseek-r1:8b', 'mistral'],
  },
] as const

const aiViewMode = ref<'list' | 'editor'>('list')
const isCreatingNew = ref(false)
const editingProfile = ref<AiProfile>({
  id: 'gemini-default',
  name: 'gemini',
  provider: 'gemini',
  type: 'api',
  apiKey: '',
  endpoint: 'https://generativelanguage.googleapis.com',
  model: 'gemini-3.6-flash',
  temperature: 0.2,
  isBuiltin: false,
})
const showProviderDropdown = ref(false)
const showApiKey = ref(false)
const isTestingApi = ref(false)
const apiTestResult = ref<AiApiTestResult | null>(null)

const currentProviderModels = computed(() => {
  const found = providerOptions.find((p) => p.id === editingProfile.value.provider)
  return found ? found.models : []
})

function getProviderDisplayName(prof: AiProfile): string {
  if (prof.provider === 'claude_cli') return 'Claude Code CLI'
  if (prof.provider === 'codex_cli') return 'OpenAI Codex CLI'
  if (prof.provider === 'grok_cli') return 'xAI Grok CLI'
  const found = providerOptions.find((p) => p.id === prof.provider)
  return found ? found.name : prof.provider
}

function startCreateProfile() {
  isCreatingNew.value = true
  editingProfile.value = {
    id: `profile-${Date.now()}`,
    name: 'gemini',
    provider: 'gemini',
    type: 'api',
    apiKey: '',
    endpoint: 'https://generativelanguage.googleapis.com',
    model: 'gemini-3.6-flash',
    temperature: 0.2,
    isBuiltin: false,
  }
  showApiKey.value = false
  showProviderDropdown.value = false
  apiTestResult.value = null
  aiViewMode.value = 'editor'
}

function startEditProfile(prof: AiProfile) {
  isCreatingNew.value = false
  editingProfile.value = JSON.parse(JSON.stringify(prof))
  showApiKey.value = false
  showProviderDropdown.value = false
  apiTestResult.value = null
  aiViewMode.value = 'editor'
}

function selectProvider(provId: string) {
  const opt = providerOptions.find((p) => p.id === provId)
  if (opt) {
    editingProfile.value.provider = opt.id as any
    if (isCreatingNew.value || !editingProfile.value.name || editingProfile.value.name === 'gemini') {
      editingProfile.value.name = opt.name.toLowerCase()
    }
    editingProfile.value.endpoint = opt.defaultEndpoint
    editingProfile.value.model = opt.defaultModel
  }
  showProviderDropdown.value = false
}

function selectModel(modelName: string) {
  editingProfile.value.model = modelName
}

function saveCurrentProfile() {
  if (!editingProfile.value.name.trim()) {
    editingProfile.value.name = editingProfile.value.provider
  }
  aiStore.saveProfile(editingProfile.value)
  aiViewMode.value = 'list'
}

async function handleTestConnection() {
  isTestingApi.value = true
  apiTestResult.value = null
  try {
    const res = await aiStore.testProfileConnection(editingProfile.value)
    apiTestResult.value = res
  } finally {
    isTestingApi.value = false
  }
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
              <!-- LEVEL 1: Profiles List View -->
              <div v-if="aiViewMode === 'list'" class="space-y-5">
                <!-- Header: AI 配置列表 + 新增配置 -->
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {{ $t('settings.profileListTitle') }}
                  </h3>
                  <button
                    type="button"
                    @click="startCreateProfile"
                    class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus class="w-3.5 h-3.5" />
                    {{ $t('settings.addProfileBtn') }}
                  </button>
                </div>

                <!-- Profile Cards -->
                <div class="space-y-2.5">
                  <div
                    v-for="profile in aiStore.profiles"
                    :key="profile.id"
                    class="p-3.5 sm:p-4 rounded-xl border flex items-center justify-between gap-3 transition-all"
                    :class="[
                      profile.id === aiStore.activeProfileId
                        ? 'border-2 border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 shadow-xs ring-1 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/40',
                    ]"
                  >
                    <!-- Left info -->
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center">
                        <ProviderIcon :provider="profile.provider" class="w-4 h-4" />
                      </div>
                      <div class="min-w-0 space-y-0.5">
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                            {{ profile.name }}
                          </span>
                          <span
                            v-if="profile.id === aiStore.activeProfileId"
                            class="px-2 py-0.5 rounded-full bg-blue-600 text-white dark:bg-blue-500 text-[10px] font-bold shrink-0 tracking-wide"
                          >
                            {{ $t('settings.profileDefaultBadge') }}
                          </span>
                        </div>
                        <p class="text-xs text-slate-500 dark:text-slate-400 capitalize truncate">
                          {{ getProviderDisplayName(profile) }}
                        </p>
                      </div>
                    </div>

                    <!-- Right actions -->
                    <div class="flex items-center gap-2.5 sm:gap-3 shrink-0 text-xs font-medium">
                      <button
                        v-if="profile.id !== aiStore.activeProfileId"
                        type="button"
                        @click="aiStore.setActiveProfile(profile.id)"
                        class="text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                      >
                        {{ $t('settings.setAsDefault') }}
                      </button>
                      <button
                        type="button"
                        @click="startEditProfile(profile)"
                        class="text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                      >
                        {{ $t('settings.editProfile') }}
                      </button>
                      <button
                        v-if="!profile.isBuiltin"
                        type="button"
                        @click="aiStore.deleteProfile(profile.id)"
                        class="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors cursor-pointer font-bold"
                      >
                        {{ $t('settings.deleteProfile') }}
                      </button>
                    </div>
                  </div>
                </div>

                <hr class="border-slate-200 dark:border-slate-800" />

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
              </div>

              <!-- LEVEL 2: Add / Edit Profile View -->
              <div v-else class="space-y-4">
                <!-- Navigation Bar: Back + Title -->
                <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    @click="aiViewMode = 'list'"
                    class="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 cursor-pointer py-1"
                  >
                    <ArrowLeft class="w-4 h-4" />
                    <span>{{ $t('settings.backBtn') }}</span>
                  </button>
                  <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {{ isCreatingNew ? $t('settings.addProfileTitle') : $t('settings.editProfileTitle') }}
                  </h3>
                </div>

                <!-- Form Fields -->
                <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3.5 text-xs shadow-2xs">
                  <!-- 1. 配置名稱 -->
                  <div class="grid grid-cols-1 sm:grid-cols-4 items-center gap-2">
                    <label class="font-medium text-slate-700 dark:text-slate-300">{{ $t('settings.profileName') }}</label>
                    <div class="sm:col-span-3">
                      <input
                        type="text"
                        v-model="editingProfile.name"
                        :placeholder="$t('settings.profileNamePlaceholder')"
                        class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <!-- 2. 供應商 (Custom Dropdown) -->
                  <div class="grid grid-cols-1 sm:grid-cols-4 items-center gap-2">
                    <label class="font-medium text-slate-700 dark:text-slate-300">{{ $t('settings.apiProviderLabel') }}</label>
                    <div class="sm:col-span-3 relative">
                      <button
                        v-if="!editingProfile.isBuiltin"
                        type="button"
                        @click="showProviderDropdown = !showProviderDropdown"
                        class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-xs flex items-center justify-between cursor-pointer focus:ring-2 focus:ring-blue-500"
                      >
                        <div class="flex items-center gap-2">
                          <ProviderIcon :provider="editingProfile.provider" class="w-4 h-4" />
                          <span class="font-medium capitalize">{{ getProviderDisplayName(editingProfile) }}</span>
                        </div>
                        <ChevronDown class="w-4 h-4 text-slate-400" />
                      </button>

                      <div
                        v-else
                        class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium"
                      >
                        <ProviderIcon :provider="editingProfile.provider" class="w-4 h-4" />
                        <span>{{ getProviderDisplayName(editingProfile) }} (CLI)</span>
                      </div>

                      <!-- Dropdown Menu -->
                      <div
                        v-if="showProviderDropdown"
                        class="absolute z-20 left-0 right-0 mt-1 py-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden"
                      >
                        <div
                          v-for="opt in providerOptions"
                          :key="opt.id"
                          @click="selectProvider(opt.id)"
                          class="px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                          :class="{ 'bg-slate-50 dark:bg-slate-800/80 font-bold text-blue-600 dark:text-blue-400': editingProfile.provider === opt.id }"
                        >
                          <div class="flex items-center gap-2.5">
                            <ProviderIcon :provider="opt.id" class="w-4 h-4" />
                            <span>{{ opt.name }}</span>
                          </div>
                          <Check v-if="editingProfile.provider === opt.id" class="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 3. API Key (API Only) -->
                  <div v-if="editingProfile.type === 'api'" class="grid grid-cols-1 sm:grid-cols-4 items-center gap-2">
                    <label class="font-medium text-slate-700 dark:text-slate-300">API Key</label>
                    <div class="sm:col-span-3 relative">
                      <input
                        :type="showApiKey ? 'text' : 'password'"
                        v-model="editingProfile.apiKey"
                        placeholder="請輸入 API Key"
                        class="w-full pl-3 pr-9 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                      />
                      <button
                        type="button"
                        @click="showApiKey = !showApiKey"
                        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        :title="showApiKey ? '隱藏 API Key' : '顯示 API Key'"
                      >
                        <EyeOff v-if="showApiKey" class="w-4 h-4" />
                        <Eye v-else class="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <!-- 4. Endpoint (API Only) -->
                  <div v-if="editingProfile.type === 'api'" class="grid grid-cols-1 sm:grid-cols-4 items-center gap-2">
                    <label class="font-medium text-slate-700 dark:text-slate-300">Endpoint</label>
                    <div class="sm:col-span-3">
                      <input
                        type="text"
                        v-model="editingProfile.endpoint"
                        placeholder="https://..."
                        class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  <!-- 5. 預設模型 (API Only) -->
                  <div v-if="editingProfile.type === 'api'" class="grid grid-cols-1 sm:grid-cols-4 items-center gap-2">
                    <label class="font-medium text-slate-700 dark:text-slate-300">{{ $t('settings.defaultModel') }}</label>
                    <div class="sm:col-span-3 space-y-1.5">
                      <input
                        type="text"
                        v-model="editingProfile.model"
                        :placeholder="$t('settings.modelIdPlaceholder')"
                        class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                      />
                      <div v-if="currentProviderModels.length > 0" class="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span class="text-[10px] text-slate-400">{{ $t('settings.quickSelectLabel') }}:</span>
                        <button
                          v-for="m in currentProviderModels"
                          :key="m"
                          type="button"
                          @click="selectModel(m)"
                          class="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-slate-200/80 dark:border-slate-700"
                        >
                          {{ m }}
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Test Result Alert -->
                  <div
                    v-if="apiTestResult"
                    class="p-2.5 rounded-lg text-xs flex items-start gap-2"
                    :class="apiTestResult.success ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300'"
                  >
                    <Check v-if="apiTestResult.success" class="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                    <AlertTriangle v-else class="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                    <span>{{ apiTestResult.message }}</span>
                  </div>

                  <!-- Bottom Actions -->
                  <div class="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      v-if="editingProfile.type === 'api'"
                      type="button"
                      @click="handleTestConnection"
                      :disabled="isTestingApi || !editingProfile.apiKey?.trim()"
                      class="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isTestingApi }" />
                      {{ $t('settings.testConnection') }}
                    </button>
                    <button
                      type="button"
                      @click="saveCurrentProfile"
                      class="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                    >
                      {{ $t('settings.saveAndApply') }}
                    </button>
                  </div>
                </div>
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
