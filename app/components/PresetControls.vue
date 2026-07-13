<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  filenamePrefix: string
  createPreset: () => unknown
}>()

const emit = defineEmits<{
  import: [value: unknown]
  error: [message: string]
}>()

const presetInput = ref<HTMLInputElement | null>(null)

function sanitizeFilename(value: string) {
  return value.trim().replace(/[^\w-]+/g, '-') || 'slot-animation'
}

function exportPreset() {
  const json = JSON.stringify(props.createPreset(), null, 2)
  const prefix = sanitizeFilename(props.filenamePrefix)
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${prefix}-preset.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function choosePresetFile() {
  presetInput.value?.click()
}

async function importPreset(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    emit('import', JSON.parse(await file.text()))
  } catch {
    emit('error', 'Preset file is not valid JSON.')
  }
}
</script>

<template>
  <div class="asset-control">
    <button type="button" class="button button--outline upload-button" @click="exportPreset">
      Export preset
    </button>
    <button type="button" class="button button--outline upload-button" @click="choosePresetFile">
      Import preset
    </button>
    <input
      ref="presetInput"
      class="visually-hidden"
      type="file"
      accept="application/json,.json"
      @change="importPreset"
    >
  </div>
</template>
