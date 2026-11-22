<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { REPO, SPONSOR_URL } from '../composables/useRelease'
import LangMenu from './LangMenu.vue'

const scrolled = ref(false)
function onScroll() {
  scrolled.value = window.scrollY > 8
}
onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <header class="sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300"
    :class="scrolled ? 'border-b border-line/80 bg-paper/80 shadow-[0_10px_30px_-24px_rgba(14,26,43,.5)] backdrop-blur-xl' : 'border-b border-transparent bg-transparent'">
    <div class="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-8">
      <a href="#top" class="group flex items-center gap-2.5 font-semibold tracking-tight">
        <img src="/app-icon.png" alt="" width="28" height="28" class="rounded-md transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-105" />
        <span class="text-[17px]">Renamix</span>
      </a>
      <nav class="ml-auto flex items-center gap-1 text-[15px] text-slate">
        <a href="#features" class="nav-link hidden md:block">{{ $t('nav.features') }}</a>
        <a href="#download" class="nav-link hidden md:block">{{ $t('nav.download') }}</a>
        <a :href="`https://github.com/${REPO}`" class="nav-link hidden sm:block" rel="noopener">GitHub</a>
        <a :href="SPONSOR_URL" rel="noopener" target="_blank"
          class="sponsor group ml-1 hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink sm:flex">
          <svg class="h-4 w-4 text-rose-500 transition-transform duration-300 group-hover:scale-125" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10 17.3 8.9 16.3C4.9 12.7 2.3 10.3 2.3 7.4A4 4 0 0 1 6.3 3.4c1.4 0 2.7.6 3.7 1.7a5 5 0 0 1 3.7-1.7 4 4 0 0 1 4 4c0 2.9-2.6 5.3-6.6 8.9L10 17.3Z" />
          </svg>
          {{ $t('nav.support') }}
        </a>
        <LangMenu class="ml-1" />
      </nav>
    </div>
  </header>
</template>

<style scoped>
.nav-link {
  position: relative;
  border-radius: 6px;
  padding: 0.375rem 0.75rem;
  transition: color 0.2s ease;
}

.nav-link::after {
  content: '';
  position: absolute;
  left: 0.75rem;
  right: 0.75rem;
  bottom: 0.2rem;
  height: 1.5px;
  border-radius: 1px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.25s ease;
}

.nav-link:hover {
  color: var(--color-ink);
}

.nav-link:hover::after {
  transform: scaleX(1);
}

.sponsor {
  background: linear-gradient(white, white) padding-box,
    linear-gradient(120deg, #fda4af, #fbcfe8, #bfdbfe) border-box;
  border: 1px solid transparent;
  transition: box-shadow 0.25s ease, transform 0.2s ease;
}

.sponsor:hover {
  box-shadow: 0 8px 22px -12px rgba(244, 63, 94, 0.55);
  transform: translateY(-1px);
}
</style>
