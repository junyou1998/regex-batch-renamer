import { usePluginStore, type PluginHealthState } from '../stores/pluginStore'
import { desktop } from './desktop'
import i18n from '../i18n'

/**
 * Plugin runtime.
 *
 * Each plugin runs in its own Web Worker created from a Blob. A worker has no
 * DOM, no localStorage and no access to the Tauri bridge, and the app's CSP
 * blocks it from opening network connections. The only way out is the
 * `context` object, whose calls are relayed here over postMessage and checked
 * against the permissions the plugin declared in its manifest:
 *
 * - `network`    -> context.httpGet / context.httpPost (public HTTPS only, via Rust)
 * - `filesystem` -> context.readBinaryFile / context.getFileMetadata
 *                   (only files the user loaded into the list, enforced in Rust)
 */

export interface PluginFileInfo {
  id?: string
  path: string
  originalName: string
  extension?: string
  size?: number
  index: number
  total?: number
}

const INVOKE_TIMEOUT_MS = 60_000
const CTX_MARKER = '__rbr_ctx__'

const t = (key: string, params?: Record<string, unknown>) => i18n.global.t(key, params ?? {}) as string

/** Rewrite ESM-style exports so the code can run as a function body. */
function toFunctionBody(code: string): string {
  let body = code.trim()
  body = body.replace(/export\s*\{\s*([a-zA-Z0-9_$]+)\s*as\s*default\s*\}\s*;?/g, 'return $1;')
  body = body.replace(/export\s+default\s+([a-zA-Z0-9_$]+)\s*;?\s*$/gm, 'return $1;')
  if (body.startsWith('export default')) {
    body = body.replace('export default', 'return')
  } else if (body.includes('export default')) {
    body = 'let __default__;\n' + body.replace('export default', '__default__ =') + '\nreturn __default__;'
  }
  return `"use strict";
var __rbr_plugin__;
const module = { exports: {} };
const exports = module.exports;
${body}
if (typeof __rbr_plugin__ !== 'undefined' && __rbr_plugin__) {
  return __rbr_plugin__.default || __rbr_plugin__;
}
return module.exports && (module.exports.default || module.exports);`
}

function buildWorkerSource(code: string): string {
  return `
const __pending = new Map();
let __seq = 0;
const __post = self.postMessage.bind(self);
function __call(method, args) {
  return new Promise((resolve, reject) => {
    const id = ++__seq;
    __pending.set(id, { resolve, reject });
    __post({ kind: 'rpc', id, method, args });
  });
}
const __cache = new Map();
const context = Object.freeze({
  cache: Object.freeze({
    get(key) {
      const entry = __cache.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expireAt) { __cache.delete(key); return undefined; }
      return entry.value;
    },
    set(key, value, ttlMs = 300000) { __cache.set(key, { value, expireAt: Date.now() + ttlMs }); },
    clear() { __cache.clear(); },
  }),
  httpGet(url, params = {}, headers = {}) { return __call('httpGet', [url, params, headers]); },
  httpPost(url, body, headers = {}) { return __call('httpPost', [url, body, headers]); },
  readBinaryFile(path, maxBytes) { return __call('readBinaryFile', [path, maxBytes]); },
  getFileMetadata(path) { return __call('getFileMetadata', [path]); },
});
// Defense in depth on top of the CSP: remove direct I/O primitives.
for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches', 'Worker', 'SharedWorker']) {
  try { Object.defineProperty(self, name, { value: undefined, configurable: false, writable: false }); } catch (_) {}
}
let __instance = null;
let __loadError = null;
try {
  __instance = (function (context) {
${toFunctionBody(code)}
  })(context);
} catch (err) {
  __loadError = (err && err.message) || String(err);
}
self.onmessage = async (event) => {
  const msg = event.data || {};
  if (msg.kind === 'rpc-result') {
    const entry = __pending.get(msg.id);
    if (!entry) return;
    __pending.delete(msg.id);
    if (msg.error !== undefined) entry.reject(new Error(msg.error)); else entry.resolve(msg.value);
    return;
  }
  if (msg.kind !== 'invoke') return;
  if (__loadError || !__instance) {
    __post({ kind: 'result', id: msg.id, error: __loadError || 'PLUGIN_LOAD_FAILED' });
    return;
  }
  const fn = __instance[msg.fn];
  if (typeof fn !== 'function') {
    __post({ kind: 'result', id: msg.id, missing: true });
    return;
  }
  try {
    const args = (msg.args || []).map((a) => (a === '${CTX_MARKER}' ? context : a));
    const value = await fn.apply(__instance, args);
    __post({ kind: 'result', id: msg.id, value });
  } catch (err) {
    __post({ kind: 'result', id: msg.id, error: (err && err.message) || String(err) });
  }
};
__post({ kind: 'ready', methods: __instance ? Object.keys(__instance).filter((k) => typeof __instance[k] === 'function') : [], error: __loadError });
`
}

interface InvokeOutcome<T> {
  value?: T
  missing?: boolean
}

class PluginSandbox {
  private worker: Worker
  private url: string
  private seq = 0
  private pending = new Map<number, { resolve: (v: InvokeOutcome<any>) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()
  readonly ready: Promise<{ methods: string[]; error?: string }>
  disposed = false

  constructor(readonly pluginId: string, readonly code: string, private permissions: string[]) {
    this.url = URL.createObjectURL(new Blob([buildWorkerSource(code)], { type: 'text/javascript' }))
    this.worker = new Worker(this.url, { name: `plugin:${pluginId}` })
    let resolveReady!: (v: { methods: string[]; error?: string }) => void
    this.ready = new Promise((resolve) => (resolveReady = resolve))

    this.worker.onmessage = (event: MessageEvent) => {
      const msg = event.data || {}
      if (msg.kind === 'ready') {
        resolveReady({ methods: msg.methods || [], error: msg.error || undefined })
      } else if (msg.kind === 'rpc') {
        void this.handleRpc(msg.id, msg.method, msg.args || [])
      } else if (msg.kind === 'result') {
        const entry = this.pending.get(msg.id)
        if (!entry) return
        clearTimeout(entry.timer)
        this.pending.delete(msg.id)
        if (msg.error !== undefined) entry.reject(new Error(msg.error))
        else entry.resolve({ value: msg.value, missing: Boolean(msg.missing) })
      }
    }
    this.worker.onerror = (event) => {
      resolveReady({ methods: [], error: event.message || 'PLUGIN_LOAD_FAILED' })
      event.preventDefault()
    }
  }

  private requirePermission(permission: string) {
    if (!this.permissions.includes(permission)) {
      throw new Error(t('plugins.permissionDenied', { permission }))
    }
  }

  private async handleRpc(id: number, method: string, args: any[]) {
    const reply = (payload: { value?: unknown; error?: string }, transfer: Transferable[] = []) => {
      if (!this.disposed) this.worker.postMessage({ kind: 'rpc-result', id, ...payload }, transfer)
    }
    try {
      switch (method) {
        case 'httpGet': {
          this.requirePermission('network')
          const [url, params, headers] = args
          const target = new URL(String(url))
          Object.entries(params || {}).forEach(([k, v]) => target.searchParams.append(k, String(v)))
          reply({ value: await this.http('GET', target.toString(), undefined, headers) })
          break
        }
        case 'httpPost': {
          this.requirePermission('network')
          const [url, body, headers] = args
          const payload = typeof body === 'string' ? body : JSON.stringify(body)
          reply({ value: await this.http('POST', String(url), payload, { 'Content-Type': 'application/json', ...(headers || {}) }) })
          break
        }
        case 'readBinaryFile': {
          this.requirePermission('filesystem')
          const bytes = await desktop.readFileBinary(String(args[0]), typeof args[1] === 'number' ? args[1] : undefined)
          reply({ value: bytes }, [bytes.buffer])
          break
        }
        case 'getFileMetadata': {
          this.requirePermission('filesystem')
          reply({ value: await desktop.getFileMetadata(String(args[0])) })
          break
        }
        default:
          throw new Error(`Unknown plugin API: ${method}`)
      }
    } catch (error: any) {
      reply({ error: error?.message || String(error) })
    }
  }

  private async http(method: 'GET' | 'POST', url: string, body: string | undefined, headers: Record<string, string> = {}) {
    const response = await desktop.pluginHttpRequest({ method, url, body, headers })
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    try {
      return JSON.parse(response.body)
    } catch {
      return response.body
    }
  }

  invoke<T>(fn: string, args: unknown[]): Promise<InvokeOutcome<T>> {
    if (this.disposed) return Promise.reject(new Error('PLUGIN_DISPOSED'))
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(t('plugins.timeout')))
        // A plugin stuck in a loop can't be interrupted; replace its worker.
        disposeSandbox(this.pluginId)
      }, INVOKE_TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timer })
      this.worker.postMessage({ kind: 'invoke', id, fn, args })
    })
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.worker.terminate()
    URL.revokeObjectURL(this.url)
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer)
      entry.reject(new Error('PLUGIN_DISPOSED'))
    }
    this.pending.clear()
  }
}

const sandboxes = new Map<string, PluginSandbox>()

function disposeSandbox(pluginId: string) {
  sandboxes.get(pluginId)?.dispose()
  sandboxes.delete(pluginId)
}

/** Drop every running plugin worker (e.g. after uninstall or update). */
export function resetPluginSandbox(pluginId?: string) {
  if (pluginId) {
    disposeSandbox(pluginId)
  } else {
    for (const id of [...sandboxes.keys()]) disposeSandbox(id)
  }
}

function getSandbox(pluginId: string): PluginSandbox | null {
  const pluginStore = usePluginStore()
  const plugin = pluginStore.getPlugin(pluginId)
  if (!plugin || !plugin.enabled) return null

  const existing = sandboxes.get(pluginId)
  if (existing && existing.code === plugin.code && !existing.disposed) return existing
  if (existing) disposeSandbox(pluginId)

  const sandbox = new PluginSandbox(pluginId, plugin.code, plugin.manifest.permissions || [])
  sandboxes.set(pluginId, sandbox)
  return sandbox
}

/** Plain, structured-clone-safe copy of plugin params (strips Vue proxies). */
function plain<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value))
}

export async function runPluginTransformBatch(
  pluginId: string,
  inputs: string[],
  params: Record<string, any>,
  fileInfos?: PluginFileInfo[]
): Promise<string[]> {
  if (!inputs || inputs.length === 0) return inputs

  const pluginStore = usePluginStore()
  const sandbox = getSandbox(pluginId)
  if (!sandbox) return inputs

  pluginStore.setPluginStatus(pluginId, { isBusy: true, lastError: undefined })
  const safeParams = plain(params)
  const safeInfos = plain(fileInfos)

  try {
    const ready = await sandbox.ready
    if (ready.error) throw new Error(ready.error)

    if (ready.methods.includes('transformBatch')) {
      const outcome = await sandbox.invoke<string[]>('transformBatch', [inputs, safeParams, CTX_MARKER, safeInfos])
      if (Array.isArray(outcome.value) && outcome.value.length === inputs.length) {
        pluginStore.setPluginStatus(pluginId, { isBusy: false, lastSuccessAt: Date.now() })
        return outcome.value.map((v, i) => (typeof v === 'string' ? v : inputs[i]))
      }
    }

    if (ready.methods.includes('transform')) {
      const results = await Promise.all(
        inputs.map(async (input, idx) => {
          try {
            const outcome = await sandbox.invoke<string>('transform', [input, safeParams, CTX_MARKER, safeInfos?.[idx]])
            return typeof outcome.value === 'string' ? outcome.value : input
          } catch (err) {
            console.warn(`[Plugin:${pluginId}] transform item error:`, err)
            return input
          }
        })
      )
      pluginStore.setPluginStatus(pluginId, { isBusy: false, lastSuccessAt: Date.now() })
      return results
    }

    pluginStore.setPluginStatus(pluginId, { isBusy: false })
    return inputs
  } catch (err: any) {
    console.warn(`[Plugin:${pluginId}] transform error:`, err)
    pluginStore.setPluginStatus(pluginId, { isBusy: false, lastError: err?.message || String(err) })
    return inputs
  }
}

export async function runPluginHealthCheck(pluginId: string): Promise<PluginHealthState> {
  const pluginStore = usePluginStore()
  const plugin = pluginStore.getPlugin(pluginId)
  const done = (result: PluginHealthState) => {
    pluginStore.setPluginHealth(pluginId, result)
    return result
  }

  if (!plugin) {
    return done({ status: 'unhealthy', message: t('plugins.healthNotInstalled'), lastCheckedAt: Date.now() })
  }

  pluginStore.setPluginHealth(pluginId, { status: 'checking', lastCheckedAt: Date.now() })
  const sandbox = getSandbox(pluginId)
  const ready = sandbox ? await sandbox.ready : { methods: [], error: 'disabled' }
  if (!sandbox || ready.error) {
    return done({ status: 'unhealthy', message: t('plugins.healthLoadFailed'), lastCheckedAt: Date.now() })
  }

  if (ready.methods.includes('healthCheck')) {
    const start = performance.now()
    try {
      const outcome = await sandbox.invoke<any>('healthCheck', [CTX_MARKER])
      const res = outcome.value
      const isOk = typeof res === 'boolean' ? res : Boolean(res?.ok)
      const message = typeof res === 'object' && res?.message ? String(res.message) : t(isOk ? 'plugins.healthOk' : 'plugins.healthFailed')
      return done({ status: isOk ? 'healthy' : 'unhealthy', message, latencyMs: Math.round(performance.now() - start), lastCheckedAt: Date.now() })
    } catch (err: any) {
      return done({
        status: 'unhealthy',
        message: err?.message || t('plugins.healthFailed'),
        latencyMs: Math.round(performance.now() - start),
        lastCheckedAt: Date.now(),
      })
    }
  }

  const hasNetwork = plugin.manifest.permissions?.includes('network')
  return done({
    status: 'healthy',
    message: t(hasNetwork ? 'plugins.healthReadyNoEndpoint' : 'plugins.healthLocalOk'),
    latencyMs: 0,
    lastCheckedAt: Date.now(),
  })
}
