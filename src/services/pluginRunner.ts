import { usePluginStore, type PluginHealthState } from '../stores/pluginStore'

interface CacheEntry {
  value: any
  expireAt: number
}

const memoryCache = new Map<string, CacheEntry>()

export const pluginCache = {
  get(key: string): any {
    const entry = memoryCache.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expireAt) {
      memoryCache.delete(key)
      return undefined
    }
    return entry.value
  },
  set(key: string, value: any, ttlMs: number = 300000) {
    memoryCache.set(key, {
      value,
      expireAt: Date.now() + ttlMs
    })
  },
  clear() {
    memoryCache.clear()
  }
}

export function createPluginContext() {
  return {
    cache: pluginCache,
    async httpPost(url: string, body: any, headers: Record<string, string> = {}) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: typeof body === 'string' ? body : JSON.stringify(body)
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      return await response.json()
    },
    async httpGet(url: string, params: Record<string, string> = {}, headers: Record<string, string> = {}) {
      const u = new URL(url)
      Object.entries(params).forEach(([k, v]) => u.searchParams.append(k, v))
      const response = await fetch(u.toString(), {
        method: 'GET',
        headers
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      return await response.json()
    }
  }
}

// Instantiate plugin object from code (supports ESM, IIFE, CJS, and Object literal returns)
function evaluatePluginCode(code: string): any {
  let executableCode = code.trim()

  // 1. Support ESM "export { identifier as default }"
  executableCode = executableCode.replace(/export\s*\{\s*([a-zA-Z0-9_$]+)\s*as\s*default\s*\}\s*;?/g, 'return $1;')

  // 2. Support ESM "export default identifier"
  executableCode = executableCode.replace(/export\s+default\s+([a-zA-Z0-9_$]+)\s*;?/g, 'return $1;')

  // 3. Support ESM "export default { ... }" or direct expressions
  if (executableCode.startsWith('export default')) {
    executableCode = executableCode.replace('export default', 'return')
  } else if (executableCode.includes('export default')) {
    executableCode = 'let __default__;\n' + executableCode.replace('export default', '__default__ =') + '\nreturn __default__;'
  }

  try {
    const codeBody = `"use strict";
var __rbr_plugin__;
const module = { exports: {} };
const exports = module.exports;
${executableCode}
if (typeof __rbr_plugin__ !== 'undefined' && __rbr_plugin__) {
  return __rbr_plugin__.default || __rbr_plugin__;
}
return module.exports?.default || module.exports;`
    const factory = new Function('context', codeBody)
    const instance = factory(createPluginContext())
    return instance
  } catch (err) {
    console.error('[PluginRunner] Failed to instantiate plugin code:', err)
    return null
  }
}

const pluginInstanceCache = new Map<string, { code: string; instance: any }>()

function getPluginInstance(pluginId: string): any {
  const pluginStore = usePluginStore()
  const plugin = pluginStore.getPlugin(pluginId)
  if (!plugin || !plugin.enabled) return null

  const cached = pluginInstanceCache.get(pluginId)
  if (cached && cached.code === plugin.code) {
    return cached.instance
  }

  const instance = evaluatePluginCode(plugin.code)
  if (instance) {
    pluginInstanceCache.set(pluginId, { code: plugin.code, instance })
  }
  return instance
}

/**
 * Execute single-item transform
 */
export async function runPluginTransform(
  pluginId: string,
  input: string,
  params: Record<string, any>
): Promise<string> {
  const pluginStore = usePluginStore()
  const instance = getPluginInstance(pluginId)
  if (!instance || typeof instance.transform !== 'function') {
    return input
  }

  const ctx = createPluginContext()
  pluginStore.setPluginStatus(pluginId, { isBusy: true, lastError: undefined })
  try {
    const result = await instance.transform(input, params, ctx)
    pluginStore.setPluginStatus(pluginId, { isBusy: false, lastSuccessAt: Date.now() })
    return typeof result === 'string' ? result : input
  } catch (err: any) {
    console.warn(`[Plugin:${pluginId}] transform error:`, err)
    pluginStore.setPluginStatus(pluginId, { isBusy: false, lastError: err?.message || String(err) })
    return input
  }
}

/**
 * Execute batch transform (fast path if plugin supports transformBatch)
 */
export async function runPluginTransformBatch(
  pluginId: string,
  inputs: string[],
  params: Record<string, any>
): Promise<string[]> {
  if (!inputs || inputs.length === 0) return inputs

  const pluginStore = usePluginStore()
  const instance = getPluginInstance(pluginId)
  if (!instance) return inputs

  const ctx = createPluginContext()
  pluginStore.setPluginStatus(pluginId, { isBusy: true, lastError: undefined })

  // Use transformBatch if implemented
  if (typeof instance.transformBatch === 'function') {
    try {
      const results = await instance.transformBatch(inputs, params, ctx)
      if (Array.isArray(results) && results.length === inputs.length) {
        pluginStore.setPluginStatus(pluginId, { isBusy: false, lastSuccessAt: Date.now() })
        return results
      }
    } catch (err: any) {
      console.warn(`[Plugin:${pluginId}] transformBatch error:`, err)
      pluginStore.setPluginStatus(pluginId, { isBusy: false, lastError: err?.message || String(err) })
    }
  }

  // Fallback to transform item-by-item
  if (typeof instance.transform === 'function') {
    try {
      const promises = inputs.map(input =>
        instance.transform(input, params, ctx).catch((err: any) => {
          console.warn(`[Plugin:${pluginId}] transform item error:`, err)
          return input
        })
      )
      const results = await Promise.all(promises)
      pluginStore.setPluginStatus(pluginId, { isBusy: false, lastSuccessAt: Date.now() })
      return results
    } catch (err: any) {
      console.warn(`[Plugin:${pluginId}] transform item fallback error:`, err)
      pluginStore.setPluginStatus(pluginId, { isBusy: false, lastError: err?.message || String(err) })
      return inputs
    }
  }

  pluginStore.setPluginStatus(pluginId, { isBusy: false })
  return inputs
}

/**
 * Execute health check on a plugin
 */
export async function runPluginHealthCheck(pluginId: string): Promise<PluginHealthState> {
  const pluginStore = usePluginStore()
  const plugin = pluginStore.getPlugin(pluginId)
  if (!plugin) {
    const res: PluginHealthState = { status: 'unhealthy', message: '外掛未安裝', lastCheckedAt: Date.now() }
    pluginStore.setPluginHealth(pluginId, res)
    return res
  }

  pluginStore.setPluginHealth(pluginId, { status: 'checking', lastCheckedAt: Date.now() })

  const instance = getPluginInstance(pluginId)
  if (!instance) {
    const res: PluginHealthState = { status: 'unhealthy', message: '外掛載入失敗', lastCheckedAt: Date.now() }
    pluginStore.setPluginHealth(pluginId, res)
    return res
  }

  // If plugin defines healthCheck method, execute it with latency measurement
  if (typeof instance.healthCheck === 'function') {
    const ctx = createPluginContext()
    const start = performance.now()
    try {
      const res = await instance.healthCheck(ctx)
      const latencyMs = Math.round(performance.now() - start)
      const isOk = typeof res === 'boolean' ? res : Boolean(res?.ok)
      const message = typeof res === 'object' && res?.message ? res.message : (isOk ? '服務連線正常' : '服務連線異常')

      const result: PluginHealthState = {
        status: isOk ? 'healthy' : 'unhealthy',
        message,
        latencyMs,
        lastCheckedAt: Date.now()
      }
      pluginStore.setPluginHealth(pluginId, result)
      return result
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start)
      const result: PluginHealthState = {
        status: 'unhealthy',
        message: err?.message || '健康檢查連線失敗',
        latencyMs,
        lastCheckedAt: Date.now()
      }
      pluginStore.setPluginHealth(pluginId, result)
      return result
    }
  }

  // Fallback: pure local plugins without network permissions are always healthy
  const hasNetwork = plugin.manifest.permissions?.includes('network')
  const result: PluginHealthState = {
    status: 'healthy',
    message: hasNetwork ? '外掛就緒 (未提供自訂健康端點)' : '純本地轉換器運作正常',
    latencyMs: 0,
    lastCheckedAt: Date.now()
  }
  pluginStore.setPluginHealth(pluginId, result)
  return result
}
