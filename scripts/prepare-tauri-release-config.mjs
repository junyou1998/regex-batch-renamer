import fs from 'node:fs/promises'
import path from 'node:path'

const outputPath = process.argv[2]

if (!outputPath) {
  throw new Error('Expected output path argument')
}

await fs.mkdir(path.dirname(outputPath), { recursive: true })

const rootDir = process.cwd()
const basePath = path.join(rootDir, 'src-tauri', 'tauri.conf.json')
const releasePath = path.join(rootDir, 'src-tauri', 'tauri.release.conf.json')

const [baseRaw, releaseRaw] = await Promise.all([
  fs.readFile(basePath, 'utf8'),
  fs.readFile(releasePath, 'utf8'),
])

const baseConfig = JSON.parse(baseRaw)
const releaseConfig = JSON.parse(releaseRaw)

const updaterPubkey = process.env.TAURI_UPDATER_PUBKEY ?? ''
const updaterEndpoint = process.env.BETA_UPDATER_ENDPOINT ?? ''

if (!updaterPubkey || !updaterEndpoint) {
  await fs.writeFile(outputPath, JSON.stringify(baseConfig, null, 2))
  console.log('Generated base Tauri config without updater overrides')
  process.exit(0)
}

const merged = {
  ...baseConfig,
  bundle: {
    ...(baseConfig.bundle ?? {}),
    ...(releaseConfig.bundle ?? {}),
  },
  plugins: {
    ...(baseConfig.plugins ?? {}),
    updater: {
      ...(releaseConfig.plugins?.updater ?? {}),
      pubkey: updaterPubkey,
      endpoints: [updaterEndpoint],
    },
  },
}

await fs.writeFile(outputPath, JSON.stringify(merged, null, 2))
console.log('Generated Tauri release config with updater overrides')
