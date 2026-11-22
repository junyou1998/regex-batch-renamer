<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useLightbox } from '../composables/useLightbox'

/**
 * Full-screen viewer for screenshots. The image zooms out of the thumbnail
 * it came from and back into it on close.
 */
const { current, close } = useLightbox()
const imgEl = ref<HTMLImageElement | null>(null)
const closeBtn = ref<HTMLButtonElement | null>(null)
const visible = ref(false)
const style = ref<Record<string, string>>({})

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function transformFrom(rect?: DOMRect) {
  const el = imgEl.value
  if (!rect || !el || reduced()) return 'none'
  const target = el.getBoundingClientRect()
  const scale = rect.width / target.width
  const dx = rect.left + rect.width / 2 - (target.left + target.width / 2)
  const dy = rect.top + rect.height / 2 - (target.top + target.height / 2)
  return `translate(${dx}px, ${dy}px) scale(${scale})`
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') requestClose()
  if (e.key === 'Tab') {
    e.preventDefault()
    closeBtn.value?.focus()
  }
}

function requestClose() {
  if (!current.value) return
  style.value = { transform: transformFrom(current.value.from), transition: 'transform .35s cubic-bezier(.3,.7,.2,1)' }
  visible.value = false
  window.setTimeout(close, reduced() ? 0 : 320)
}

watch(current, async (image) => {
  if (!image) {
    document.removeEventListener('keydown', onKey)
    document.documentElement.style.overflow = ''
    return
  }
  document.documentElement.style.overflow = 'hidden'
  document.addEventListener('keydown', onKey)
  style.value = { transform: 'none', transition: 'none', opacity: '0' }
  await nextTick()
  // Start where the thumbnail is, then animate to the centred, enlarged position.
  style.value = { transform: transformFrom(image.from), transition: 'none' }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      visible.value = true
      style.value = { transform: 'none', transition: 'transform .45s cubic-bezier(.2,.8,.2,1)' }
      closeBtn.value?.focus()
    })
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.documentElement.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="current" class="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-10" role="dialog" aria-modal="true" :aria-label="current.alt"
      @click.self="requestClose">
      <div class="absolute inset-0 bg-ink/80 backdrop-blur-sm transition-opacity duration-300" :class="visible ? 'opacity-100' : 'opacity-0'"
        @click="requestClose" aria-hidden="true" />
      <img ref="imgEl" :src="current.src" :alt="current.alt" :style="style"
        class="relative max-h-full max-w-[min(100%,1600px)] origin-center rounded-xl shadow-[0_40px_120px_-20px_rgba(0,0,0,.6)] ring-1 ring-white/10"
        @click="requestClose" />
      <button ref="closeBtn" type="button" @click="requestClose" :aria-label="$t('lightbox.close')"
        class="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-all duration-300 hover:bg-white/20"
        :class="visible ? 'opacity-100' : 'opacity-0'">
        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4Z" /></svg>
      </button>
    </div>
  </Teleport>
</template>
