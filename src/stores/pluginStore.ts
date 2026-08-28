import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import JSZip from 'jszip'
import { BUILTIN_PLUGINS } from '../services/builtinPlugins'

export type PluginOptionType = 'select' | 'boolean' | 'string' | 'number'

export interface PluginOptionChoice {
  value: string | number
  label: string
  description?: string
}

export interface PluginOptionVariable {
  name: string
  description?: string
}

export interface PluginOption {
  key: string
  label: string
  type: PluginOptionType
  default?: any
  description?: string
  options?: PluginOptionChoice[] // For 'select' type
  variables?: PluginOptionVariable[] // Quick insertable variables
  min?: number // For 'number' type
  max?: number // For 'number' type
  step?: number // For 'number' type
}

export interface PluginManifest {
  id: string
  name: string
  version: string
  author?: string
  description?: string
  icon?: string // Lucide icon name or emoji
  type: 'transformer' | 'generator' | 'action'
  homepage?: string
  permissions?: string[]
  options?: PluginOption[]
  entry?: string
}

export interface InstalledPlugin {
  manifest: PluginManifest
  code: string
  readme?: string
  enabled: boolean
  isBuiltin?: boolean
  installedAt: number
}

export interface MarketplacePlugin {
  id: string
  name: string
  version: string
  author?: string
  description?: string
  icon?: string
  type: 'transformer' | 'generator' | 'action'
  downloadUrl?: string
  readmeUrl?: string
  homepage?: string
  permissions?: string[]
  stars?: number
  options?: PluginOption[]
}

export interface PluginHealthState {
  status: 'healthy' | 'unhealthy' | 'checking' | 'unknown'
  message?: string
  latencyMs?: number
  lastCheckedAt?: number
}

const STORAGE_KEY = 'regex_batch_renamer_plugins'

export const usePluginStore = defineStore('plugin', () => {
  const installedPlugins = ref<Record<string, InstalledPlugin>>({})
  const marketplacePlugins = ref<MarketplacePlugin[]>([])
  const marketplaceRepoUrl = ref<string>('https://raw.githubusercontent.com/junyou1998/regex-batch-renamer-plugins/main/dist/index.json')
  const isFetchingMarketplace = ref<boolean>(false)
  const marketplaceError = ref<string | null>(null)
  const healthMap = ref<Record<string, PluginHealthState>>({})

  // Initialize and load saved plugins + ensure builtins are registered
  function initPlugins() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        installedPlugins.value = JSON.parse(saved)
      }
    } catch (e) {
      console.error('Failed to load plugins from storage:', e)
    }

    // Merge/Register Builtin plugins if not already present or update their manifest/code
    for (const [id, builtin] of Object.entries(BUILTIN_PLUGINS)) {
      if (!installedPlugins.value[id]) {
        installedPlugins.value[id] = { ...builtin }
      } else {
        installedPlugins.value[id].manifest = builtin.manifest
        installedPlugins.value[id].code = builtin.code
        installedPlugins.value[id].readme = builtin.readme
        installedPlugins.value[id].isBuiltin = true
      }
    }
  }

  function savePlugins() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(installedPlugins.value))
    } catch (e) {
      console.error('Failed to save plugins to storage:', e)
    }
  }

  const statusMap = ref<Record<string, { isBusy: boolean; lastError?: string; lastSuccessAt?: number }>>({})

  function setPluginStatus(pluginId: string, status: { isBusy: boolean; lastError?: string; lastSuccessAt?: number }) {
    statusMap.value[pluginId] = {
      ...(statusMap.value[pluginId] || { isBusy: false }),
      ...status
    }
  }

  function getPluginStatus(pluginId: string) {
    return statusMap.value[pluginId] || { isBusy: false }
  }

  function setPluginHealth(pluginId: string, health: PluginHealthState) {
    healthMap.value[pluginId] = health
  }

  function getPluginHealth(pluginId: string): PluginHealthState {
    return healthMap.value[pluginId] || { status: 'unknown' }
  }

  const isAnyPluginBusy = computed(() => {
    return Object.values(statusMap.value).some(s => s.isBusy)
  })

  const pluginList = computed<InstalledPlugin[]>(() => {
    return Object.values(installedPlugins.value)
  })

  const enabledTransformerPlugins = computed<InstalledPlugin[]>(() => {
    return pluginList.value.filter(p => p.enabled && p.manifest.type === 'transformer')
  })

  function getPlugin(id: string): InstalledPlugin | undefined {
    return installedPlugins.value[id]
  }

  function togglePlugin(id: string) {
    if (installedPlugins.value[id]) {
      installedPlugins.value[id].enabled = !installedPlugins.value[id].enabled
      savePlugins()
    }
  }

  function installPluginFromManifestAndCode(manifest: PluginManifest, code: string, readme?: string) {
    if (!manifest.id || !manifest.name) {
      throw new Error('Invalid manifest: id and name are required')
    }

    installedPlugins.value[manifest.id] = {
      manifest,
      code,
      readme,
      enabled: true,
      isBuiltin: false,
      installedAt: Date.now()
    }
    savePlugins()
  }

  async function installPluginFromZip(file: File | ArrayBuffer): Promise<PluginManifest> {
    const zip = new JSZip()
    const content = await zip.loadAsync(file)

    const manifestFile = content.file('manifest.json') || content.file(/.*manifest\.json$/i)[0]
    if (!manifestFile) {
      throw new Error('未在插件壓縮包中找到 manifest.json 描述檔')
    }

    const manifestText = await manifestFile.async('text')
    let manifest: PluginManifest
    try {
      manifest = JSON.parse(manifestText)
    } catch (e) {
      throw new Error('manifest.json 格式錯誤，非有效 JSON')
    }

    const entryFilename = manifest.entry || 'index.js'
    const codeFile = content.file(entryFilename) || content.file(/.*index\.js$/i)[0]
    if (!codeFile) {
      throw new Error(`未找到插件入口執行腳本 (${entryFilename})`)
    }

    const code = await codeFile.async('text')

    const readmeFile = content.file('README.md') || content.file(/.*README\.md$/i)[0]
    let readme: string | undefined = undefined
    if (readmeFile) {
      try {
        readme = await readmeFile.async('text')
      } catch (e) {
        console.warn('Failed to parse README.md from plugin package:', e)
      }
    }

    installPluginFromManifestAndCode(manifest, code, readme)
    return manifest
  }

  function uninstallPlugin(id: string) {
    if (installedPlugins.value[id]) {
      delete installedPlugins.value[id]
      savePlugins()
    }
  }

  async function exportPluginAsZip(id: string): Promise<Blob> {
    const plugin = installedPlugins.value[id]
    if (!plugin) throw new Error('Plugin not found')

    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify(plugin.manifest, null, 2))
    zip.file(plugin.manifest.entry || 'index.js', plugin.code)

    return await zip.generateAsync({ type: 'blob' })
  }

  async function installPluginFromUrl(url: string): Promise<PluginManifest> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`下載插件失敗 (HTTP ${response.status})`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return await installPluginFromZip(arrayBuffer)
  }

  // Placeholder store API to fetch remote marketplace index
  async function fetchMarketplacePlugins(customRepoUrl?: string) {
    const url = customRepoUrl || marketplaceRepoUrl.value
    isFetchingMarketplace.value = true
    marketplaceError.value = null

    try {
      const response = await fetch(url, { cache: 'no-cache' })
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`)
      }
      const data = await response.json()
      if (Array.isArray(data)) {
        marketplacePlugins.value = data
      } else if (data && Array.isArray(data.plugins)) {
        marketplacePlugins.value = data.plugins
      } else {
        marketplacePlugins.value = []
      }
    } catch (err: any) {
      console.warn('Marketplace store repo not available yet:', err)
      marketplaceError.value = err.message || '無法連線至插件市集倉庫'
      // Keep empty or mock placeholder list for preview
      marketplacePlugins.value = []
    } finally {
      isFetchingMarketplace.value = false
    }
  }

  // Auto initialize on store creation
  initPlugins()

  return {
    installedPlugins,
    marketplacePlugins,
    marketplaceRepoUrl,
    isFetchingMarketplace,
    marketplaceError,
    pluginList,
    enabledTransformerPlugins,
    statusMap,
    isAnyPluginBusy,
    getPluginStatus,
    setPluginStatus,
    healthMap,
    getPluginHealth,
    setPluginHealth,
    getPlugin,
    togglePlugin,
    installPluginFromManifestAndCode,
    installPluginFromZip,
    installPluginFromUrl,
    uninstallPlugin,
    exportPluginAsZip,
    fetchMarketplacePlugins
  }
})
