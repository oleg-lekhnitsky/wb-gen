<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

defineProps<{
  status: 'idle' | 'copying' | 'copied' | 'error'
}>()

const emit = defineEmits<{
  copy: []
}>()

function hasNativeCopyTarget(target: EventTarget | null) {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) return true
  return target instanceof HTMLElement && target.isContentEditable
}

function handleKeydown(event: KeyboardEvent) {
  const selection = window.getSelection()?.toString() || ''
  if (
    event.key.toLowerCase() !== 'c'
    || (!event.metaKey && !event.ctrlKey)
    || event.shiftKey
    || event.altKey
    || event.repeat
    || hasNativeCopyTarget(event.target)
    || selection.length > 0
  ) return

  event.preventDefault()
  emit('copy')
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="copy-slide-png">
    <button
      type="button"
      class="button button--outline button--compact button--block"
      :disabled="status === 'copying'"
      @click="emit('copy')"
    >
      <span>
        {{ status === 'copying'
          ? 'Copying PNG…'
          : status === 'copied'
            ? 'PNG copied'
            : 'Copy PNG' }}
      </span>
      <kbd>⌘C</kbd>
    </button>
    <small v-if="status === 'error'" role="alert">
      Could not copy the PNG. Allow clipboard access and try again.
    </small>
    <span v-else-if="status === 'copied'" class="visually-hidden" role="status">
      Current slide PNG copied to the clipboard.
    </span>
  </div>
</template>
