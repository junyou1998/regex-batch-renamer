import type { FileItem } from '../stores/fileStore'
import type { Operation } from '../stores/operationStore'
import { runPluginTransformBatch } from './pluginRunner'
import { dirname } from '../utils/path'

export type RenameIssue = 'invalid-char' | 'duplicate' | 'empty-name' | 'reserved-name' | 'too-long'

export type TargetPlatform = 'darwin' | 'win32' | 'linux' | string

export interface RenamePreviewItem {
  id: string
  newName: string
  issue?: RenameIssue
}

export interface RenamePreviewResult {
  items: RenamePreviewItem[]
  hasConflicts: boolean
  conflictReason?: RenameIssue
  /** Operation id -> regex compile error message. */
  ruleErrors: Record<string, string>
}

export interface RenameContext {
  index: number
}

export interface RenameOptions {
  processFilenameOnly: boolean
  platform?: TargetPlatform
}

export type OperationHandler = (name: string, op: Operation, ctx: RenameContext) => string

const SEQUENCE_REGEX = /\$\{n(?::(\d+)(?::(\d+))?)?\}/g
// Characters no platform should get: path separators and control characters.
const ALWAYS_INVALID = /[/\\\x00-\x1F\x7F]/
// Extra characters Windows forbids.
const WINDOWS_INVALID = /[<>:"|?*]/
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(\..*)?$/i
const MAX_NAME_BYTES = 255

export function escapeRegexLiteral(pattern: string): string {
  return pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Escape `$` so user text is inserted literally into a replacement string. */
export function escapeReplacementLiteral(text: string): string {
  return text.replace(/\$/g, '$$$$')
}

function applySequenceVariables(input: string, index: number): string {
  return input.replace(SEQUENCE_REGEX, (_match, width, start) => {
    const padding = width ? parseInt(width, 10) : 0
    const startNum = start !== undefined ? parseInt(start, 10) : 1
    return (index + startNum).toString().padStart(padding, '0')
  })
}

/** Build the RegExp for a find/replace rule, or return the compile error. */
export function compileRuleRegex(op: Operation): { regex?: RegExp; error?: string } {
  const pattern = op.params.pattern || ''
  if (!pattern) return {}
  const flags = op.params.caseInsensitive ? 'gi' : 'g'
  try {
    const source = op.params.useRegex === false ? escapeRegexLiteral(pattern) : pattern
    return { regex: new RegExp(source, flags) }
  } catch (error: any) {
    return { error: error?.message || String(error) }
  }
}

function applyRegexOperation(name: string, op: Operation, ctx: RenameContext): string {
  const { regex } = compileRuleRegex(op)
  if (!regex) return name
  const replacement = applySequenceVariables(op.params.replacement || '', ctx.index)
  return name.replace(regex, replacement)
}

export const operationHandlers: Record<string, OperationHandler> = {
  regex: applyRegexOperation,
}

export function applyOperation(name: string, op: Operation, ctx: RenameContext): string {
  const handler = operationHandlers[op.type]
  return handler ? handler(name, op, ctx) : name
}

function splitName(originalName: string, processFilenameOnly: boolean) {
  if (!processFilenameOnly) {
    return { base: originalName, ext: '' }
  }
  const lastDotIndex = originalName.lastIndexOf('.')
  if (lastDotIndex > 0) {
    return { base: originalName.substring(0, lastDotIndex), ext: originalName.substring(lastDotIndex) }
  }
  return { base: originalName, ext: '' }
}

function isCaseInsensitivePlatform(platform?: TargetPlatform) {
  return platform === 'darwin' || platform === 'win32'
}

/** Check a single proposed filename against the rules of the target platform. */
export function validateFileName(name: string, platform?: TargetPlatform): RenameIssue | undefined {
  if (!name || name === '.' || name === '..' || name.trim() === '') return 'empty-name'
  if (ALWAYS_INVALID.test(name)) return 'invalid-char'
  if (platform === 'win32') {
    if (WINDOWS_INVALID.test(name)) return 'invalid-char'
    if (WINDOWS_RESERVED.test(name)) return 'reserved-name'
    if (/[. ]$/.test(name)) return 'invalid-char'
  }
  if (new TextEncoder().encode(name).length > MAX_NAME_BYTES) return 'too-long'
  return undefined
}

function finalizePreview(
  files: FileItem[],
  names: string[],
  parsed: Array<{ base: string; ext: string }>,
  options: RenameOptions,
  ruleErrors: Record<string, string>
): RenamePreviewResult {
  const caseInsensitive = isCaseInsensitivePlatform(options.platform)
  const keyOf = (file: FileItem, name: string) => {
    const key = `${dirname(file.path)}/${name}`
    return caseInsensitive ? key.toLowerCase() : key
  }

  const finalNames = files.map((_file, index) => {
    const ext = parsed[index].ext
    return options.processFilenameOnly && ext ? names[index] + ext : names[index]
  })

  // Count every target so *all* members of a collision are flagged, not just
  // the second one.
  const targetCounts = new Map<string, number>()
  files.forEach((file, index) => {
    const key = keyOf(file, finalNames[index])
    targetCounts.set(key, (targetCounts.get(key) || 0) + 1)
  })

  let conflictReason: RenameIssue | undefined
  const items: RenamePreviewItem[] = files.map((file, index) => {
    const finalName = finalNames[index]
    const emptyBase = options.processFilenameOnly && parsed[index].ext && names[index].trim() === ''
    let issue: RenameIssue | undefined = emptyBase ? 'empty-name' : validateFileName(finalName, options.platform)
    if (!issue && (targetCounts.get(keyOf(file, finalName)) || 0) > 1) {
      issue = 'duplicate'
    }
    if (issue && !conflictReason) conflictReason = issue
    return { id: file.id, newName: finalName, issue }
  })

  return { items, hasConflicts: Boolean(conflictReason), conflictReason, ruleErrors }
}

/** Preview supporting both built-in rules and plugins. */
export async function generateRenamePreviewAsync(
  files: FileItem[],
  operations: Operation[],
  options: RenameOptions
): Promise<RenamePreviewResult> {
  const ruleErrors: Record<string, string> = {}
  for (const op of operations) {
    if (op.type !== 'regex') continue
    const { error } = compileRuleRegex(op)
    if (error) ruleErrors[op.id] = error
  }

  if (files.length === 0) {
    return { items: [], hasConflicts: false, ruleErrors }
  }

  const enabledOps = operations.filter(op => op.enabled)
  const parsed = files.map(f => splitName(f.originalName, options.processFilenameOnly))
  let currentNames = parsed.map(p => p.base)

  const fileInfos = files.map((file, index) => ({
    id: file.id,
    path: file.path,
    originalName: file.originalName,
    extension: parsed[index].ext,
    index,
    total: files.length,
  }))

  for (const op of enabledOps) {
    if (op.type === 'plugin' && op.params.pluginId) {
      currentNames = await runPluginTransformBatch(op.params.pluginId, currentNames, op.params, fileInfos)
    } else {
      currentNames = currentNames.map((name, index) => applyOperation(name, op, { index }))
    }
  }

  return finalizePreview(files, currentNames, parsed, options, ruleErrors)
}
