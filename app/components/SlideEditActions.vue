<script setup lang="ts">
const props = defineProps<{
  slideCount: number
  selectedIndex: number
}>()

const emit = defineEmits<{
  insert: [index: number]
  remove: []
}>()

function insertBeforeSelected() {
  emit('insert', Math.min(props.selectedIndex, props.slideCount - 1))
}

function insertAfterSelected() {
  emit('insert', Math.min(props.selectedIndex + 1, props.slideCount))
}
</script>

<template>
  <div class="button-group slide-edit-actions">
    <button
      type="button"
      class="button button--outline button--compact insert-slide-button"
      :disabled="slideCount >= 20"
      @click="insertBeforeSelected"
    >
      Insert before
    </button>

    <button
      type="button"
      class="button button--outline button--compact insert-slide-button"
      :disabled="slideCount >= 20"
      @click="insertAfterSelected"
    >
      Insert after
    </button>

    <button
      type="button"
      class="button button--danger button--compact remove-slide-button"
      :disabled="slideCount <= 1"
      @click="emit('remove')"
    >
      Remove
    </button>
  </div>
</template>
