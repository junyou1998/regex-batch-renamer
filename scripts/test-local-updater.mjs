import http from 'node:http'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

const rootDir = process.cwd()
const stagingDir = path.join(rootDir, '.test-updater')

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      args[key] = argv[i + 1]
      i += 1
    } else {
      args._.push(arg)
    }
  }
  return args
}

async function clean() {
  if (fs.existsSync(stagingDir)) {
    await fsp.rm(stagingDir, { recursive: true, force: true })
    console.log(`[test-updater] Cleaned ${stagingDir}`)
  } else {
    console.log(`[test-updater] Nothing to clean (${stagingDir} does not exist)`)
  }
}

async function generateManifest(version = '0.5.2', port = 8080) {
  await fsp.mkdir(stagingDir, { recursive: true })

  const baseUrl = `http://127.0.0.1:${port}`
  const releaseBundleDir = path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle')

  const platforms = {}

  // macOS
  const macosBundleDir = path.join(releaseBundleDir, 'macos')
  if (fs.existsSync(macosBundleDir)) {
    const files = await fsp.readdir(macosBundleDir)
    const currentArch = process.arch === 'arm64' ? 'aarch64' : 'x86_64'
    
    // Check specific arch files first
    let foundSpecific = false
    for (const arch of ['aarch64', 'x64']) {
      const targetArch = arch === 'aarch64' ? 'aarch64' : 'x86_64'
      const tarFile = files.find((f) => f.endsWith(`_${arch}.app.tar.gz`) || (arch === 'aarch64' && f.endsWith('_aarch64.app.tar.gz')) || (arch === 'x64' && f.endsWith('_x64.app.tar.gz')))
      const sigFile = tarFile ? `${tarFile}.sig` : null

      if (tarFile && files.includes(sigFile)) {
        await fsp.copyFile(path.join(macosBundleDir, tarFile), path.join(stagingDir, tarFile))
        await fsp.copyFile(path.join(macosBundleDir, sigFile), path.join(stagingDir, sigFile))
        const signature = (await fsp.readFile(path.join(macosBundleDir, sigFile), 'utf8')).trim()

        platforms[`darwin-${targetArch}`] = {
          signature,
          url: `${baseUrl}/${tarFile}`,
        }
        foundSpecific = true
        console.log(`[test-updater] Found macOS ${targetArch} bundle: ${tarFile}`)
      }
    }

    // If no arch-suffixed files found, check for generic .app.tar.gz
    if (!foundSpecific) {
      const genericTar = files.find((f) => f.endsWith('.app.tar.gz'))
      const genericSig = genericTar ? `${genericTar}.sig` : null
      if (genericTar && files.includes(genericSig)) {
        await fsp.copyFile(path.join(macosBundleDir, genericTar), path.join(stagingDir, genericTar))
        await fsp.copyFile(path.join(macosBundleDir, genericSig), path.join(stagingDir, genericSig))
        const signature = (await fsp.readFile(path.join(macosBundleDir, genericSig), 'utf8')).trim()

        platforms[`darwin-${currentArch}`] = {
          signature,
          url: `${baseUrl}/${encodeURIComponent(genericTar)}`,
        }
        console.log(`[test-updater] Found macOS local bundle: ${genericTar} (registered as darwin-${currentArch})`)
      }
    }
  }

  // Windows NSIS
  const nsisBundleDir = path.join(releaseBundleDir, 'nsis')
  if (fs.existsSync(nsisBundleDir)) {
    const files = await fsp.readdir(nsisBundleDir)
    const exeFile = files.find((f) => f.endsWith('.exe') && !f.endsWith('.exe.sig'))
    const sigFile = exeFile ? `${exeFile}.sig` : null

    if (exeFile && files.includes(sigFile)) {
      await fsp.copyFile(path.join(nsisBundleDir, exeFile), path.join(stagingDir, exeFile))
      await fsp.copyFile(path.join(nsisBundleDir, sigFile), path.join(stagingDir, sigFile))
      const signature = (await fsp.readFile(path.join(nsisBundleDir, sigFile), 'utf8')).trim()

      platforms['windows-x86_64'] = {
        signature,
        url: `${baseUrl}/${exeFile}`,
      }
      console.log(`[test-updater] Found Windows NSIS bundle: ${exeFile}`)
    }
  }

  // Linux AppImage
  const appimageBundleDir = path.join(releaseBundleDir, 'appimage')
  if (fs.existsSync(appimageBundleDir)) {
    const files = await fsp.readdir(appimageBundleDir)
    const bundleFile = files.find((f) => (f.endsWith('.AppImage') || f.endsWith('.AppImage.tar.gz')) && !f.endsWith('.sig'))
    const sigFile = bundleFile ? `${bundleFile}.sig` : null

    if (bundleFile && files.includes(sigFile)) {
      await fsp.copyFile(path.join(appimageBundleDir, bundleFile), path.join(stagingDir, bundleFile))
      await fsp.copyFile(path.join(appimageBundleDir, sigFile), path.join(stagingDir, sigFile))
      const signature = (await fsp.readFile(path.join(appimageBundleDir, sigFile), 'utf8')).trim()

      platforms['linux-x86_64'] = {
        signature,
        url: `${baseUrl}/${bundleFile}`,
      }
      console.log(`[test-updater] Found Linux bundle: ${bundleFile}`)
    }
  }

  const manifest = {
    version,
    notes: `Local test update to ${version}`,
    pub_date: new Date().toISOString(),
    platforms,
  }

  const manifestPath = path.join(stagingDir, 'updater.json')
  await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(`[test-updater] Created manifest at ${manifestPath}`)
  console.log(`[test-updater] Detected platforms: ${Object.keys(platforms).join(', ') || 'None'}`)
}

function serve(port = 8080) {
  if (!fs.existsSync(stagingDir)) {
    console.error(`[test-updater] Staging directory ${stagingDir} does not exist. Run generate-manifest first.`)
    process.exit(1)
  }

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const cleanUrl = decodeURIComponent((req.url || '/').split('?')[0])
    const relativePath = cleanUrl.replace(/^\/+/, '') || 'updater.json'
    const filePath = path.join(stagingDir, relativePath)

    if (!fs.existsSync(filePath)) {
      console.log(`[HTTP 404] ${req.method} ${cleanUrl}`)
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found')
      return
    }

    console.log(`[HTTP 200] ${req.method} ${cleanUrl}`)
    const stat = fs.statSync(filePath)
    const contentType = filePath.endsWith('.json')
      ? 'application/json'
      : filePath.endsWith('.tar.gz')
        ? 'application/gzip'
        : filePath.endsWith('.exe')
          ? 'application/octet-stream'
          : 'application/octet-stream'

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
    })
    fs.createReadStream(filePath).pipe(res)
  })

  server.listen(port, '127.0.0.1', () => {
    console.log(`\n======================================================`)
    console.log(` Local Tauri Updater Server running at:`)
    console.log(`   http://127.0.0.1:${port}/updater.json`)
    console.log(`======================================================\n`)
  })
}

function showHelp() {
  console.log(`
Usage:
  node scripts/test-local-updater.mjs <command> [options]

Commands:
  generate-manifest   Stage current release build artifacts and generate updater.json
                      Options: --version <ver> (default: 0.5.2) --port <port> (default: 8080)
  serve               Start the local HTTP server on staging directory (.test-updater)
                      Options: --port <port> (default: 8080)
  clean               Remove .test-updater directory
  help                Show this message
`)
}

const args = parseArgs(process.argv.slice(2))
const command = args._[0] || 'help'
const port = parseInt(args.port || '8080', 10)
const version = args.version || '0.5.2'

switch (command) {
  case 'generate-manifest':
    await generateManifest(version, port)
    break
  case 'serve':
    serve(port)
    break
  case 'clean':
    await clean()
    break
  case 'help':
  default:
    showHelp()
    break
}
