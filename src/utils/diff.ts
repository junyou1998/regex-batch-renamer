function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case '\'': return '&#39;'
      default: return char
    }
  })
}

export function generateDiffHtml(original: string, modified: string): string {
  if (!original || !modified) return escapeHtml(modified || original || '')

  if (original === modified) return escapeHtml(original)

  let start = 0
  while (start < original.length && start < modified.length && original[start] === modified[start]) {
    start++
  }

  let endOriginal = original.length - 1
  let endModified = modified.length - 1
  while (endOriginal >= start && endModified >= start && original[endOriginal] === modified[endModified]) {
    endOriginal--
    endModified--
  }

  const prefixRaw = original.substring(0, start)
  const suffixRaw = original.substring(endOriginal + 1)

  const removedRaw = original.substring(start, endOriginal + 1)
  const addedRaw = modified.substring(start, endModified + 1)

  let html = escapeHtml(prefixRaw)

  // Improvement: Check if the "removed" part is actually just surrounded by new text (Insertion)
  // This handles cases like: "name" -> "prefix_name_suffix"
  if (removedRaw && addedRaw && addedRaw.includes(removedRaw)) {
    const index = addedRaw.indexOf(removedRaw)
    const addedPrefix = addedRaw.substring(0, index)
    const addedSuffix = addedRaw.substring(index + removedRaw.length)

    if (addedPrefix) {
      html += `<span class="bg-green-100 dark:bg-green-500/30 text-green-700 dark:text-green-200 px-0.5 rounded-sm">${escapeHtml(addedPrefix)}</span>`
    }

    html += escapeHtml(removedRaw)

    if (addedSuffix) {
      html += `<span class="bg-green-100 dark:bg-green-500/30 text-green-700 dark:text-green-200 px-0.5 rounded-sm">${escapeHtml(addedSuffix)}</span>`
    }
  } else {
    // Standard Diff
    if (removedRaw) {
      html += `<span class="bg-red-100 dark:bg-red-500/30 text-red-700 dark:text-red-200 line-through decoration-red-500 dark:decoration-red-400/50 px-0.5 rounded-sm mx-0.5">${escapeHtml(removedRaw)}</span>`
    }
    if (addedRaw) {
      html += `<span class="bg-green-100 dark:bg-green-500/30 text-green-700 dark:text-green-200 px-0.5 rounded-sm">${escapeHtml(addedRaw)}</span>`
    }
  }
  html += escapeHtml(suffixRaw)

  return html
}
