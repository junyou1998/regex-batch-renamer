/**
 * Screenshot scenes for demo mode (`pnpm demo`).
 *
 *   /?scene=hero|docs|ai|plugins|history&lang=zh-TW|zh-CN|en-US&theme=light|dark&frame=1
 *
 * Each scene loads demo files, rules and UI state so README and website
 * screenshots can be regenerated with one command (see scripts/capture-screenshots.mjs).
 * `frame=1` draws a macOS-style window around the app.
 */
import { DEMO_FILE_SETS } from './demoBridge'

type Scene = 'hero' | 'docs' | 'ai' | 'plugins' | 'history'

function readParams() {
  const params = new URLSearchParams(window.location.search)
  return {
    params,
    scene: (params.get('scene') || '') as Scene | '',
    lang: params.get('lang') || 'zh-TW',
    theme: params.get('theme') || 'light',
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function waitFor<T>(fn: () => T | null | undefined, timeout = 5000): Promise<T | null> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const value = fn()
    if (value) return value
    await sleep(50)
  }
  return null
}

const place = (l: string) => (l === 'en-US' ? 'Tokyo' : l === 'zh-CN' ? '东京' : '東京')

const AI_PROMPTS: Record<string, string> = {
  'zh-TW': '把相機檔名改成「日期 + 地點 + 三位數流水號」',
  'zh-CN': '把相机文件名改成「日期 + 地点 + 三位数序号」',
  'en-US': 'Rename to date + place + number',
}

/** Runs before the app mounts: language, theme, and "already seen" flags. */
export function prepareDemoScene() {
  const { params, scene, lang, theme } = readParams()
  if (!scene && !params.has('frame')) return
  try {
    localStorage.clear()
    localStorage.setItem('has-seen-help', 'true')
    localStorage.setItem('ai_privacy_ack_v1', 'true')
    localStorage.setItem('ai_active_profile_id', 'claude-cli')
    localStorage.setItem(
      'regex-batch-renamer-settings',
      JSON.stringify({ language: lang, themeMode: theme, processFilenameOnly: true, defaultUseRegex: true, zoomLevel: 100, disableRulesAfterRename: false })
    )
  } catch {
    /* storage unavailable: scene still renders with defaults */
  }
  if (params.has('frame')) installWindowFrame()
}

function installWindowFrame() {
  document.documentElement.classList.add('demo-frame')
  const style = document.createElement('style')
  style.textContent = `
    html.demo-frame body {
      padding: 28px 32px 36px;
      box-sizing: border-box;
      background: radial-gradient(120% 120% at 0% 0%, #dbeafe 0%, #ede9fe 45%, #fce7f3 100%);
    }
    html.demo-frame.dark body {
      background: radial-gradient(120% 120% at 0% 0%, #1e293b 0%, #1e1b4b 55%, #312e81 100%);
    }
    html.demo-frame #app {
      position: relative;
      height: 100%;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 30px 60px -20px rgba(15, 23, 42, .45), 0 0 0 1px rgba(15, 23, 42, .12);
    }
    html.demo-frame #app > div { height: 100% !important; }
    html.demo-frame #app::before {
      content: '';
      position: absolute;
      top: 11px;
      left: 13px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #ff5f57;
      box-shadow: 20px 0 0 #febc2e, 40px 0 0 #28c840;
      z-index: 100;
    }
  `
  document.head.appendChild(style)
}

function click(testId: string) {
  ;(document.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null)?.click()
}

/** Runs after mount: fill stores and open the panels a scene needs. */
export async function runDemoScene() {
  const { scene, lang } = readParams()
  if (!scene) return
  const { useFileStore } = await import('../stores/fileStore')
  const { useOperationStore } = await import('../stores/operationStore')
  const { useAiStore } = await import('../stores/aiStore')
  const files = useFileStore()
  const ops = useOperationStore()
  const ai = useAiStore()
  document.documentElement.dataset.sceneReady = 'false'

  const p = place(lang)
  const photoRules = [
    { type: 'regex', params: { pattern: 'IMG_(\\d{4})(\\d{2})(\\d{2})_\\d{6}', replacement: '$1-$2-$3', useRegex: true } },
    { type: 'regex', params: { pattern: '$', replacement: ` ${p} \${n:3}`, useRegex: true } },
  ]

  switch (scene) {
    case 'hero':
      files.addFilePaths(DEMO_FILE_SETS.photos)
      ops.loadFromPreset(photoRules)
      break
    case 'docs':
      files.addFilePaths(DEMO_FILE_SETS.docs)
      ops.loadFromPreset([
        { type: 'regex', params: { pattern: '[ _-]*(?:\\(\\d+\\)|\\(edited\\)|copy|final)(?=[ _-]|$)', replacement: '', useRegex: true, caseInsensitive: true } },
        { type: 'regex', params: { pattern: '\\s+', replacement: '_', useRegex: true } },
        { type: 'regex', params: { pattern: '^scan0*(\\d+)$', replacement: 'Receipt_$1', useRegex: true } },
      ])
      break
    case 'ai': {
      files.addFilePaths(DEMO_FILE_SETS.photos)
      click('toggle-sidebar')
      ai.openDrawer()
      await ai.sendMessage(AI_PROMPTS[lang] || AI_PROMPTS['en-US'])
      const last = ai.messages[ai.messages.length - 1]
      if (last?.pipeline) ai.applyMessagePipeline(last.id)
      break
    }
    case 'plugins':
      click('open-plugins')
      await waitFor(() => document.querySelector('[data-testid="tab-marketplace"]'))
      click('tab-marketplace')
      await waitFor(() => document.querySelectorAll('[role="dialog"] h4').length > 1, 8000)
      break
    case 'history':
      files.addFilePaths(DEMO_FILE_SETS.photos)
      ops.loadFromPreset(photoRules)
      await sleep(600)
      click('rename')
      await sleep(800)
      click('open-history')
      break
  }

  await sleep(900)
  document.documentElement.dataset.sceneReady = 'true'
}
