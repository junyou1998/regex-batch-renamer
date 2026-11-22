import { ref } from 'vue'

/** Shared open state for the Help & Regex guide, so any screen or shortcut can open it. */
export const isHelpOpen = ref(false)

export function openHelp() {
  isHelpOpen.value = true
}

/** Modifier label for shortcuts shown in the UI (⌘ on macOS, Ctrl elsewhere). */
export const modKey = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl'
