<script setup lang="ts">
const props = withDefaults(defineProps<{
  count: number
  currentIndex: number
  variant?: 'progress' | 'tabs'
  ariaLabel?: string
}>(), {
  variant: 'tabs',
  ariaLabel: 'Slides'
})

const emit = defineEmits<{
  select: [index: number]
}>()

function select(index: number) {
  emit('select', index)
}
</script>

<template>
  <div
    :class="variant === 'progress' ? 'slide-progress' : 'slide-tabs'"
    :aria-label="ariaLabel"
  >
    <button
      v-for="index in props.count"
      :key="index"
      type="button"
      :class="variant === 'progress'
        ? { 'is-current': currentIndex === index - 1 }
        : { 'is-selected': currentIndex === index - 1 }"
      :aria-label="`Show slide ${index}`"
      @click="select(index - 1)"
    >
      <template v-if="variant === 'tabs'">
        {{ index }}
      </template>
    </button>
  </div>
</template>
