const CACHE_TTL_MS = 5 * 60 * 1000
const RELEASES_API = 'https://api.github.com/repos/junyou1998/regex-batch-renamer/releases'

type ReleaseChannel = 'stable' | 'beta'

export interface ReleaseAsset {
  name: string
  browserDownloadUrl: string
}

export interface ReleaseInfo {
  tagName: string
  htmlUrl: string
  body: string
  assets: ReleaseAsset[]
}

let cached: { data: ReleaseInfo; fetchedAt: number } | null = null
let inflight: Promise<ReleaseInfo | null> | null = null
let betaCached: { data: ReleaseInfo; fetchedAt: number } | null = null
let betaInflight: Promise<ReleaseInfo | null> | null = null

function mapRelease(data: any): ReleaseInfo {
  return {
    tagName: data.tag_name ?? '',
    htmlUrl: data.html_url ?? '',
    body: data.body ?? '',
    assets: Array.isArray(data.assets)
      ? data.assets.map((asset: any) => ({
        name: asset.name,
        browserDownloadUrl: asset.browser_download_url,
      }))
      : [],
  }
}

async function fetchStableRelease(): Promise<ReleaseInfo | null> {
  const res = await fetch(`${RELEASES_API}/latest`)
  if (!res.ok) return null

  const data = await res.json()
  return mapRelease(data)
}

async function fetchBetaRelease(): Promise<ReleaseInfo | null> {
  const res = await fetch(RELEASES_API)
  if (!res.ok) return null

  const releases = await res.json()
  if (!Array.isArray(releases)) return null

  const betaRelease = releases
    .filter((release: any) => release.prerelease && typeof release.tag_name === 'string' && release.tag_name.startsWith('beta-v'))
    .sort((a: any, b: any) => {
      const aTime = Date.parse(a.published_at ?? a.created_at ?? 0)
      const bTime = Date.parse(b.published_at ?? b.created_at ?? 0)
      return bTime - aTime
    })[0]

  return betaRelease ? mapRelease(betaRelease) : null
}

export async function getLatestRelease(options?: { force?: boolean; channel?: ReleaseChannel }): Promise<ReleaseInfo | null> {
  const channel = options?.channel ?? (import.meta.env.VITE_RELEASE_CHANNEL === 'beta' ? 'beta' : 'stable')

  const channelCache = channel === 'beta' ? betaCached : cached
  const channelInflight = channel === 'beta' ? betaInflight : inflight

  if (!options?.force) {
    if (channelCache && Date.now() - channelCache.fetchedAt < CACHE_TTL_MS) {
      return channelCache.data
    }
    if (channelInflight) return channelInflight
  }

  const request = (channel === 'beta' ? fetchBetaRelease() : fetchStableRelease()).finally(() => {
    if (channel === 'beta') {
      betaInflight = null
    } else {
      inflight = null
    }
  })

  if (channel === 'beta') {
    betaInflight = request
  } else {
    inflight = request
  }

  const data = await request
  if (data) {
    if (channel === 'beta') {
      betaCached = { data, fetchedAt: Date.now() }
    } else {
      cached = { data, fetchedAt: Date.now() }
    }
  }

  return data
}
