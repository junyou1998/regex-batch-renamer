import fs from 'node:fs/promises'
import path from 'node:path'

const outputPath = process.argv[2]

if (!outputPath) {
  throw new Error('Expected output path argument')
}

await fs.mkdir(path.dirname(outputPath), { recursive: true })

const rootDir = process.cwd()
const basePath = path.join(rootDir, 'src-tauri', 'tauri.conf.json')
const betaPath = path.join(rootDir, 'src-tauri', 'tauri.beta.conf.json')
const releasePath = path.join(rootDir, 'src-tauri', 'tauri.release.conf.json')

const [baseRaw, betaRaw, releaseRaw] = await Promise.all([
  fs.readFile(basePath, 'utf8'),
  fs.readFile(betaPath, 'utf8'),
  fs.readFile(releasePath, 'utf8'),
])

const baseConfig = JSON.parse(baseRaw)
const betaConfig = JSON.parse(betaRaw)
const releaseConfig = JSON.parse(releaseRaw)

function detectChannel() {
  const explicitChannel = (process.env.APP_RELEASE_CHANNEL ?? process.env.TAURI_RELEASE_CHANNEL ?? '').trim()
  if (explicitChannel === 'stable' || explicitChannel === 'beta') {
    return explicitChannel
  }

  const refName = process.env.GITHUB_REF_NAME ?? ''
  return refName.startsWith('beta-v') ? 'beta' : 'stable'
}

function detectVersion(defaultVersion) {
  const explicitVersion = (process.env.APP_VERSION ?? '').trim()
  if (explicitVersion) return explicitVersion

  const refName = process.env.GITHUB_REF_NAME ?? ''
  if (refName.startsWith('beta-v')) return refName.slice('beta-v'.length)
  if (refName.startsWith('v')) return refName.slice(1)

  return defaultVersion
}

function mergeConfig(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return override ?? base
  }

  if (!base || typeof base !== 'object') return override ?? base
  if (!override || typeof override !== 'object') return override ?? base

  const result = { ...base }
  for (const [key, value] of Object.entries(override)) {
    result[key] = key in result ? mergeConfig(result[key], value) : value
  }
  return result
}

const channel = detectChannel()
const resolvedVersion = detectVersion(baseConfig.version ?? '')
const updaterPubkey = process.env.TAURI_UPDATER_PUBKEY ?? ''
const updaterEndpoint = process.env.TAURI_UPDATER_ENDPOINT ?? ''
const updaterSigningKey = process.env.TAURI_SIGNING_PRIVATE_KEY ?? ''

let mergedConfig = mergeConfig(baseConfig, channel === 'beta' ? betaConfig : {})

if (resolvedVersion) {
  mergedConfig.version = resolvedVersion
}

if (!updaterPubkey || !updaterEndpoint || !updaterSigningKey) {
  await fs.writeFile(outputPath, JSON.stringify(mergedConfig, null, 2))
  console.log(`Generated ${channel} Tauri config without updater overrides`)
  process.exit(0)
}

const merged = {
  ...mergedConfig,
  bundle: {
    ...(mergedConfig.bundle ?? {}),
    ...(releaseConfig.bundle ?? {}),
  },
  plugins: {
    ...(mergedConfig.plugins ?? {}),
    updater: {
      ...(releaseConfig.plugins?.updater ?? {}),
      pubkey: updaterPubkey,
      endpoints: [updaterEndpoint],
    },
  },
}

await fs.writeFile(outputPath, JSON.stringify(merged, null, 2))
console.log(`Generated ${channel} Tauri release config with updater overrides`)
