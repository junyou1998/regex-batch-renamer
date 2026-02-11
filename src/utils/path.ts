export function replaceBasename(filePath: string, newName: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  if (lastSlash === -1) return newName
  return `${filePath.slice(0, lastSlash + 1)}${newName}`
}
