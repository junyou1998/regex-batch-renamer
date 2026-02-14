const RELEASE_URL = 'https://api.github.com/repos/junyou1998/regex-batch-renamer/releases/latest'
const CACHE_TTL_MS = 5 * 60 * 1000

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

async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  const res = await fetch(RELEASE_URL)
  if (!res.ok) return null

  const data = await res.json()
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

export async function getLatestRelease(options?: { force?: boolean }): Promise<ReleaseInfo | null> {
  if (!options?.force) {
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.data
    }
    if (inflight) return inflight
  }

  inflight = fetchLatestRelease().finally(() => {
    inflight = null
  })

  const data = await inflight
  if (data) {
    cached = { data, fetchedAt: Date.now() }
  }

  return data
}
