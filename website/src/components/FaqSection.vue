<script setup lang="ts">
import { ref } from 'vue'

const openIndex = ref<number | null>(null)
function toggle(n: number) {
  openIndex.value = openIndex.value === n ? null : n
}
</script>

<template>
  <section class="border-t border-line bg-white" aria-labelledby="faq-title">
    <div class="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_2fr]">
      <h2 v-reveal id="faq-title" class="text-3xl font-semibold tracking-[-0.02em]">{{ $t('faq.title') }}</h2>
      <div v-reveal="100" class="divide-y divide-line border-y border-line">
        <div v-for="n in 6" :key="n">
          <h3>
            <button type="button" @click="toggle(n)" :aria-expanded="openIndex === n" :aria-controls="`faq-${n}`"
              class="flex w-full items-center justify-between gap-4 py-5 text-left text-[17px] font-medium transition-colors hover:text-signal">
              {{ $t(`faq.q${n}.q`) }}
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line transition-all duration-300"
                :class="openIndex === n ? 'rotate-45 border-signal bg-signal text-white' : 'text-slate'">
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1Z" /></svg>
              </span>
            </button>
          </h3>
          <!-- grid-rows trick: animates to the content's natural height -->
          <div :id="`faq-${n}`" role="region" class="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
            :class="openIndex === n ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'">
            <div class="overflow-hidden">
              <p class="max-w-[60ch] pb-5 text-[15px] leading-relaxed text-slate">{{ $t(`faq.q${n}.a`) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
