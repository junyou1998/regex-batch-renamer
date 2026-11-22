<script setup lang="ts">
import { REPO } from '../composables/useRelease'
const year = new Date().getFullYear()
</script>

<template>
  <footer class="bg-ink text-white/70">
    <div class="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-14 sm:px-8 md:flex-row md:items-center md:justify-between">
      <div>
        <div class="flex items-center gap-2.5 text-white">
          <img src="/app-icon.png" alt="" width="28" height="28" class="rounded-md" />
          <span class="text-[17px] font-semibold">Renamix</span>
        </div>
        <p class="mt-3 max-w-sm text-sm leading-relaxed">{{ $t('footer.tagline') }}</p>
      </div>
      <nav class="flex flex-wrap gap-x-6 gap-y-2 text-sm" :aria-label="$t('footer.links')">
        <a :href="`https://github.com/${REPO}`" class="hover:text-white" rel="noopener">{{ $t('footer.source') }}</a>
        <a href="https://github.com/junyou1998/renamix-plugins" class="hover:text-white" rel="noopener">{{ $t('footer.plugins') }}</a>
        <a :href="`https://github.com/${REPO}/issues`" class="hover:text-white" rel="noopener">{{ $t('footer.feedback') }}</a>
        <a href="https://www.buymeacoffee.com/junyou" class="hover:text-white" rel="noopener">{{ $t('footer.coffee') }}</a>
      </nav>
    </div>
    <div class="border-t border-white/10">
      <p class="mx-auto max-w-6xl px-5 py-5 text-xs text-white/50 sm:px-8">© {{ year }} Renamix. {{ $t('footer.license') }}</p>
    </div>
  </footer>
</template>
