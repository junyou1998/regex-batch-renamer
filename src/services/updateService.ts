const CACHE_TTL_MS = 5 * 60 * 1000
const RELEASES_API = 'https://api.github.com/repos/junyou1998/regex-batch-renamer/releases'
const RELEASES_PAGE = 'https://github.com/junyou1998/regex-batch-renamer/releases'

type ReleaseChannel = 'stable' | 'beta'

export interface ReleaseAsset {
  name: string
  browserDownloadUrl: string
}

export interface ReleaseInfo {
  tagName: string
  htmlUrl: string
  body: string
  publishedAt: string
  prerelease: boolean
  assets: ReleaseAsset[]
}

interface ParsedVersion {
  core: number[]
  prerelease: string | null
}

interface ReleaseCacheEntry {
  data: ReleaseInfo[]
  fetchedAt: number
}

const releaseCache: Record<ReleaseChannel, ReleaseCacheEntry | null> = {
  stable: null,
  beta: null,
}

const inflight: Record<ReleaseChannel, Promise<ReleaseInfo[]> | null> = {
  stable: null,
  beta: null,
}

function mapRelease(data: any): ReleaseInfo {
  return {
    tagName: data.tag_name ?? '',
    htmlUrl: data.html_url ?? '',
    body: data.body ?? '',
    publishedAt: data.published_at ?? data.created_at ?? '',
    prerelease: Boolean(data.prerelease),
    assets: Array.isArray(data.assets)
      ? data.assets.map((asset: any) => ({
        name: asset.name,
        browserDownloadUrl: asset.browser_download_url,
      }))
      : [],
  }
}

function filterChannelReleases(releases: ReleaseInfo[], channel: ReleaseChannel) {
  if (channel === 'beta') {
    return releases
      .filter((release) => release.prerelease && release.tagName.startsWith('beta-v'))
  }

  return releases
    .filter((release) => !release.prerelease && release.tagName.startsWith('v'))
}

function sortByPublishedAtDesc(releases: ReleaseInfo[]) {
  return [...releases].sort((a, b) => {
    const aTime = Date.parse(a.publishedAt || '')
    const bTime = Date.parse(b.publishedAt || '')
    return bTime - aTime
  })
}

export function normalizeReleaseVersion(tagName: string) {
  return tagName.replace(/^beta-v|^v/, '')
}

export function getReleasePageUrl(tagName?: string) {
  if (!tagName) return RELEASES_PAGE
  return `${RELEASES_PAGE}/tag/${tagName}`
}

function parseVersion(version: string): ParsedVersion | null {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/)
  if (!match) return null

  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ?? null,
  }
}

export function isNewerVersion(currentVersion: string, nextVersion: string) {
  const current = parseVersion(currentVersion)
  const next = parseVersion(nextVersion)

  if (!current || !next) {
    return currentVersion !== nextVersion
  }

  for (let i = 0; i < 3; i += 1) {
    if (current.core[i] < next.core[i]) return true
    if (current.core[i] > next.core[i]) return false
  }

  if (current.prerelease && !next.prerelease) return true
  if (!current.prerelease && next.prerelease) return false
  if (current.prerelease && next.prerelease) {
    return current.prerelease !== next.prerelease
  }

  return false
}

async function fetchReleasesFromApi(): Promise<ReleaseInfo[]> {
  const res = await fetch(`${RELEASES_API}?per_page=20`)
  if (!res.ok) return []

  const data = await res.json()
  if (!Array.isArray(data)) return []

  return data.map(mapRelease)
}

export async function getReleases(options?: { force?: boolean; channel?: ReleaseChannel }): Promise<ReleaseInfo[]> {
  const channel = options?.channel ?? (import.meta.env.VITE_RELEASE_CHANNEL === 'beta' ? 'beta' : 'stable')
  const cachedEntry = releaseCache[channel]

  if (!options?.force) {
    if (cachedEntry && Date.now() - cachedEntry.fetchedAt < CACHE_TTL_MS) {
      return cachedEntry.data
    }
    if (inflight[channel]) return inflight[channel]!
  }

  const request = fetchReleasesFromApi()
    .then((releases) => sortByPublishedAtDesc(filterChannelReleases(releases, channel)))
    .finally(() => {
      inflight[channel] = null
    })

  inflight[channel] = request

  const data = await request
  releaseCache[channel] = { data, fetchedAt: Date.now() }
  return data
}

export async function getLatestRelease(options?: { force?: boolean; channel?: ReleaseChannel }): Promise<ReleaseInfo | null> {
  const releases = await getReleases(options)
  return releases[0] ?? null
}

export async function getReleaseByTag(tagName: string, options?: { force?: boolean; channel?: ReleaseChannel }): Promise<ReleaseInfo | null> {
  const releases = await getReleases(options)
  return releases.find((release) => release.tagName === tagName) ?? null
}
