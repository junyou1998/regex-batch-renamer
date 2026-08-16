import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { buildManifest } from './generate-updater-manifest.mjs'

async function makeAssets() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'updater-manifest-'))
  await fs.mkdir(path.join(root, 'macos'), { recursive: true })
  await fs.mkdir(path.join(root, 'linux'), { recursive: true })
  await fs.mkdir(path.join(root, 'windows'), { recursive: true })
  return root
}

async function writeFile(filePath, contents = 'fixture') {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, contents)
}

test('buildManifest uses the Windows NSIS installer asset for stable manifests', async () => {
  const assetsDir = await makeAssets()
  const output = path.join(assetsDir, 'out', 'stable.json')

  await writeFile(path.join(assetsDir, 'macos', 'Regex.Batch.Renamer_aarch64.app.tar.gz'))
  await writeFile(path.join(assetsDir, 'macos', 'Regex.Batch.Renamer_aarch64.app.tar.gz.sig'), 'mac-arm')
  await writeFile(path.join(assetsDir, 'macos', 'Regex.Batch.Renamer_x64.app.tar.gz'))
  await writeFile(path.join(assetsDir, 'macos', 'Regex.Batch.Renamer_x64.app.tar.gz.sig'), 'mac-x64')
  await writeFile(path.join(assetsDir, 'linux', 'Regex.Batch.Renamer_0.5.1_amd64.AppImage'))
  await writeFile(path.join(assetsDir, 'linux', 'Regex.Batch.Renamer_0.5.1_amd64.AppImage.sig'), 'linux')
  await writeFile(path.join(assetsDir, 'windows', 'Regex.Batch.Renamer_0.5.1_x64-setup.exe'))
  await writeFile(path.join(assetsDir, 'windows', 'Regex.Batch.Renamer_0.5.1_x64-setup.exe.sig'), 'windows')

  await buildManifest({
    assetsDir,
    output,
    repo: 'junyou1998/regex-batch-renamer',
    tag: 'v0.5.1',
    version: '0.5.1',
  })

  const manifest = JSON.parse(await fs.readFile(output, 'utf8'))
  assert.equal(
    manifest.platforms['windows-x86_64'].url,
    'https://github.com/junyou1998/regex-batch-renamer/releases/download/v0.5.1/Regex.Batch.Renamer_0.5.1_x64-setup.exe',
  )
  assert.equal(manifest.platforms['windows-x86_64'].signature, 'windows')
})

test('buildManifest fails when the Windows NSIS installer asset is missing', async () => {
  const assetsDir = await makeAssets()
  const output = path.join(assetsDir, 'out', 'stable.json')

  await writeFile(path.join(assetsDir, 'macos', 'Regex.Batch.Renamer_aarch64.app.tar.gz'))
  await writeFile(path.join(assetsDir, 'macos', 'Regex.Batch.Renamer_aarch64.app.tar.gz.sig'), 'mac-arm')
  await writeFile(path.join(assetsDir, 'macos', 'Regex.Batch.Renamer_x64.app.tar.gz'))
  await writeFile(path.join(assetsDir, 'macos', 'Regex.Batch.Renamer_x64.app.tar.gz.sig'), 'mac-x64')
  await writeFile(path.join(assetsDir, 'linux', 'Regex.Batch.Renamer_0.5.1_amd64.AppImage'))
  await writeFile(path.join(assetsDir, 'linux', 'Regex.Batch.Renamer_0.5.1_amd64.AppImage.sig'), 'linux')

  await assert.rejects(
    buildManifest({
      assetsDir,
      output,
      repo: 'junyou1998/regex-batch-renamer',
      tag: 'v0.5.1',
      version: '0.5.1',
    }),
    /Missing Windows NSIS installer/,
  )
})
