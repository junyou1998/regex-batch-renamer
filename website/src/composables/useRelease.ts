import { computed, ref } from 'vue'

export const REPO = 'junyou1998/renamix'
export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`
export const SPONSOR_URL = 'https://www.buymeacoffee.com/junyou'

export type Platform = 'mac' | 'windows' | 'linux'

export interface ReleaseAsset {
  key: 'macArm' | 'macIntel' | 'windows' | 'appImage' | 'deb'
  platform: Platform
  url: string
}

const MATCHERS: { key: ReleaseAsset['key']; platform: Platform; test: (name: string) => boolean }[] = [
  { key: 'macArm', platform: 'mac', test: (n) => n.endsWith('_aarch64.dmg') },
  { key: 'macIntel', platform: 'mac', test: (n) => n.endsWith('_x64.dmg') },
  { key: 'windows', platform: 'windows', test: (n) => n.endsWith('-setup.exe') },
  { key: 'appImage', platform: 'linux', test: (n) => n.endsWith('.AppImage') },
  { key: 'deb', platform: 'linux', test: (n) => n.endsWith('.deb') },
]

const version = ref<string | null>(null)
const assets = ref<ReleaseAsset[]>([])
let started = false

function detectPlatform(): Platform {
  const ua = `${navigator.userAgent} ${navigator.platform}`.toLowerCase()
  if (ua.includes('win')) return 'windows'
  if (ua.includes('linux') && !ua.includes('android')) return 'linux'
  return 'mac'
}

/** Latest release info from GitHub; falls back to the releases page if the API is unavailable. */
export function useRelease() {
  if (!started) {
    started = true
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { tag_name?: string; assets?: { name: string; browser_download_url: string }[] }) => {
        version.value = data.tag_name?.replace(/^v/, '') ?? null
        const found: ReleaseAsset[] = []
        for (const m of MATCHERS) {
          const asset = data.assets?.find((a) => m.test(a.name))
          if (asset) found.push({ key: m.key, platform: m.platform, url: asset.browser_download_url })
        }
        assets.value = found
      })
      .catch(() => {
        /* keep the releases-page fallback */
      })
  }

  const platform = ref<Platform>(detectPlatform())

  function urlFor(key: ReleaseAsset['key']) {
    return assets.value.find((a) => a.key === key)?.url ?? RELEASES_URL
  }

  const primaryUrl = computed(() => {
    if (platform.value === 'windows') return urlFor('windows')
    if (platform.value === 'linux') return urlFor('appImage')
    return urlFor('macArm')
  })

  return { version, platform, urlFor, primaryUrl }
}
