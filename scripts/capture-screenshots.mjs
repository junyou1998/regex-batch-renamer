#!/usr/bin/env node
/**
 * Regenerate README / website screenshots from demo mode.
 *
 *   pnpm demo                         # in another terminal (serves :1421)
 *   node scripts/capture-screenshots.mjs [--lang zh-TW,en-US] [--scene hero,ai]
 *
 * Uses a local Google Chrome / Chromium in headless mode at 2x scale, encodes
 * WebP with `cwebp` (2000px wide) and writes the same file to
 *   assets/screenshots/<lang>/<scene>.webp           (README)
 *   website/public/screenshots/<lang>/<scene>.webp (website)
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const BASE_URL = process.env.DEMO_URL || 'http://localhost:1421'
const WIDTH = 1440
const HEIGHT = 900

const SCENES = {
  hero: { theme: 'light' },
  docs: { theme: 'light' },
  ai: { theme: 'light' },
  plugins: { theme: 'light' },
  history: { theme: 'light' },
  dark: { scene: 'hero', theme: 'dark' },
}
const LANGS = ['zh-TW', 'zh-CN', 'en-US']

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1]?.split(',') : undefined
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ].filter(Boolean)
  const found = candidates.find((p) => existsSync(p))
  if (!found) throw new Error('Chrome not found; set CHROME_PATH')
  return found
}

function hasCommand(cmd) {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const chrome = findChrome()
if (!hasCommand('cwebp')) throw new Error('cwebp not found (brew install webp)')
const langs = arg('lang') || LANGS
const scenes = arg('scene') || Object.keys(SCENES)

for (const lang of langs) {
  const outDir = path.join(ROOT, 'assets', 'screenshots', lang)
  const siteDir = path.join(ROOT, 'website', 'public', 'screenshots', lang)
  mkdirSync(outDir, { recursive: true })
  mkdirSync(siteDir, { recursive: true })

  for (const name of scenes) {
    const config = SCENES[name]
    if (!config) throw new Error(`Unknown scene: ${name}`)
    const url = `${BASE_URL}/?scene=${config.scene || name}&lang=${lang}&theme=${config.theme}&frame=1`
    const out = path.join(outDir, `${name}.webp`)
    const profile = mkdtempSync(path.join(tmpdir(), 'renamix-shot-'))
    const raw = path.join(profile, 'raw.png')
    try {
      execFileSync(chrome, [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-first-run',
        '--no-default-browser-check',
        `--user-data-dir=${profile}`,
        `--window-size=${WIDTH},${HEIGHT}`,
        '--force-device-scale-factor=2',
        '--virtual-time-budget=15000',
        `--screenshot=${raw}`,
        url,
      ], { stdio: 'pipe' })
      execFileSync('cwebp', ['-quiet', '-q', '85', '-resize', '2000', '0', raw, '-o', out])
      copyFileSync(out, path.join(siteDir, `${name}.webp`))
      console.log(`✓ ${lang}/${name}`)
    } finally {
      rmSync(profile, { recursive: true, force: true })
    }
  }
}
