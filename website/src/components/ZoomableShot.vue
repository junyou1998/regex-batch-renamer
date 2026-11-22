<script setup lang="ts">
import { useLightbox } from '../composables/useLightbox'

/** An app screenshot in a window frame. Click (or Enter) to open it large. */
const props = defineProps<{ src: string; alt: string; tilt?: number }>()
const { open } = useLightbox()

function zoom(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  open({ src: props.src, alt: props.alt, from: el.getBoundingClientRect() }, el)
}
</script>

<template>
  <button type="button" v-tilt="tilt ?? 4" @click="zoom" :aria-label="$t('lightbox.open', { name: alt })"
    class="window-shot group relative block w-full cursor-zoom-in text-left">
    <slot>
      <img :src="src" :alt="alt" loading="lazy" width="2000" height="1250" class="block w-full" />
    </slot>
    <span class="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-ink/75 px-3 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100 translate-y-1">
      <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M8.5 3a5.5 5.5 0 0 1 4.38 8.82l3.65 3.65a.75.75 0 1 1-1.06 1.06l-3.65-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 1.75a.75.75 0 0 1 .75.75v1.25h1.25a.75.75 0 0 1 0 1.5H9.25v1.25a.75.75 0 0 1-1.5 0V9.75H6.5a.75.75 0 0 1 0-1.5h1.25V7a.75.75 0 0 1 .75-.75Z" /></svg>
      {{ $t('lightbox.hint') }}
    </span>
  </button>
</template>
