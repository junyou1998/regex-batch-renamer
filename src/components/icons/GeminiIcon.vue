<script setup lang="ts">
defineProps<{
  className?: string
}>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    :class="className || 'w-4 h-4'"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z"
    />
  </svg>
</template>
