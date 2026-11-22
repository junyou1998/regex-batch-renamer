/**
 * Demo / screenshot mode (`pnpm demo`).
 *
 * Runs the real UI in a normal browser with an in-memory file system instead
 * of the Tauri backend, so flows can be checked and screenshots taken with a
 * predictable set of files. Never included in production builds: the bridge is
 * only selected when VITE_DEMO_MODE is '1' at build time.
 */
import type {
  AiChatRequest,
  AiChatResponse,
  CopyConflictPolicy,
  DesktopBridge,
  FileOperationRequest,
  FileOperationResult,
} from '../services/desktop/types'

const DEMO_DIR = '/Users/demo/Pictures/Tokyo 2026'
const DOCS_DIR = '/Users/demo/Documents/Project Phoenix'

export const DEMO_FILE_SETS: Record<string, string[]> = {
  photos: [
    'IMG_20260812_093015.jpg',
    'IMG_20260812_101244.jpg',
    'IMG_20260812_143022.jpg',
    'IMG_20260813_080511.jpg',
    'IMG_20260813_121907.jpg',
    'IMG_20260813_190233.jpg',
    'IMG_20260814_071840.jpg',
    'IMG_20260814_133356.jpg',
    'IMG_20260814_202718.jpg',
    'IMG_20260815_110402.jpg',
    'IMG_20260815_164530.jpg',
    'IMG_20260816_095911.jpg',
  ].map(name => `${DEMO_DIR}/${name}`),
  docs: [
    'final_report_v2 (1).docx',
    'Final Report v3 FINAL.docx',
    'meeting notes  2026-03-04.txt',
    'budget_draft_COPY.xlsx',
    'Budget Draft (edited).xlsx',
    'presentation   final   final.pptx',
    'scan0001.pdf',
    'scan0002.pdf',
    'scan0003.pdf',
  ].map(name => `${DOCS_DIR}/${name}`),
}

const disk = new Set<string>([...DEMO_FILE_SETS.photos, ...DEMO_FILE_SETS.docs, `${DEMO_DIR}/cover.jpg`])

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const key = (p: string) => p.toLowerCase()

function existsOnDisk(path: string) {
  const k = key(path)
  for (const p of disk) if (key(p) === k) return true
  return false
}

function demoRename(files: FileOperationRequest[]): FileOperationResult[] {
  const results: FileOperationResult[] = []
  const counts = new Map<string, number>()
  files.forEach(f => counts.set(key(f.newPath), (counts.get(key(f.newPath)) || 0) + 1))
  const moving = new Set(files.map(f => key(f.oldPath)))
  const planned: FileOperationRequest[] = []
  for (const f of files) {
    if (f.oldPath === f.newPath) {
      results.push({ path: f.oldPath, success: true, newPath: f.newPath })
    } else if ((counts.get(key(f.newPath)) || 0) > 1) {
      results.push({ path: f.oldPath, success: false, error: 'DUPLICATE_TARGET', code: 'DUPLICATE_TARGET' })
    } else if (existsOnDisk(f.newPath) && !moving.has(key(f.newPath)) && key(f.newPath) !== key(f.oldPath)) {
      results.push({ path: f.oldPath, success: false, error: 'FILE_EXISTS', code: 'FILE_EXISTS' })
    } else {
      planned.push(f)
      results.push({ path: f.oldPath, success: true, newPath: f.newPath })
    }
  }
  planned.forEach(f => disk.delete(f.oldPath))
  planned.forEach(f => disk.add(f.newPath))
  return results
}

function demoCopy(files: FileOperationRequest[], policy: CopyConflictPolicy): FileOperationResult[] {
  return files.map(f => {
    let target = f.newPath
    let n = 0
    while (existsOnDisk(target)) {
      if (policy === 'skip') return { path: f.oldPath, success: false, error: 'FILE_EXISTS', code: 'FILE_EXISTS' }
      n += 1
      target = f.newPath.replace(/(\.[^./]+)?$/, ext => ` (${n})${ext}`)
    }
    disk.add(target)
    return { path: f.oldPath, success: true, newPath: target }
  })
}

function demoAiResponse(request: AiChatRequest): AiChatResponse {
  const zh = /[一-鿿]/.test(request.prompt)
  if (request.sampleFilenames.some(n => /^IMG_\d{8}_\d{6}/.test(n))) {
    return {
      reply: zh
        ? '我把相機檔名中的拍攝日期整理成 `YYYY-MM-DD`，並在後面加上地點與三位數流水號，副檔名會自動保留。'
        : 'I turned the camera timestamp into a `YYYY-MM-DD` date, then added the place and a 3-digit sequence. Extensions are kept automatically.',
      explanation: zh
        ? '步驟 1：`IMG_(\\d{4})(\\d{2})(\\d{2})_\\d{6}` 擷取年、月、日並改寫成 `$1-$2-$3`。\n步驟 2：在結尾加上 ` Tokyo ${n:3}`，產生 001、002…'
        : 'Step 1: `IMG_(\\d{4})(\\d{2})(\\d{2})_\\d{6}` captures year, month and day and rewrites them as `$1-$2-$3`.\nStep 2: appends ` Tokyo ${n:3}` to produce 001, 002…',
      pipeline: [
        { type: 'regex', params: { pattern: 'IMG_(\\d{4})(\\d{2})(\\d{2})_\\d{6}', replacement: '$1-$2-$3', useRegex: true } },
        { type: 'regex', params: { pattern: '$', replacement: ' Tokyo ${n:3}', useRegex: true } },
      ],
      usage: { inputTokens: 1284, outputTokens: 212 },
      model: 'claude-opus-5-5',
    }
  }
  return {
    reply: zh
      ? '我移除了「final」「copy」「(1)」這類版本雜訊，把多個空白合併成一個，並統一用底線分隔。'
      : 'I removed version noise like "final", "copy" and "(1)", collapsed repeated spaces, and used underscores consistently.',
    pipeline: [
      { type: 'regex', params: { pattern: '\\s*\\(\\d+\\)|\\s*\\((edited)\\)|[_ ]?(final|copy)\\b', replacement: '', useRegex: true, caseInsensitive: true } },
      { type: 'regex', params: { pattern: '\\s+', replacement: '_', useRegex: true } },
    ],
    usage: { inputTokens: 1102, outputTokens: 188 },
    model: 'claude-opus-5-5',
  }
}

const secrets = new Set<string>()

export const demoDesktopBridge: DesktopBridge = {
  async selectFiles() {
    return DEMO_FILE_SETS.photos
  },
  async selectDirectory(purpose) {
    return purpose === 'destination' ? '/Users/demo/Desktop/Export' : DEMO_DIR
  },
  async selectFolderContents() {
    return DEMO_FILE_SETS.docs
  },
  async selectFolderAsItem() {
    return ['/Users/demo/Pictures/Tokyo 2026']
  },
  async renameFiles(files) {
    await sleep(250)
    return demoRename(files)
  },
  async copyRenameFiles(files, onConflict = 'skip') {
    await sleep(250)
    return demoCopy(files, onConflict)
  },
  async readFileBinary() {
    return new Uint8Array()
  },
  async getFileMetadata() {
    return { size: 2_400_000, createdAtMs: Date.UTC(2026, 7, 12), modifiedAtMs: Date.UTC(2026, 7, 12), isFile: true, isDir: false }
  },
  async pluginHttpRequest() {
    return { status: 503, statusText: 'Demo mode', body: '{}' }
  },
  async fetchRemoteText(url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP_${res.status}`)
    return res.text()
  },
  async fetchRemoteBytes(url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP_${res.status}`)
    return new Uint8Array(await res.arrayBuffer())
  },
  async confirmDialog(message) {
    return window.confirm(message)
  },
  async openExternal(url) {
    window.open(url, '_blank', 'noopener')
  },
  setZoomFactor(factor) {
    document.documentElement.style.zoom = String(factor)
  },
  async getRuntimeInfo() {
    return { platform: 'darwin', runtime: 'tauri', channel: 'stable', version: '0.8.0' }
  },
  setPendingChangesHandler() {},
  clearPendingChangesHandler() {},
  async checkAiCliStatus(provider) {
    return { installed: true, ready: true, version: provider === 'codex' ? 'codex-cli 0.171.0' : '2.1.330 (Claude Code)', provider }
  },
  async runAiChat(request) {
    await sleep(1400)
    return demoAiResponse(request)
  },
  async runAiApiChat(request) {
    await sleep(1400)
    return demoAiResponse(request)
  },
  async testAiApiConnection(profile) {
    return { success: true, message: `AI_TEST_OK|${profile.model || 'claude-opus-5-5'}`, models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] }
  },
  async listAiModels(profile) {
    await sleep(400)
    if (profile.provider === 'gemini') {
      return ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview',
        'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest',
        'gemini-flash-lite-latest', 'gemini-pro-latest', 'gemma-4-31b-it', 'gemma-4-26b-a4b-it']
    }
    return ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']
  },
  async cancelAiChat() {
    return true
  },
  async setAiSecret(id) {
    secrets.add(id)
  },
  async deleteAiSecret(id) {
    secrets.delete(id)
  },
  async listAiSecretIds() {
    return [...secrets]
  },
  async saveTextFile() {
    return '/Users/demo/Desktop/history.json'
  },
}

/** `?demo=photos|docs` preloads a file set so a screenshot can be taken immediately. */
export function demoInitialFiles(): string[] {
  const set = new URLSearchParams(window.location.search).get('demo')
  return set && DEMO_FILE_SETS[set] ? DEMO_FILE_SETS[set] : []
}
