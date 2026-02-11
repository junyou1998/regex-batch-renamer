import type { FileItem } from '../stores/fileStore'
import type { Operation } from '../stores/operationStore'

export type RenameIssue = 'invalid-char' | 'duplicate'

export interface RenamePreviewItem {
  id: string
  newName: string
  issue?: RenameIssue
}

export interface RenamePreviewResult {
  items: RenamePreviewItem[]
  hasConflicts: boolean
  conflictReason?: RenameIssue
}

export interface RenameContext {
  index: number
}

export type OperationHandler = (name: string, op: Operation, ctx: RenameContext) => string

const INVALID_FILENAME_REGEX = /[<>:"/\\|?*\x00-\x1F]/
const SEQUENCE_REGEX = /\$\{n(?::(\d+)(?::(\d+))?)?\}/g

function escapeRegexLiteral(pattern: string): string {
  return pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function applySequenceVariables(input: string, index: number): string {
  return input.replace(SEQUENCE_REGEX, (_match, width, start) => {
    const padding = width ? parseInt(width, 10) : 0
    const startNum = start !== undefined ? parseInt(start, 10) : 1
    const currentNum = index + startNum
    return currentNum.toString().padStart(padding, '0')
  })
}

function applyRegexOperation(name: string, op: Operation, ctx: RenameContext): string {
  const pattern = op.params.pattern || ''
  if (!pattern) return name

  const replacement = op.params.replacement || ''

  try {
    const regex = op.params.useRegex === false
      ? new RegExp(escapeRegexLiteral(pattern), 'g')
      : new RegExp(pattern, 'g')

    const finalReplacement = applySequenceVariables(replacement, ctx.index)
    return name.replace(regex, finalReplacement)
  } catch {
    return name
  }
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
    return {
      base: originalName.substring(0, lastDotIndex),
      ext: originalName.substring(lastDotIndex),
    }
  }

  return { base: originalName, ext: '' }
}

export function generateRenamePreview(
  files: FileItem[],
  operations: Operation[],
  options: { processFilenameOnly: boolean }
): RenamePreviewResult {
  const enabledOps = operations.filter(op => op.enabled)
  const generatedNames = new Set<string>()
  const items: RenamePreviewItem[] = []
  let conflictReason: RenameIssue | undefined

  files.forEach((file, index) => {
    const { base, ext } = splitName(file.originalName, options.processFilenameOnly)
    let currentName = base

    for (const op of enabledOps) {
      currentName = applyOperation(currentName, op, { index })
    }

    if (options.processFilenameOnly && ext) {
      currentName += ext
    }

    let issue: RenameIssue | undefined
    if (INVALID_FILENAME_REGEX.test(currentName)) {
      issue = 'invalid-char'
      conflictReason = issue
    } else if (generatedNames.has(currentName)) {
      issue = 'duplicate'
      conflictReason = issue
    } else {
      generatedNames.add(currentName)
    }

    items.push({ id: file.id, newName: currentName, issue })
  })

  return {
    items,
    hasConflicts: Boolean(conflictReason),
    conflictReason,
  }
}
