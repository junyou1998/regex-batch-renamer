import { desktop } from './desktop'

/** GitHub repository that hosts releases (formerly junyou1998/regex-batch-renamer; GitHub redirects the old name). */
export const REPO = 'junyou1998/renamix'
export const REPO_URL = `https://github.com/${REPO}`

const CACHE_TTL_MS = 5 * 60 * 1000
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases`
const RELEASES_PAGE = `${REPO_URL}/releases`
const RELEASES_ATOM = `${REPO_URL}/releases.atom`
const STORED_RELEASES_KEY = 'renamix:releases:'

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
  // 403/429 usually means the unauthenticated rate limit (60 requests/hour per IP).
  if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`)

  const data = await res.json()
  if (!Array.isArray(data)) throw new Error('Unexpected GitHub API response')

  return data.map(mapRelease)
}

/** Parse GitHub's releases Atom feed. It is not rate limited like the REST API, but has no assets. */
export function parseReleasesAtom(xml: string): ReleaseInfo[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Invalid releases feed')

  return Array.from(doc.getElementsByTagName('entry')).flatMap((entry) => {
    const link = entry.getElementsByTagName('link')[0]?.getAttribute('href') ?? ''
    const tagName = decodeURIComponent(link.split('/releases/tag/')[1] ?? '')
    if (!tagName) return []
    return [{
      tagName,
      htmlUrl: link,
      // Atom carries the release notes as rendered HTML; renderSafeMarkdown sanitizes it.
      body: entry.getElementsByTagName('content')[0]?.textContent ?? '',
      publishedAt: entry.getElementsByTagName('updated')[0]?.textContent ?? '',
      prerelease: tagName.startsWith('beta-v'),
      assets: [],
    }]
  })
}

async function fetchReleasesFromAtom(): Promise<ReleaseInfo[]> {
  return parseReleasesAtom(await desktop.fetchRemoteText(RELEASES_ATOM))
}

function readStoredReleases(channel: ReleaseChannel): ReleaseInfo[] | null {
  try {
    const raw = localStorage.getItem(STORED_RELEASES_KEY + channel)
    const data = raw ? JSON.parse(raw) : null
    return Array.isArray(data) && data.length > 0 ? data : null
  } catch {
    return null
  }
}

function storeReleases(channel: ReleaseChannel, releases: ReleaseInfo[]) {
  try {
    if (releases.length > 0) localStorage.setItem(STORED_RELEASES_KEY + channel, JSON.stringify(releases))
  } catch {
    // Storage full or unavailable: the in-memory cache still works.
  }
}

/** REST API first, then the Atom feed, then the last list we saw. Throws only when all three fail. */
async function loadReleases(channel: ReleaseChannel): Promise<ReleaseInfo[]> {
  const pick = (releases: ReleaseInfo[]) => sortByPublishedAtDesc(filterChannelReleases(releases, channel))
  for (const source of [fetchReleasesFromApi, fetchReleasesFromAtom]) {
    try {
      const releases = pick(await source())
      storeReleases(channel, releases)
      return releases
    } catch (error) {
      console.warn('Release source failed', error)
    }
  }
  const stored = readStoredReleases(channel)
  if (stored) return stored
  throw new Error('Could not load releases')
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

  const request = loadReleases(channel)
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
