export function replaceBasename(filePath: string, newName: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  if (lastSlash === -1) return newName
  return `${filePath.slice(0, lastSlash + 1)}${newName}`
}

export function dirname(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return lastSlash === -1 ? '' : filePath.slice(0, lastSlash)
}

export function joinPath(dir: string, name: string): string {
  const separator = dir.includes('\\') && !dir.includes('/') ? '\\' : '/'
  return dir.endsWith('/') || dir.endsWith('\\') ? `${dir}${name}` : `${dir}${separator}${name}`
}
