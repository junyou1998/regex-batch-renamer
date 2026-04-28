import { spawn } from 'node:child_process'
import process from 'node:process'

function defaultBundlesForPlatform(platform) {
  switch (platform) {
    case 'darwin':
      return ['app']
    case 'win32':
      return ['nsis']
    case 'linux':
      return ['appimage', 'deb']
    default:
      throw new Error(`Unsupported platform for Tauri bundles: ${platform}`)
  }
}

const extraArgs = process.argv.slice(2)
const configuredBundles = process.env.TAURI_BUNDLES
  ? process.env.TAURI_BUNDLES.split(',').map((value) => value.trim()).filter(Boolean)
  : defaultBundlesForPlatform(process.platform)

const tauriArgs = [
  'tauri',
  'build',
  '--ci',
  '--bundles',
  ...configuredBundles,
  ...extraArgs,
]

const child = spawn('pnpm', tauriArgs, {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
