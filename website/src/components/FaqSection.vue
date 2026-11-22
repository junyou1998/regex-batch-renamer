<template>
  <section class="border-t border-line bg-white" aria-labelledby="faq-title">
    <div class="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_2fr]">
      <h2 id="faq-title" class="text-3xl font-semibold tracking-[-0.02em]">{{ $t('faq.title') }}</h2>
      <div class="divide-y divide-line border-y border-line">
        <details v-for="n in 6" :key="n" class="group py-5">
          <summary class="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-medium">
            {{ $t(`faq.q${n}.q`) }}
            <svg class="h-5 w-5 shrink-0 text-slate transition-transform group-open:rotate-45" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1Z" /></svg>
          </summary>
          <p class="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-slate">{{ $t(`faq.q${n}.a`) }}</p>
        </details>
      </div>
    </div>
  </section>
</template>
