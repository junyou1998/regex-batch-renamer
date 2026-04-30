import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

const rootDir = process.cwd()
const releaseConfigPath = path.join(os.tmpdir(), 'regex-batch-renamer-tauri.release.conf.json')

function detectReleaseVersion() {
  const explicitVersion = (process.env.APP_VERSION ?? '').trim()
  if (explicitVersion) return explicitVersion

  const refName = process.env.GITHUB_REF_NAME ?? ''
  if (refName.startsWith('beta-v')) return refName.slice('beta-v'.length)
  if (refName.startsWith('v')) return refName.slice(1)

  return ''
}

const releaseVersion = detectReleaseVersion()
const childEnv = {
  ...process.env,
  ...(releaseVersion ? { APP_VERSION: releaseVersion } : {}),
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      env: childEnv,
      shell: process.platform === 'win32',
    })

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal)
        return
      }

      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 1}`))
    })
  })
}

await run('node', ['scripts/prepare-tauri-release-config.mjs', releaseConfigPath])
await run('pnpm', ['exec', 'vue-tsc', '--noEmit'])
await run('node', ['scripts/run-tauri-build.mjs', '--config', releaseConfigPath])
