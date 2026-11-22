<script setup lang="ts">
import SiteHeader from './components/SiteHeader.vue'
import HeroSection from './components/HeroSection.vue'
import PlaygroundSection from './components/PlaygroundSection.vue'
import FeatureRows from './components/FeatureRows.vue'
import StepsSection from './components/StepsSection.vue'
import DownloadSection from './components/DownloadSection.vue'
import FaqSection from './components/FaqSection.vue'
import SiteFooter from './components/SiteFooter.vue'
</script>

<template>
  <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2">{{ $t('nav.skip') }}</a>
  <SiteHeader />
  <main id="main">
    <HeroSection />
    <PlaygroundSection />
    <FeatureRows />
    <StepsSection />
    <DownloadSection />
    <FaqSection />
  </main>
  <SiteFooter />
</template>
