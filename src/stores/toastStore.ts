import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
    id: string
    message: string
    type?: 'success' | 'error' | 'info'
    duration?: number
}

export const useToastStore = defineStore('toast', () => {
    const toasts = ref<Toast[]>([])

    function addToast(message: string, type: Toast['type'] = 'info', duration = 3000) {
        const id = Date.now().toString()
        toasts.value.push({ id, message, type, duration })

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id)
            }, duration)
        }
    }

    function removeToast(id: string) {
        const index = toasts.value.findIndex(t => t.id === id)
        if (index !== -1) {
            toasts.value.splice(index, 1)
        }
    }

    return {
        toasts,
        addToast,
        removeToast
    }
})
