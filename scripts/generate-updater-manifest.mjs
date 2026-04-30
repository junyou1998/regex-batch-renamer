import fs from 'node:fs/promises'
import path from 'node:path'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    args[key] = argv[i + 1]
    i += 1
  }
  return args
}

function releaseDownloadUrl(repo, tag, fileName) {
  return `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(fileName)}`
}

async function readSignature(filePath) {
  return (await fs.readFile(filePath, 'utf8')).trim()
}

async function findOptionalFile(dir, matcher) {
  const entries = await fs.readdir(dir)
  const found = entries.find(matcher)
  return found ? path.join(dir, found) : null
}

async function requireFile(dir, matcher, description) {
  const filePath = await findOptionalFile(dir, matcher)
  if (!filePath) {
    throw new Error(`Missing ${description} in ${dir}`)
  }
  return filePath
}

async function buildManifest({ assetsDir, output, repo, tag, version }) {
  const macDir = path.join(assetsDir, 'macos')
  const linuxDir = path.join(assetsDir, 'linux')
  const windowsDir = path.join(assetsDir, 'windows')

  const darwinArm = await requireFile(macDir, (name) => name.endsWith('_aarch64.app.tar.gz'), 'macOS arm64 updater bundle')
  const darwinArmSig = await requireFile(macDir, (name) => name.endsWith('_aarch64.app.tar.gz.sig'), 'macOS arm64 updater signature')
  const darwinX64 = await requireFile(macDir, (name) => name.endsWith('_x64.app.tar.gz'), 'macOS x64 updater bundle')
  const darwinX64Sig = await requireFile(macDir, (name) => name.endsWith('_x64.app.tar.gz.sig'), 'macOS x64 updater signature')

  const winZip = await findOptionalFile(windowsDir, (name) => name.endsWith('.zip') && !name.endsWith('.zip.sig'))
  const winZipSig = await findOptionalFile(windowsDir, (name) => name.endsWith('.zip.sig'))
  const winExe = await findOptionalFile(windowsDir, (name) => name.endsWith('.exe') && !name.endsWith('.exe.sig'))
  const winExeSig = await findOptionalFile(windowsDir, (name) => name.endsWith('.exe.sig'))
  const windowsBundle = winZip ?? winExe
  const windowsSig = winZipSig ?? winExeSig
  if (!windowsBundle || !windowsSig) {
    throw new Error(`Missing Windows updater assets in ${windowsDir}`)
  }

  const linuxTar = await findOptionalFile(linuxDir, (name) => name.endsWith('.AppImage.tar.gz'))
  const linuxTarSig = await findOptionalFile(linuxDir, (name) => name.endsWith('.AppImage.tar.gz.sig'))
  const linuxAppImage = await findOptionalFile(linuxDir, (name) => name.endsWith('.AppImage') && !name.endsWith('.AppImage.sig'))
  const linuxAppImageSig = await findOptionalFile(linuxDir, (name) => name.endsWith('.AppImage.sig'))
  const linuxBundle = linuxTar ?? linuxAppImage
  const linuxSig = linuxTarSig ?? linuxAppImageSig
  if (!linuxBundle || !linuxSig) {
    throw new Error(`Missing Linux updater assets in ${linuxDir}`)
  }

  const manifest = {
    version,
    notes: `Stable update ${version}`,
    pub_date: new Date().toISOString(),
    platforms: {
      'darwin-aarch64': {
        signature: await readSignature(darwinArmSig),
        url: releaseDownloadUrl(repo, tag, path.basename(darwinArm)),
      },
      'darwin-x86_64': {
        signature: await readSignature(darwinX64Sig),
        url: releaseDownloadUrl(repo, tag, path.basename(darwinX64)),
      },
      'windows-x86_64': {
        signature: await readSignature(windowsSig),
        url: releaseDownloadUrl(repo, tag, path.basename(windowsBundle)),
      },
      'linux-x86_64': {
        signature: await readSignature(linuxSig),
        url: releaseDownloadUrl(repo, tag, path.basename(linuxBundle)),
      },
    },
  }

  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`)
}

const args = parseArgs(process.argv.slice(2))

for (const required of ['assets-dir', 'output', 'repo', 'tag', 'version']) {
  if (!args[required]) {
    throw new Error(`Missing --${required}`)
  }
}

await buildManifest({
  assetsDir: args['assets-dir'],
  output: args.output,
  repo: args.repo,
  tag: args.tag,
  version: args.version,
})
