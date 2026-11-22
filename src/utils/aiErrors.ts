import i18n from '../i18n'

/**
 * The Rust side reports AI failures as `CODE` or `CODE|detail`.
 * Turn that into a translated, human-readable message.
 */
export function parseAiCode(raw: string): { code: string; detail: string } {
  const text = (raw || '').trim()
  const match = /^(AI_[A-Z_]+)(?:\|([\s\S]*))?$/.exec(text)
  if (!match) return { code: '', detail: text }
  return { code: match[1], detail: (match[2] || '').trim() }
}

export function describeAiError(raw: string): string {
  const { code, detail } = parseAiCode(raw)
  if (!code) return detail
  const key = `ai.errors.${code}`
  const te = i18n.global.te as (key: string) => boolean
  if (!te(key)) return detail ? `${code}: ${detail}` : code
  const message = i18n.global.t(key, { detail }) as string
  // Only append details the translation didn't already include.
  return detail && !message.includes(detail) ? `${message}\n${detail}` : message
}
