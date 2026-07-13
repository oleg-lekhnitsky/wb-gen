<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

const emit = defineEmits<{
  undo: []
}>()

function hasNativeUndo(target: EventTarget | null) {
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLElement && target.isContentEditable) return true
  if (!(target instanceof HTMLInputElement)) return false

  return !['button', 'checkbox', 'color', 'file', 'radio', 'range', 'reset', 'submit'].includes(target.type)
}

function handleKeydown(event: KeyboardEvent) {
  if (
    event.key.toLowerCase() !== 'z'
    || (!event.metaKey && !event.ctrlKey)
    || event.shiftKey
    || event.altKey
    || hasNativeUndo(event.target)
  ) return

  event.preventDefault()
  emit('undo')
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <span hidden />
</template>
