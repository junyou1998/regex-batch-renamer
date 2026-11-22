<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LOCALES, setLocale, type SiteLocale } from '../i18n'

/** Language picker: an accessible listbox with keyboard support, styled to match the site. */
const { locale } = useI18n()
const open = ref(false)
const active = ref(0)
const root = ref<HTMLElement | null>(null)
const items = ref<HTMLElement[]>([])

const current = computed(() => LOCALES.find((l) => l.code === locale.value) ?? LOCALES[0]!)

function toggle() {
  open.value = !open.value
}

function choose(code: SiteLocale) {
  setLocale(code)
  open.value = false
}

function onKey(e: KeyboardEvent) {
  if (!open.value && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault()
    open.value = true
    return
  }
  if (!open.value) return
  if (e.key === 'Escape') {
    open.value = false
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = (active.value + (e.key === 'ArrowDown' ? 1 : -1) + LOCALES.length) % LOCALES.length
    items.value[active.value]?.focus()
  }
}

function onOutside(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false
}

watch(open, async (value) => {
  if (value) {
    active.value = Math.max(0, LOCALES.findIndex((l) => l.code === locale.value))
    document.addEventListener('pointerdown', onOutside)
    await nextTick()
    items.value[active.value]?.focus()
  } else {
    document.removeEventListener('pointerdown', onOutside)
  }
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))
</script>

<template>
  <div ref="root" class="relative" @keydown="onKey">
    <button type="button" @click="toggle" :aria-expanded="open" aria-haspopup="listbox" :aria-label="$t('nav.language')"
      class="flex items-center gap-2 rounded-full border border-line bg-white/80 py-1.5 pl-3 pr-2.5 text-sm text-ink transition-colors hover:border-slate/40">
      <svg class="h-4 w-4 text-slate" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <circle cx="10" cy="10" r="7.25" /><path d="M2.75 10h14.5M10 2.75c2 2 3 4.5 3 7.25s-1 5.25-3 7.25c-2-2-3-4.5-3-7.25s1-5.25 3-7.25Z" />
      </svg>
      <span>{{ current.label }}</span>
      <svg class="h-3.5 w-3.5 text-slate transition-transform duration-200" :class="{ 'rotate-180': open }" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
      </svg>
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out" enter-from-class="opacity-0 -translate-y-1 scale-95"
      leave-active-class="transition duration-100 ease-in" leave-to-class="opacity-0 -translate-y-1 scale-95">
      <ul v-if="open" role="listbox" :aria-activedescendant="`lang-${LOCALES[active]?.code ?? 'en'}`"
        class="absolute right-0 mt-2 w-44 origin-top-right rounded-xl border border-line bg-white p-1 shadow-[0_18px_40px_-16px_rgba(14,26,43,.35)]">
        <li v-for="(l, i) in LOCALES" :key="l.code" role="presentation">
          <button :id="`lang-${l.code}`" :ref="(el) => { if (el) items[i] = el as HTMLElement }" type="button" role="option"
            :aria-selected="l.code === locale" @click="choose(l.code)"
            class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-paper focus-visible:bg-paper"
            :class="l.code === locale ? 'font-medium text-ink' : 'text-slate'">
            {{ l.label }}
            <svg v-if="l.code === locale" class="h-4 w-4 text-signal" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" /></svg>
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>
