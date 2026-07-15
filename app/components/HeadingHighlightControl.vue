<script setup lang="ts">
import { computed, ref } from 'vue'

type HeadingHighlightPreset = 'white-pink' | 'purple-white'
type HeadingHighlight = {
  start: number
  end: number
  preset: HeadingHighlightPreset
}

const props = withDefaults(defineProps<{
  heading: string
  highlights?: HeadingHighlight[]
}>(), {
  highlights: () => []
})

const emit = defineEmits<{
  'update:heading': [value: string]
  'update:highlights': [value: HeadingHighlight[]]
}>()

const input = ref<HTMLInputElement | null>(null)
const selectionStart = ref(0)
const selectionEnd = ref(0)
const hasSelection = computed(() => selectionEnd.value > selectionStart.value)

function rememberSelection() {
  selectionStart.value = input.value?.selectionStart || 0
  selectionEnd.value = input.value?.selectionEnd || selectionStart.value
}

function isBreakableSpace(character: string) {
  return character === ' '
    || character === '\t'
    || character === '\r'
    || character === '\n'
}

function mergeHighlights(highlights: HeadingHighlight[]) {
  const sorted = [...highlights]
    .filter(highlight => highlight.end > highlight.start)
    .sort((a, b) => a.start - b.start)
  const merged: HeadingHighlight[] = []

  for (const highlight of sorted) {
    const previous = merged.at(-1)
    if (previous && previous.preset === highlight.preset && previous.end >= highlight.start) {
      previous.end = Math.max(previous.end, highlight.end)
    } else {
      merged.push({ ...highlight })
    }
  }

  return merged
}

function selectedWordRange() {
  let start = selectionStart.value
  let end = selectionEnd.value

  while (start < end && isBreakableSpace(props.heading[start] || '')) start += 1
  while (end > start && isBreakableSpace(props.heading[end - 1] || '')) end -= 1
  while (start > 0 && !isBreakableSpace(props.heading[start - 1] || '')) start -= 1
  while (end < props.heading.length && !isBreakableSpace(props.heading[end] || '')) end += 1

  return { start, end }
}

function removeRange(start: number, end: number) {
  return props.highlights.flatMap((highlight) => {
    if (highlight.end <= start || highlight.start >= end) return [{ ...highlight }]

    const remaining: HeadingHighlight[] = []
    if (highlight.start < start) remaining.push({ ...highlight, end: start })
    if (highlight.end > end) remaining.push({ ...highlight, start: end })
    return remaining
  })
}

function restoreSelection(start: number, end: number) {
  requestAnimationFrame(() => {
    input.value?.focus()
    input.value?.setSelectionRange(start, end)
  })
}

function applyPreset(preset: HeadingHighlightPreset) {
  const { start, end } = selectedWordRange()
  if (end <= start) return

  emit('update:highlights', mergeHighlights([
    ...removeRange(start, end),
    { start, end, preset }
  ]))
  restoreSelection(start, end)
}

function clearHighlight() {
  const { start, end } = selectedWordRange()
  if (end <= start) return
  emit('update:highlights', mergeHighlights(removeRange(start, end)))
  restoreSelection(start, end)
}

function updateHeading(nextHeading: string) {
  const previousHeading = props.heading
  let prefix = 0
  while (
    prefix < previousHeading.length
    && prefix < nextHeading.length
    && previousHeading[prefix] === nextHeading[prefix]
  ) prefix += 1

  let suffix = 0
  while (
    suffix < previousHeading.length - prefix
    && suffix < nextHeading.length - prefix
    && previousHeading[previousHeading.length - 1 - suffix]
      === nextHeading[nextHeading.length - 1 - suffix]
  ) suffix += 1

  const oldChangeEnd = previousHeading.length - suffix
  const newChangeEnd = nextHeading.length - suffix
  const difference = newChangeEnd - oldChangeEnd
  const adjusted = props.highlights.flatMap((highlight) => {
    if (highlight.end <= prefix) return [{ ...highlight }]
    if (highlight.start >= oldChangeEnd) {
      return [{
        ...highlight,
        start: highlight.start + difference,
        end: highlight.end + difference
      }]
    }
    return []
  })

  emit('update:heading', nextHeading)
  emit('update:highlights', mergeHighlights(adjusted))
}
</script>

<template>
  <div class="heading-highlight-control">
    <div class="control-field">
      <label for="heading">Heading <span>optional</span></label>
      <input
        id="heading"
        ref="input"
        :value="heading"
        placeholder="Add heading"
        @input="updateHeading(($event.target as HTMLInputElement).value)"
        @select="rememberSelection"
        @keyup="rememberSelection"
        @pointerup="rememberSelection"
      >
    </div>

    <div class="heading-highlight-control__presets">
      <span>Highlight selected words</span>
      <div class="heading-highlight-control__actions">
        <button
          type="button"
          class="heading-highlight-preset heading-highlight-preset--white-pink"
          :disabled="!hasSelection"
          aria-label="White highlight with pink text"
          title="White highlight / pink text"
          @pointerdown.prevent
          @click="applyPreset('white-pink')"
        >
          Aa
        </button>
        <button
          type="button"
          class="heading-highlight-preset heading-highlight-preset--purple-white"
          :disabled="!hasSelection"
          aria-label="Purple highlight with white text"
          title="Purple highlight / white text"
          @pointerdown.prevent
          @click="applyPreset('purple-white')"
        >
          Aa
        </button>
        <button
          type="button"
          class="button button--ghost button--sm heading-highlight-clear"
          :disabled="!hasSelection"
          @pointerdown.prevent
          @click="clearHighlight"
        >
          Clear
        </button>
      </div>
    </div>
  </div>
</template>
