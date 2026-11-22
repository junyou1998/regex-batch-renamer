/**
 * The same preview logic the app uses, small enough to run in the browser:
 * find/replace with optional regex and ignore-case, plus ${n} sequence variables.
 */
const SEQUENCE = /\$\{n(?::(\d+)(?::(\d+))?)?\}/g

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface Rule {
  find: string
  replace: string
  regex: boolean
  ignoreCase: boolean
}

export function compile(rule: Rule): { re?: RegExp; error?: string } {
  if (!rule.find) return {}
  try {
    return { re: new RegExp(rule.regex ? rule.find : escapeRegex(rule.find), rule.ignoreCase ? 'gi' : 'g') }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** Apply a rule to the name without its extension, like the app's default mode. */
export function applyRule(name: string, rule: Rule, index: number): string {
  const { re } = compile(rule)
  if (!re) return name
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  const replacement = rule.replace.replace(SEQUENCE, (_m, width, start) =>
    String(index + (start ? parseInt(start, 10) : 1)).padStart(width ? parseInt(width, 10) : 0, '0'),
  )
  return base.replace(re, replacement) + ext
}

/** Split old/new into shared prefix, removed middle, added middle, shared suffix. */
export function diff(before: string, after: string) {
  let start = 0
  while (start < before.length && start < after.length && before[start] === after[start]) start++
  let endB = before.length
  let endA = after.length
  while (endB > start && endA > start && before[endB - 1] === after[endA - 1]) {
    endB--
    endA--
  }
  return {
    prefix: before.slice(0, start),
    removed: before.slice(start, endB),
    added: after.slice(start, endA),
    suffix: before.slice(endB),
  }
}
