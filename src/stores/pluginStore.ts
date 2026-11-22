import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import JSZip from 'jszip'
import { BUILTIN_PLUGINS } from '../services/builtinPlugins'
import { desktop } from '../services/desktop'
import { resetPluginSandbox } from '../services/pluginRunner'
import i18n from '../i18n'

const t = (key: string, params?: Record<string, unknown>) => i18n.global.t(key, params ?? {}) as string

interface ParsedPluginPackage {
  manifest: PluginManifest
  code: string
  readme?: string
}

function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split(/[.-]/).map(n => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split(/[.-]/).map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

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
  /** Optional hex SHA-256 of the package; verified before install when present. */
  sha256?: string
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
      throw new Error(t('plugins.errInvalidManifest'))
    }

    installedPlugins.value[manifest.id] = {
      manifest,
      code,
      readme,
      enabled: true,
      isBuiltin: false,
      installedAt: Date.now()
    }
    resetPluginSandbox(manifest.id)
    savePlugins()
  }

  async function parsePluginZip(file: File | ArrayBuffer | Uint8Array): Promise<ParsedPluginPackage> {
    const zip = new JSZip()
    const content = await zip.loadAsync(file)

    const manifestFile = content.file('manifest.json') || content.file(/.*manifest\.json$/i)[0]
    if (!manifestFile) {
      throw new Error(t('plugins.errNoManifest'))
    }

    let manifest: PluginManifest
    try {
      manifest = JSON.parse(await manifestFile.async('text'))
    } catch {
      throw new Error(t('plugins.errManifestJson'))
    }
    if (!manifest?.id || !manifest?.name || !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(manifest.id)) {
      throw new Error(t('plugins.errInvalidManifest'))
    }

    const entryFilename = manifest.entry || 'index.js'
    const codeFile = content.file(entryFilename) || content.file(/.*index\.js$/i)[0]
    if (!codeFile) {
      throw new Error(t('plugins.errNoEntry', { entry: entryFilename }))
    }
    const code = await codeFile.async('text')

    const readmeFile = content.file('README.md') || content.file(/.*README\.md$/i)[0]
    let readme: string | undefined
    if (readmeFile) {
      try {
        readme = await readmeFile.async('text')
      } catch (e) {
        console.warn('Failed to parse README.md from plugin package:', e)
      }
    }
    return { manifest, code, readme }
  }

  /**
   * Ask the user before installing: shows the permissions the plugin wants and
   * warns when it replaces an installed plugin with the same id.
   */
  async function confirmInstall(manifest: PluginManifest): Promise<boolean> {
    const permissions = manifest.permissions || []
    const lines = [t('plugins.confirmInstallIntro', { name: manifest.name, version: manifest.version || '?' })]
    if (manifest.author) lines.push(t('plugins.confirmInstallAuthor', { author: manifest.author }))
    lines.push('')
    if (permissions.length === 0) {
      lines.push(t('plugins.confirmNoPermissions'))
    } else {
      lines.push(t('plugins.confirmPermissionsTitle'))
      for (const perm of permissions) {
        const key = perm === 'network' ? 'plugins.permNetworkDesc' : perm === 'filesystem' ? 'plugins.permFilesystemDesc' : ''
        lines.push(`• ${key ? t(key) : perm}`)
      }
    }
    const existing = installedPlugins.value[manifest.id]
    if (existing) {
      lines.push('')
      lines.push(t('plugins.confirmReplace', { version: existing.manifest.version || '?' }))
    }
    lines.push('')
    lines.push(t('plugins.confirmTrust'))
    return desktop.confirmDialog(lines.join('\n'), {
      title: t('plugins.confirmInstallTitle'),
      okLabel: t('plugins.install'),
      cancelLabel: t('common.cancel'),
      kind: permissions.length > 0 ? 'warning' : 'info',
    })
  }

  /** Install from a package. Returns null when the user cancels. */
  async function installPluginFromZip(file: File | ArrayBuffer | Uint8Array): Promise<PluginManifest | null> {
    const parsed = await parsePluginZip(file)
    if (!(await confirmInstall(parsed.manifest))) return null
    installPluginFromManifestAndCode(parsed.manifest, parsed.code, parsed.readme)
    return parsed.manifest
  }

  function uninstallPlugin(id: string) {
    if (installedPlugins.value[id]) {
      delete installedPlugins.value[id]
      resetPluginSandbox(id)
      savePlugins()
    }
  }

  async function exportPluginAsZip(id: string): Promise<Blob> {
    const plugin = installedPlugins.value[id]
    if (!plugin) throw new Error('Plugin not found')

    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify(plugin.manifest, null, 2))
    zip.file(plugin.manifest.entry || 'index.js', plugin.code)
    if (plugin.readme) zip.file('README.md', plugin.readme)

    return await zip.generateAsync({ type: 'blob' })
  }

  async function sha256Hex(bytes: Uint8Array): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async function installPluginFromUrl(url: string, expectedSha256?: string): Promise<PluginManifest | null> {
    const bytes = await desktop.fetchRemoteBytes(url)
    if (expectedSha256) {
      const actual = await sha256Hex(bytes)
      if (actual.toLowerCase() !== expectedSha256.trim().toLowerCase()) {
        throw new Error(t('plugins.errChecksum'))
      }
    }
    return await installPluginFromZip(bytes)
  }

  async function fetchRemoteText(url: string): Promise<string> {
    return desktop.fetchRemoteText(url)
  }

  /** True when the marketplace lists a newer version than the installed one. */
  function hasUpdate(id: string): boolean {
    const installed = installedPlugins.value[id]
    const remote = marketplacePlugins.value.find(p => p.id === id)
    if (!installed || !remote?.version) return false
    return compareVersions(remote.version, installed.manifest.version || '0') > 0
  }

  async function fetchMarketplacePlugins(customRepoUrl?: string) {
    const url = customRepoUrl || marketplaceRepoUrl.value
    isFetchingMarketplace.value = true
    marketplaceError.value = null

    try {
      const data = JSON.parse(await desktop.fetchRemoteText(url))
      if (Array.isArray(data)) {
        marketplacePlugins.value = data
      } else if (data && Array.isArray(data.plugins)) {
        marketplacePlugins.value = data.plugins
      } else {
        marketplacePlugins.value = []
      }
    } catch (err: any) {
      console.warn('Marketplace index unavailable:', err)
      marketplaceError.value = t('plugins.errMarketplace', { detail: err?.message || String(err) })
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
    fetchRemoteText,
    hasUpdate,
    uninstallPlugin,
    exportPluginAsZip,
    fetchMarketplacePlugins
  }
})
