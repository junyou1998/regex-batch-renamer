import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'

export type OperationType = 'regex' | 'numbering'

export interface Operation {
  id: string
  type: OperationType
  enabled: boolean
  params: Record<string, any>
}

export const useOperationStore = defineStore('operation', () => {
  const operations = ref<Operation[]>([])

  function addOperation(type: OperationType, params: Record<string, any> = {}) {
    operations.value.push({
      id: uuidv4(),
      type,
      enabled: true,
      params
    })
  }

  function removeOperation(id: string) {
    operations.value = operations.value.filter(op => op.id !== id)
  }

  function updateOperation(id: string, params: Record<string, any>) {
    const op = operations.value.find(o => o.id === id)
    if (op) {
      op.params = { ...op.params, ...params }
    }
  }

  function moveOperation(id: string, direction: 'up' | 'down') {
    const index = operations.value.findIndex(op => op.id === id)
    if (index === -1) return

    const newOperations = [...operations.value]

    if (direction === 'up' && index > 0) {
      [newOperations[index], newOperations[index - 1]] = [newOperations[index - 1], newOperations[index]]
      operations.value = newOperations
    } else if (direction === 'down' && index < operations.value.length - 1) {
      [newOperations[index], newOperations[index + 1]] = [newOperations[index + 1], newOperations[index]]
      operations.value = newOperations
    }
  }

  function toggleOperation(id: string) {
    const op = operations.value.find(o => o.id === id)
    if (op) {
      op.enabled = !op.enabled
    }
  }

  function getSnapshot(): { type: string; params: Record<string, any> }[] {
    return operations.value.map(op => ({
      type: op.type,
      params: { ...op.params },
    }))
  }

  function loadFromPreset(presetOps: { type: string; params: Record<string, any> }[]) {
    operations.value = presetOps.map(op => ({
      id: uuidv4(),
      type: op.type as OperationType,
      enabled: true,
      params: { ...op.params },
    }))
  }

  return {
    operations,
    addOperation,
    removeOperation,
    updateOperation,
    moveOperation,
    toggleOperation,
    getSnapshot,
    loadFromPreset
  }
})
