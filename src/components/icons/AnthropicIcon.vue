<template>
  <svg viewBox="0 0 24 24" fill="currentColor" :class="className">
    <!-- Official Anthropic geometric diagonal marks -->
    <path d="M13.827 3.5h3.696L24 20.5h-3.696l-6.477-17zm-7.348 0h3.696L16.652 20.5h-3.696L11.5 16.5H6.5l-1.45 4H1.354L7.833 3.5zm2.144 9.5h3.046L11.5 8.7 9.977 13z" />
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  className?: string
}>()
</script>
