import { onUnmounted, watch, type Ref } from 'vue'

/**
 * Close a dialog with Escape while it is open. Only the most recently opened
 * dialog reacts, so nested dialogs close one at a time.
 */
const stack: symbol[] = []

export function useEscapeToClose(isOpen: Ref<boolean> | (() => boolean), close: () => void) {
  const id = Symbol('dialog')
  const read = typeof isOpen === 'function' ? isOpen : () => isOpen.value

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    if (stack[stack.length - 1] !== id) return
    event.preventDefault()
    close()
  }

  function detach() {
    const index = stack.indexOf(id)
    if (index >= 0) stack.splice(index, 1)
    window.removeEventListener('keydown', onKeydown)
  }

  watch(read, (open) => {
    if (open) {
      stack.push(id)
      window.addEventListener('keydown', onKeydown)
    } else {
      detach()
    }
  }, { immediate: true })

  onUnmounted(detach)
}
