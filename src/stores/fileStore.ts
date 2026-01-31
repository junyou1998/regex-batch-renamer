import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface FileItem {
  id: string
  originalName: string
  path: string
  newName: string
  status: 'idle' | 'pending' | 'success' | 'error'
  errorMessage?: string
}

export const useFileStore = defineStore('file', () => {
  const files = ref<FileItem[]>([])

  function addFiles(newFiles: FileItem[]) {
    // Prevent duplicates based on path
    const existingPaths = new Set(files.value.map(f => f.path))
    const uniqueFiles = newFiles.filter(f => !existingPaths.has(f.path))
    files.value.push(...uniqueFiles)
  }

  function removeFile(id: string) {
    files.value = files.value.filter(f => f.id !== id)
  }

  function clearFiles() {
    files.value = []
  }

  function updateFileStatus(id: string, status: FileItem['status'], errorMessage?: string) {
    const file = files.value.find(f => f.id === id)
    if (file) {
      file.status = status
      if (errorMessage) {
        file.errorMessage = errorMessage
      }
    }
  }

  function updateNewName(id: string, newName: string) {
    const file = files.value.find(f => f.id === id)
    if (file) {
      file.newName = newName
    }
  }

  function updateFileAfterRename(id: string, newPath: string, newName: string) {
    const file = files.value.find(f => f.id === id)
    if (file) {
      file.originalName = newName
      file.path = newPath
      file.newName = newName
      file.status = 'pending'
      file.errorMessage = undefined
    }
  }

  function reorderFiles(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= files.value.length || toIndex < 0 || toIndex >= files.value.length) return
    const [movedItem] = files.value.splice(fromIndex, 1)
    files.value.splice(toIndex, 0, movedItem)
  }

  return {
    files,
    addFiles,
    removeFile,
    clearFiles,
    updateFileStatus,
    updateNewName,
    updateFileAfterRename,
    reorderFiles
  }
})
