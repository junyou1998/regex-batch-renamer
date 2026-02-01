export function generateDiffHtml(original: string, modified: string): string {
  if (!original || !modified) return modified || original || '';

  if (original === modified) return original;


  let start = 0;
  while (start < original.length && start < modified.length && original[start] === modified[start]) {
    start++;
  }


  let endOriginal = original.length - 1;
  let endModified = modified.length - 1;
  while (endOriginal >= start && endModified >= start && original[endOriginal] === modified[endModified]) {
    endOriginal--;
    endModified--;
  }

  const prefix = original.substring(0, start);
  const suffix = original.substring(endOriginal + 1);

  const removed = original.substring(start, endOriginal + 1);
  const added = modified.substring(start, endModified + 1);

  let html = prefix;

  // Improvement: Check if the "removed" part is actually just surrounded by new text (Insertion)
  // This handles cases like: "name" -> "prefix_name_suffix"
  if (removed && added && added.includes(removed)) {

    const index = added.indexOf(removed);
    const addedPrefix = added.substring(0, index);
    const addedSuffix = added.substring(index + removed.length);

    if (addedPrefix) {
      html += `<span class="bg-green-100 dark:bg-green-500/30 text-green-700 dark:text-green-200 px-0.5 rounded-sm">${addedPrefix}</span>`;
    }

    html += removed;

    if (addedSuffix) {
      html += `<span class="bg-green-100 dark:bg-green-500/30 text-green-700 dark:text-green-200 px-0.5 rounded-sm">${addedSuffix}</span>`;
    }
  } else {
    // Standard Diff
    if (removed) {
      html += `<span class="bg-red-100 dark:bg-red-500/30 text-red-700 dark:text-red-200 line-through decoration-red-500 dark:decoration-red-400/50 px-0.5 rounded-sm mx-0.5">${removed}</span>`;
    }
    if (added) {
      html += `<span class="bg-green-100 dark:bg-green-500/30 text-green-700 dark:text-green-200 px-0.5 rounded-sm">${added}</span>`;
    }
  }
  html += suffix;

  return html;
}
