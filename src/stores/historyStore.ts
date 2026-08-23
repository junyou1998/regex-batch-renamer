import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'

export interface RenameFileLog {
  id: string
  oldPath: string
  newPath: string
  originalName: string
  newName: string
  status: 'success' | 'failed' | 'conflict' | 'undone'
  error?: string
}

export interface RenameBatchLog {
  id: string
  timestamp: number
  action: 'rename' | 'copy' | 'undo'
  totalFiles: number
  successCount: number
  failedCount: number
  conflictCount: number
  rulesSnapshot?: Array<{ type: string; enabled?: boolean; params: Record<string, any> }>
  files: RenameFileLog[]
}

import { desktop } from '../services/desktop'

const STORAGE_KEY = 'regex-batch-renamer:history-logs'
const MAX_BATCHES = 50

export const useHistoryStore = defineStore('history', () => {
  const batches = ref<RenameBatchLog[]>([])

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        batches.value = JSON.parse(raw)
      }
    } catch (e) {
      console.error('Failed to load history logs:', e)
    }
  }

  function saveToStorage() {
    try {
      if (batches.value.length > MAX_BATCHES) {
        batches.value = batches.value.slice(0, MAX_BATCHES)
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(batches.value))
    } catch (e) {
      console.error('Failed to save history logs:', e)
    }
  }

  function addBatchLog(data: Omit<RenameBatchLog, 'id' | 'timestamp'>): RenameBatchLog {
    const newBatch: RenameBatchLog = {
      id: uuidv4(),
      timestamp: Date.now(),
      ...data,
    }
    batches.value.unshift(newBatch)
    saveToStorage()
    return newBatch
  }

  function deleteBatch(id: string) {
    batches.value = batches.value.filter(b => b.id !== id)
    saveToStorage()
  }

  function clearHistory() {
    batches.value = []
    saveToStorage()
  }

  async function exportAsJson(batch?: RenameBatchLog): Promise<string | null> {
    const dataToExport = batch ? [batch] : batches.value
    const jsonStr = JSON.stringify(dataToExport, null, 2)
    const defaultName = `renamer-history-${Date.now()}.json`

    if (desktop.saveTextFile) {
      try {
        const savedPath = await desktop.saveTextFile(jsonStr, {
          defaultPath: defaultName,
          filters: [{ name: 'JSON', extensions: ['json'] }]
        })
        if (savedPath) {
          return savedPath
        }
        return null
      } catch (e) {
        console.error('Tauri saveTextFile failed, falling back to browser download:', e)
      }
    }

    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = defaultName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return defaultName
  }

  async function exportAsCsv(batch?: RenameBatchLog): Promise<string | null> {
    const targetBatches = batch ? [batch] : batches.value
    const rows = [
      ['Batch ID', 'Timestamp', 'Action', 'File ID', 'Original Name', 'New Name', 'Status', 'Error', 'Old Path', 'New Path'].join(',')
    ]

    for (const b of targetBatches) {
      const dateStr = new Date(b.timestamp).toISOString()
      for (const f of b.files) {
        const escapeCsv = (str: string = '') => `"${str.replace(/"/g, '""')}"`
        rows.push([
          escapeCsv(b.id),
          escapeCsv(dateStr),
          escapeCsv(b.action),
          escapeCsv(f.id),
          escapeCsv(f.originalName),
          escapeCsv(f.newName),
          escapeCsv(f.status),
          escapeCsv(f.error || ''),
          escapeCsv(f.oldPath),
          escapeCsv(f.newPath)
        ].join(','))
      }
    }

    const csvContent = '\uFEFF' + rows.join('\n')
    const defaultName = `renamer-history-${Date.now()}.csv`

    if (desktop.saveTextFile) {
      try {
        const savedPath = await desktop.saveTextFile(csvContent, {
          defaultPath: defaultName,
          filters: [{ name: 'CSV', extensions: ['csv'] }]
        })
        if (savedPath) {
          return savedPath
        }
        return null
      } catch (e) {
        console.error('Tauri saveTextFile failed, falling back to browser download:', e)
      }
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = defaultName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return defaultName
  }

  // Load from local storage on store creation
  loadFromStorage()

  return {
    batches,
    addBatchLog,
    deleteBatch,
    clearHistory,
    exportAsJson,
    exportAsCsv
  }
})
