<script setup lang="ts">
const props = withDefaults(defineProps<{
  count: number
  currentIndex: number
  ariaLabel?: string
}>(), {
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
    class="slide-tabs"
    :aria-label="ariaLabel"
  >
    <button
      v-for="index in props.count"
      :key="index"
      type="button"
      :class="{ 'is-selected': currentIndex === index - 1 }"
      :aria-label="`Show slide ${index}`"
      @click="select(index - 1)"
    >
      {{ index }}
    </button>
  </div>
</template>
