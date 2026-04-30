import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i]
    if (!current.startsWith('--')) continue
    args[current.slice(2)] = argv[i + 1]
    i += 1
  }
  return args
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function getPreviousStableTag(currentTag) {
  const tags = git(['tag', '--list', 'v*', '--sort=-version:refname'])
    .split('\n')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => tag !== currentTag)

  return tags[0] ?? null
}

function getCommitSubjects(range) {
  const output = git(['log', '--format=%s', range])
  return output.split('\n').map((line) => line.trim()).filter(Boolean)
}

async function main() {
  const args = parseArgs(process.argv)
  const tag = args.tag
  const output = args.output
  const repo = args.repo

  if (!tag || !output || !repo) {
    throw new Error('Usage: node scripts/prepare-release-notes.mjs --tag <tag> --repo <owner/repo> --output <file>')
  }

  const manualPath = path.join('release-notes', `${tag}.md`)
  await mkdir(path.dirname(output), { recursive: true })

  try {
    const manual = await readFile(manualPath, 'utf8')
    await writeFile(output, manual)
    return
  } catch {
    // Fall back to generated notes.
  }

  const previousTag = getPreviousStableTag(tag)
  const compareUrl = previousTag
    ? `https://github.com/${repo}/compare/${previousTag}...${tag}`
    : `https://github.com/${repo}/releases/tag/${tag}`
  const range = previousTag ? `${previousTag}..${tag}` : tag
  const commits = getCommitSubjects(range)

  const lines = ['## Highlights', '']
  if (commits.length === 0) {
    lines.push('- Maintenance release.', '')
  } else {
    for (const subject of commits) {
      lines.push(`- ${subject}`)
    }
    lines.push('')
  }

  lines.push('## Full Changelog', '', `[Compare changes](${compareUrl})`, '')
  await writeFile(output, `${lines.join('\n')}`)
}

await main()
