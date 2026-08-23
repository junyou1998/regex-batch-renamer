<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { marked } from 'marked'
import { usePluginStore, type InstalledPlugin, type MarketplacePlugin, type PluginOption } from '../stores/pluginStore'
import { runPluginHealthCheck } from '../services/pluginRunner'
import { useToastStore } from '../stores/toastStore'
import {
  X,
  Puzzle,
  Package,
  ShoppingBag,
  Upload,
  Download,
  Trash2,
  Search,
  RefreshCw,
  Sparkles,
  Layers,
  ShieldCheck,
  LoaderCircle,
  Check,
  ArrowLeft,
  ExternalLink,
  BookOpen,
  Globe
} from 'lucide-vue-next'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const pluginStore = usePluginStore()
const toastStore = useToastStore()

const activeTab = ref<'installed' | 'marketplace'>('installed')
const searchQuery = ref('')
const isDragging = ref(false)
const installingMap = ref<Record<string, boolean>>({})

// Detail View State
interface PluginDetailTarget {
  id: string
  name: string
  version: string
  author?: string
  description?: string
  icon?: string
  homepage?: string
  permissions?: string[]
  options?: PluginOption[]
  readme?: string
  readmeUrl?: string
  downloadUrl?: string
  isInstalled: boolean
  isEnabled?: boolean
}

const selectedDetailPlugin = ref<PluginDetailTarget | null>(null)
const readmeContent = ref<string>('')
const isLoadingReadme = ref<boolean>(false)

const filteredInstalledPlugins = computed<InstalledPlugin[]>(() => {
  let list = pluginStore.pluginList
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(
      p =>
        p.manifest.name.toLowerCase().includes(q) ||
        p.manifest.id.toLowerCase().includes(q) ||
        (p.manifest.description && p.manifest.description.toLowerCase().includes(q))
    )
  }
  return list
})

const filteredMarketplacePlugins = computed<MarketplacePlugin[]>(() => {
  let list = pluginStore.marketplacePlugins
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    )
  }
  return list
})

function close() {
  selectedDetailPlugin.value = null
  emit('update:modelValue', false)
}

watch(() => props.modelValue, (val) => {
  if (!val) {
    selectedDetailPlugin.value = null
    readmeContent.value = ''
  }
})

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false

  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0]
    await processPluginFile(file)
  }
}

async function processPluginFile(file: File) {
  try {
    const manifest = await pluginStore.installPluginFromZip(file)
    toastStore.addToast(`成功安裝外掛：${manifest.name} (v${manifest.version})`, 'success', 3500)
    activeTab.value = 'installed'
  } catch (err: any) {
    toastStore.addToast(`外掛安裝失敗: ${err.message}`, 'error', 4500)
  }
}

function handleDeletePlugin(plugin: InstalledPlugin | { manifest?: { id: string; name: string }; id?: string; name?: string }) {
  const id = 'manifest' in plugin && plugin.manifest ? plugin.manifest.id : (plugin as any).id
  const name = 'manifest' in plugin && plugin.manifest ? plugin.manifest.name : (plugin as any).name

  if (window.confirm(`確定要解除安裝外掛「${name}」嗎？`)) {
    pluginStore.uninstallPlugin(id)
    toastStore.addToast(`已解除安裝 ${name}`, 'info', 2500)
    if (selectedDetailPlugin.value && selectedDetailPlugin.value.id === id) {
      selectedDetailPlugin.value.isInstalled = false
    }
  }
}

function handleRefreshMarketplace() {
  pluginStore.fetchMarketplacePlugins()
}

watch(activeTab, (tab) => {
  if (tab === 'marketplace' && pluginStore.marketplacePlugins.length === 0) {
    pluginStore.fetchMarketplacePlugins()
  }
})

async function handleInstallMarketplace(plugin: MarketplacePlugin | PluginDetailTarget) {
  if (!plugin.downloadUrl) {
    toastStore.addToast('該外掛未提供有效下載連結', 'error', 3000)
    return
  }

  installingMap.value[plugin.id] = true
  try {
    const manifest = await pluginStore.installPluginFromUrl(plugin.downloadUrl)
    toastStore.addToast(`成功安裝外掛：${manifest.name} (v${manifest.version})`, 'success', 3500)
    if (selectedDetailPlugin.value && selectedDetailPlugin.value.id === plugin.id) {
      selectedDetailPlugin.value.isInstalled = true
      selectedDetailPlugin.value.isEnabled = true
    }
  } catch (err: any) {
    toastStore.addToast(`外掛安裝失敗: ${err.message}`, 'error', 4500)
  } finally {
    installingMap.value[plugin.id] = false
  }
}

async function handleCheckHealth(pluginId: string) {
  const result = await runPluginHealthCheck(pluginId)
  if (result.status === 'healthy') {
    toastStore.addToast(`外掛連線正常 (${result.latencyMs}ms)`, 'success', 2500)
  } else {
    toastStore.addToast(`健康檢查異常: ${result.message || '連線失敗'}`, 'error', 3500)
  }
}

// Open Plugin Detail View
async function openPluginDetail(plugin: InstalledPlugin | MarketplacePlugin) {
  const isInstalled = 'manifest' in plugin
  const manifest = isInstalled ? (plugin as InstalledPlugin).manifest : (plugin as MarketplacePlugin)

  selectedDetailPlugin.value = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    author: manifest.author,
    description: manifest.description,
    icon: manifest.icon,
    homepage: manifest.homepage,
    permissions: manifest.permissions,
    options: manifest.options,
    readme: isInstalled ? (plugin as InstalledPlugin).readme : undefined,
    readmeUrl: !isInstalled ? (plugin as MarketplacePlugin).readmeUrl : undefined,
    downloadUrl: !isInstalled ? (plugin as MarketplacePlugin).downloadUrl : undefined,
    isInstalled,
    isEnabled: isInstalled ? (plugin as InstalledPlugin).enabled : undefined
  }

  readmeContent.value = ''

  if (isInstalled && (plugin as InstalledPlugin).readme) {
    readmeContent.value = (plugin as InstalledPlugin).readme!
  } else if (!isInstalled && (plugin as MarketplacePlugin).readmeUrl) {
    isLoadingReadme.value = true
    try {
      const res = await fetch((plugin as MarketplacePlugin).readmeUrl!)
      if (res.ok) {
        readmeContent.value = await res.text()
      }
    } catch (e) {
      console.warn('Failed to load README from marketplace URL:', e)
    } finally {
      isLoadingReadme.value = false
    }
  } else if (isInstalled) {
    const remote = pluginStore.marketplacePlugins.find(m => m.id === manifest.id)
    if (remote?.readmeUrl) {
      isLoadingReadme.value = true
      try {
        const res = await fetch(remote.readmeUrl)
        if (res.ok) {
          readmeContent.value = await res.text()
        }
      } catch {
        // ignore
      } finally {
        isLoadingReadme.value = false
      }
    }
  }
}

function closeDetail() {
  selectedDetailPlugin.value = null
  readmeContent.value = ''
}

const renderedReadmeHtml = computed(() => {
  if (!readmeContent.value) return ''
  try {
    return marked.parse(readmeContent.value) as string
  } catch (err) {
    console.error('Failed to parse markdown:', err)
    return `<p>${readmeContent.value}</p>`
  }
})

import { openUrl } from '@tauri-apps/plugin-opener'

async function handleOpenUrl(url?: string) {
  if (!url) return
  try {
    await openUrl(url)
  } catch {
    window.open(url, '_blank')
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pt-10 animate-fade-in"
      @click.self="close"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <!-- Top Titlebar Window Drag Region (Pass-through for macOS window dragging) -->
      <div data-tauri-drag-region class="absolute top-0 left-0 right-0 h-[38px] z-10 pointer-events-auto"></div>

      <!-- Dragging Overlay Indicator -->
      <div
        v-if="isDragging"
        class="absolute inset-4 z-60 rounded-2xl border-3 border-dashed border-blue-500 bg-blue-500/10 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none text-blue-600 dark:text-blue-400 animate-pulse"
      >
        <Upload class="w-16 h-16 mb-3 stroke-[1.5]" />
        <h3 class="text-xl font-bold">釋放滑鼠以安裝插件</h3>
        <p class="text-sm opacity-80 mt-1">支援 .rbr-plugin 或 .zip 格式</p>
      </div>

      <!-- Modal Card -->
      <div
        class="relative z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl w-full max-w-4xl h-[85vh] max-h-[760px] flex flex-col overflow-hidden text-slate-800 dark:text-slate-200"
      >
        <!-- Modal Header -->
        <header
          data-tauri-drag-region
          class="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xl select-none"
        >
          <div class="flex items-center gap-3 no-drag">
            <button
              v-if="selectedDetailPlugin"
              type="button"
              @click="closeDetail"
              class="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer mr-1 flex items-center gap-1 text-xs font-semibold"
              title="返回列表"
            >
              <ArrowLeft class="w-4 h-4" />
              <span>返回列表</span>
            </button>
            <div v-else class="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shadow-xs">
              <Puzzle class="w-5 h-5" />
            </div>
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {{ selectedDetailPlugin ? selectedDetailPlugin.name : $t('plugins.title') }}
                <span v-if="!selectedDetailPlugin" class="text-xs font-normal px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  {{ pluginStore.pluginList.length }} {{ $t('plugins.installedCount') }}
                </span>
                <span v-else class="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  v{{ selectedDetailPlugin.version }}
                </span>
              </h2>
            </div>
          </div>

          <!-- Middle Drag Area -->
          <div data-tauri-drag-region class="flex-1 h-full min-w-4"></div>

          <div class="flex items-center gap-2 no-drag">
            <!-- Close Button -->
            <button
              type="button"
              @click="close"
              class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer ml-1"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </header>

        <!-- DETAIL VIEW (When a plugin is selected) -->
        <div v-if="selectedDetailPlugin" class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <!-- Hero Header Card -->
          <div class="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex items-start gap-3.5 min-w-0">
              <div class="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold shrink-0 shadow-xs">
                <Sparkles class="w-6 h-6" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ selectedDetailPlugin.name }}</h2>
                  <span class="text-xs font-mono text-slate-500 dark:text-slate-400 font-semibold">v{{ selectedDetailPlugin.version }}</span>
                  <span class="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-200/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300">
                    {{ selectedDetailPlugin.id }}
                  </span>
                </div>
                <div class="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                  <span v-if="selectedDetailPlugin.author">作者：<span class="font-medium text-slate-700 dark:text-slate-300">{{ selectedDetailPlugin.author }}</span></span>
                  <button
                    v-if="selectedDetailPlugin.homepage"
                    type="button"
                    @click="handleOpenUrl(selectedDetailPlugin.homepage)"
                    class="flex items-center gap-1 text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer"
                  >
                    <Globe class="w-3.5 h-3.5" />
                    <span>專案首頁 / 官方網站</span>
                    <ExternalLink class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Action Buttons on Hero Card -->
            <div class="flex items-center gap-2.5 shrink-0">
              <template v-if="pluginStore.getPlugin(selectedDetailPlugin.id)">
                <!-- Toggle enable switch -->
                <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs">
                  <span class="text-slate-600 dark:text-slate-300 font-medium">啟用狀態</span>
                  <label class="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      :checked="pluginStore.getPlugin(selectedDetailPlugin.id)?.enabled"
                      @change="pluginStore.togglePlugin(selectedDetailPlugin.id)"
                      class="sr-only peer"
                    />
                    <div class="w-8 h-4.5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <!-- Uninstall Button -->
                <button
                  type="button"
                  @click="handleDeletePlugin(selectedDetailPlugin)"
                  class="flex items-center gap-1 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  <span>解除安裝</span>
                </button>
              </template>

              <template v-else>
                <button
                  type="button"
                  @click="handleInstallMarketplace(selectedDetailPlugin)"
                  :disabled="installingMap[selectedDetailPlugin.id]"
                  class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <LoaderCircle v-if="installingMap[selectedDetailPlugin.id]" class="w-3.5 h-3.5 animate-spin" />
                  <Download v-else class="w-3.5 h-3.5" />
                  <span>{{ installingMap[selectedDetailPlugin.id] ? '安裝中...' : '安裝外掛' }}</span>
                </button>
              </template>
            </div>
          </div>

          <!-- Description / Badges Strip -->
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span v-if="selectedDetailPlugin.permissions?.includes('network')" class="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 flex items-center gap-1 font-medium">
              <ShieldCheck class="w-3.5 h-3.5" />
              <span>需要網路權限 (Network)</span>
            </span>
            <span v-else class="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1 font-medium">
              <ShieldCheck class="w-3.5 h-3.5" />
              <span>100% 離線純本機運算</span>
            </span>
            <span v-if="selectedDetailPlugin.options?.length" class="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 flex items-center gap-1 font-medium">
              <Layers class="w-3.5 h-3.5" />
              <span>{{ selectedDetailPlugin.options.length }} 個可自訂選項</span>
            </span>
          </div>

          <!-- Markdown Content Body -->
          <div class="border-t border-slate-200 dark:border-slate-800 pt-5">
            <div v-if="isLoadingReadme" class="flex flex-col items-center justify-center py-12 text-slate-400">
              <LoaderCircle class="w-7 h-7 animate-spin mb-3 text-blue-500" />
              <p class="text-xs">正在載入外掛說明文檔 (README.md)...</p>
            </div>

            <div
              v-else-if="renderedReadmeHtml"
              class="plugin-markdown-content text-slate-800 dark:text-slate-200 leading-relaxed text-xs space-y-4"
              v-html="renderedReadmeHtml"
            ></div>

            <!-- Fallback if no README available -->
            <div v-else class="space-y-4 text-xs text-slate-600 dark:text-slate-300">
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <h4 class="font-bold text-sm mb-1 text-slate-900 dark:text-slate-100">外掛簡介</h4>
                <p>{{ selectedDetailPlugin.description || '無詳細說明' }}</p>
              </div>

              <div v-if="selectedDetailPlugin.options?.length" class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <h4 class="font-bold text-sm mb-2 text-slate-900 dark:text-slate-100">可設定參數 (Options)</h4>
                <ul class="list-disc pl-5 space-y-1.5 font-mono text-[11.5px]">
                  <li v-for="opt in selectedDetailPlugin.options" :key="opt.key">
                    <strong>{{ opt.label }} ({{ opt.key }})</strong>: {{ opt.description || `類型: ${opt.type}` }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- LIST VIEW (When no plugin is selected) -->
        <template v-else>
          <!-- Subheader: Navigation Tabs & Search -->
          <div class="px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/40 dark:bg-slate-900/30 shrink-0">
            <!-- Tabs -->
            <div class="flex items-center gap-1 p-0.5 rounded-xl bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                @click="activeTab = 'installed'"
                :class="[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer',
                  activeTab === 'installed'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                ]"
              >
                <Package class="w-3.5 h-3.5" />
                <span>{{ $t('plugins.tabInstalled') }} ({{ pluginStore.pluginList.length }})</span>
              </button>

              <button
                type="button"
                @click="activeTab = 'marketplace'"
                :class="[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer',
                  activeTab === 'marketplace'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                ]"
              >
                <ShoppingBag class="w-3.5 h-3.5" />
                <span>{{ $t('plugins.tabMarketplace') }}</span>
              </button>
            </div>

            <!-- Search & Action -->
            <div class="flex items-center gap-2">
              <div class="relative w-56">
                <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  v-model="searchQuery"
                  type="text"
                  :placeholder="$t('plugins.searchPlaceholder')"
                  class="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                v-if="activeTab === 'marketplace'"
                type="button"
                @click="handleRefreshMarketplace"
                :disabled="pluginStore.isFetchingMarketplace"
                :title="$t('plugins.refresh')"
                class="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': pluginStore.isFetchingMarketplace }" />
              </button>
            </div>
          </div>

          <!-- Modal Body Content -->
          <div class="flex-1 overflow-y-auto custom-scrollbar p-5">
            <!-- TAB 1: INSTALLED PLUGINS -->
            <div v-if="activeTab === 'installed'" class="space-y-3">
              <!-- Empty State -->
              <div
                v-if="filteredInstalledPlugins.length === 0"
                class="flex flex-col items-center justify-center py-16 text-center"
              >
                <div class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                  <Puzzle class="w-7 h-7" />
                </div>
                <h3 class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{{ $t('plugins.emptyInstalled') }}</h3>
                <p class="text-xs text-slate-400 max-w-sm">{{ $t('plugins.emptyInstalledDesc') }}</p>
              </div>

              <!-- Plugin Cards Grid -->
              <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div
                  v-for="plugin in filteredInstalledPlugins"
                  :key="plugin.manifest.id"
                  class="border rounded-xl p-4 transition-all duration-200 bg-white dark:bg-slate-800/80 flex flex-col justify-between group hover:border-blue-300 dark:hover:border-blue-700 shadow-xs"
                  :class="[
                    plugin.enabled
                      ? 'border-slate-200 dark:border-slate-700'
                      : 'border-slate-200/60 dark:border-slate-800/60 opacity-60 bg-slate-50/50 dark:bg-slate-900/40'
                  ]"
                >
                  <!-- Card Top: Info (Click to open detail) -->
                  <div>
                    <div class="flex items-start justify-between gap-2.5 mb-2">
                      <div
                        @click="openPluginDetail(plugin)"
                        class="flex items-center gap-2.5 min-w-0 cursor-pointer"
                        title="點擊查看詳細說明與致謝"
                      >
                        <div class="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200/60 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold shrink-0 group-hover:scale-105 transition-transform">
                          <Sparkles class="w-4 h-4" />
                        </div>
                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5">
                            <h4 class="text-sm font-bold text-slate-900 dark:text-slate-100 truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors" :title="plugin.manifest.name">
                              {{ plugin.manifest.name }}
                            </h4>
                            <span v-if="plugin.isBuiltin" class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 shrink-0">
                              {{ $t('plugins.builtin') }}
                            </span>
                          </div>
                          <p class="text-[11px] text-slate-400 font-mono">
                            v{{ plugin.manifest.version }}
                            <span v-if="plugin.manifest.author">• by {{ plugin.manifest.author }}</span>
                          </p>
                        </div>
                      </div>

                      <!-- Enable/Disable Switch -->
                      <label class="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          :checked="plugin.enabled"
                          @change="pluginStore.togglePlugin(plugin.manifest.id)"
                          class="sr-only peer"
                        />
                        <div class="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <!-- Description -->
                    <p
                      @click="openPluginDetail(plugin)"
                      class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3 line-clamp-2 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      {{ plugin.manifest.description || '無描述' }}
                    </p>

                    <!-- Permissions & Features Badges -->
                    <div class="flex flex-wrap items-center gap-1.5 mb-3 text-[10.5px]">
                      <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 font-mono">
                        {{ plugin.manifest.type }}
                      </span>
                      <span v-if="plugin.manifest.permissions?.includes('network')" class="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 flex items-center gap-1">
                        <ShieldCheck class="w-3 h-3" />
                        {{ $t('plugins.permNetwork') }}
                      </span>
                      <span v-if="plugin.manifest.options?.length" class="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 flex items-center gap-1">
                        <Layers class="w-3 h-3" />
                        {{ plugin.manifest.options.length }} {{ $t('plugins.optionsCount') }}
                      </span>
                    </div>
                  </div>

                  <!-- Card Bottom: Actions -->
                  <div class="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2 text-slate-400 text-[11px]">
                      <button
                        type="button"
                        @click="openPluginDetail(plugin)"
                        class="hover:text-blue-500 transition-colors flex items-center gap-1 cursor-pointer"
                        title="點擊查看詳細說明"
                      >
                        <BookOpen class="w-3 h-3" />
                        <span class="font-mono">{{ plugin.manifest.id }}</span>
                      </button>
                      
                      <!-- Health Check Button for Network Plugins -->
                      <button
                        v-if="plugin.manifest.permissions?.includes('network')"
                        type="button"
                        @click.stop="handleCheckHealth(plugin.manifest.id)"
                        :disabled="pluginStore.getPluginHealth(plugin.manifest.id).status === 'checking'"
                        class="px-1.5 py-0.5 rounded border text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        :class="{
                          'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60': pluginStore.getPluginHealth(plugin.manifest.id).status === 'healthy',
                          'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60 hover:bg-red-100 dark:hover:bg-red-900/60': pluginStore.getPluginHealth(plugin.manifest.id).status === 'unhealthy',
                          'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700': pluginStore.getPluginHealth(plugin.manifest.id).status === 'unknown' || pluginStore.getPluginHealth(plugin.manifest.id).status === 'checking'
                        }"
                        :title="pluginStore.getPluginHealth(plugin.manifest.id).message || '點擊檢測健康度'"
                      >
                        <span v-if="pluginStore.getPluginHealth(plugin.manifest.id).status === 'healthy'" class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <span v-else-if="pluginStore.getPluginHealth(plugin.manifest.id).status === 'unhealthy'" class="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                        <LoaderCircle v-else-if="pluginStore.getPluginHealth(plugin.manifest.id).status === 'checking'" class="w-2.5 h-2.5 animate-spin text-blue-500 shrink-0" />
                        <span v-else class="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>

                        <span>
                          {{
                            pluginStore.getPluginHealth(plugin.manifest.id).status === 'healthy'
                              ? (pluginStore.getPluginHealth(plugin.manifest.id).latencyMs !== undefined
                                  ? `連線正常 (${pluginStore.getPluginHealth(plugin.manifest.id).latencyMs}ms)`
                                  : '連線正常')
                              : pluginStore.getPluginHealth(plugin.manifest.id).status === 'unhealthy'
                              ? '服務異常'
                              : pluginStore.getPluginHealth(plugin.manifest.id).status === 'checking'
                              ? '檢測中...'
                              : '檢測連線'
                          }}
                        </span>
                      </button>
                    </div>

                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        @click="handleDeletePlugin(plugin)"
                        :title="$t('plugins.uninstall')"
                        class="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- TAB 2: MARKETPLACE STORE -->
            <div v-else class="space-y-4">
              <!-- Marketplace List -->
              <div v-if="filteredMarketplacePlugins.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div
                  v-for="item in filteredMarketplacePlugins"
                  :key="item.id"
                  class="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-800/80 flex flex-col justify-between shadow-xs transition-all duration-200 group hover:border-blue-300 dark:hover:border-blue-700"
                >
                  <!-- Card Top: Info -->
                  <div>
                    <div class="flex items-start justify-between gap-2.5 mb-2">
                      <div
                        @click="openPluginDetail(item)"
                        class="flex items-center gap-2.5 min-w-0 cursor-pointer"
                        title="點擊查看詳細說明與致謝"
                      >
                        <div class="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold shrink-0 group-hover:scale-105 transition-transform">
                          <Puzzle class="w-4 h-4" />
                        </div>
                        <div class="min-w-0">
                          <h4 class="text-sm font-bold text-slate-900 dark:text-slate-100 truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors" :title="item.name">
                            {{ item.name }}
                          </h4>
                          <p class="text-[11px] text-slate-400 font-mono">
                            v{{ item.version }}
                            <span v-if="item.author">• by {{ item.author }}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <!-- Description -->
                    <p
                      @click="openPluginDetail(item)"
                      class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3 line-clamp-2 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      {{ item.description || '無描述' }}
                    </p>

                    <!-- Permissions & Features Badges -->
                    <div class="flex flex-wrap items-center gap-1.5 mb-3 text-[10.5px]">
                      <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 font-mono">
                        {{ item.type }}
                      </span>
                      <span v-if="item.permissions?.includes('network')" class="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 flex items-center gap-1">
                        <ShieldCheck class="w-3 h-3" />
                        {{ $t('plugins.permNetwork') }}
                      </span>
                      <span v-if="item.options?.length" class="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 flex items-center gap-1">
                        <Layers class="w-3 h-3" />
                        {{ item.options.length }} {{ $t('plugins.optionsCount') }}
                      </span>
                    </div>
                  </div>

                  <!-- Card Bottom: Actions -->
                  <div class="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      @click="openPluginDetail(item)"
                      class="text-slate-400 hover:text-blue-500 text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                      title="查看詳細說明"
                    >
                      <BookOpen class="w-3 h-3" />
                      <span>{{ item.id }}</span>
                    </button>

                    <div>
                      <button
                        v-if="installingMap[item.id]"
                        type="button"
                        disabled
                        class="px-3 py-1.5 rounded-lg bg-blue-500/80 text-white text-xs font-medium flex items-center gap-1.5 cursor-not-allowed"
                      >
                        <LoaderCircle class="w-3.5 h-3.5 animate-spin" />
                        <span>安裝中...</span>
                      </button>

                      <button
                        v-else-if="pluginStore.getPlugin(item.id)"
                        type="button"
                        @click="openPluginDetail(item)"
                        class="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
                        title="點擊查看詳細說明"
                      >
                        <Check class="w-3.5 h-3.5 text-emerald-600" />
                        <span>已安裝</span>
                      </button>

                      <button
                        v-else
                        type="button"
                        @click="handleInstallMarketplace(item)"
                        class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer transition-colors shadow-xs flex items-center gap-1"
                      >
                        <Download class="w-3.5 h-3.5" />
                        <span>{{ $t('plugins.install') }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="flex flex-col items-center justify-center py-12 text-center">
                <div class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                  <ShoppingBag class="w-7 h-7" />
                </div>
                <h3 class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {{ $t('plugins.storeComingSoon') }}
                </h3>
                <p class="text-xs text-slate-400 max-w-md leading-relaxed">
                  {{ $t('plugins.storeComingSoonDesc') }}
                </p>
              </div>
            </div>
          </div>
        </template>

        <!-- Modal Footer Note -->
        <footer class="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <div class="flex items-center gap-1.5">
            <ShieldCheck class="w-4 h-4 text-emerald-500" />
            <span>{{ $t('plugins.securityNotice') }}</span>
          </div>
          <button
            type="button"
            @click="close"
            class="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium cursor-pointer"
          >
            {{ $t('plugins.close') }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
:deep(.plugin-markdown-content) {
  line-height: 1.65;
}
:deep(.plugin-markdown-content h1) {
  font-size: 1.15rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}
:deep(.plugin-markdown-content h2) {
  font-size: 1rem;
  font-weight: 700;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
}
:deep(.plugin-markdown-content h3) {
  font-size: 0.875rem;
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.4rem;
}
:deep(.plugin-markdown-content p) {
  margin-bottom: 0.75rem;
}
:deep(.plugin-markdown-content ul) {
  list-style-type: disc;
  padding-left: 1.25rem;
  margin-bottom: 0.75rem;
}
:deep(.plugin-markdown-content li) {
  margin-bottom: 0.25rem;
}
:deep(.plugin-markdown-content table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: 0.75rem;
}
:deep(.plugin-markdown-content th),
:deep(.plugin-markdown-content td) {
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
}
:deep(.plugin-markdown-content th) {
  background-color: rgba(148, 163, 184, 0.08);
  font-weight: 600;
  text-align: left;
}
:deep(.plugin-markdown-content code) {
  padding: 0.15rem 0.35rem;
  border-radius: 0.35rem;
  background-color: rgba(148, 163, 184, 0.15);
  font-family: monospace;
  font-size: 0.75rem;
}
:deep(.plugin-markdown-content hr) {
  margin: 1.25rem 0;
  border: 0;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}
:deep(.plugin-markdown-content a) {
  color: #3b82f6;
  text-decoration: underline;
}
</style>
