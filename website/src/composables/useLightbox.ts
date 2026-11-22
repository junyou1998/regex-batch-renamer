import { ref } from 'vue'

export interface LightboxImage {
  src: string
  alt: string
  /** Where the thumbnail was, so the viewer can zoom out of it. */
  from?: DOMRect
}

const current = ref<LightboxImage | null>(null)
let opener: HTMLElement | null = null

/** One shared image viewer for every screenshot on the page. */
export function useLightbox() {
  function open(image: LightboxImage, trigger?: HTMLElement) {
    opener = trigger ?? (document.activeElement as HTMLElement | null)
    current.value = image
  }

  function close() {
    current.value = null
    opener?.focus()
    opener = null
  }

  return { current, open, close }
}
