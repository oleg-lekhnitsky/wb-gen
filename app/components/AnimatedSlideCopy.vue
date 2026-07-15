<script setup lang="ts">
import { computed } from 'vue'

type HeadingHighlightPreset = 'white-pink' | 'purple-white'
type HeadingHighlight = {
  start: number
  end: number
  preset: HeadingHighlightPreset
}

const props = withDefaults(defineProps<{
  heading: string
  headingHighlights?: HeadingHighlight[]
  headingSize: number
  subheading: string
  subheadingSize: number
  animate?: boolean
}>(), {
  animate: false,
  headingHighlights: () => []
})

type CopyWord = {
  text: string
  start: number
  end: number
  breakAfter: boolean
  highlight?: HeadingHighlightPreset
}

const splitLines = (value: string): string[] => value
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean)

const splitWords = (value: string): CopyWord[] => {
  const words: CopyWord[] = []
  // Split only on breakable spaces. NBSP and narrow NBSP stay inside the
  // animated unit so the browser cannot wrap the connected words apart.
  const pattern = /([^ \t\r\n]+)[ \t]*(\r?\n)?/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value))) {
    const text = match[1]
    if (!text) continue
    const start = match.index
    const end = start + text.length
    words.push({
      text,
      start,
      end,
      breakAfter: Boolean(match[2]),
      highlight: props.headingHighlights.find(highlight => (
        highlight.start < end && highlight.end > start
      ))?.preset
    })
  }

  return words
}

const wordStaggerMs = 25
const subheadingDelayMs = 200

const subheadingLines = computed(() => splitLines(props.subheading))
const headingWords = computed(() => splitWords(props.heading))
const subheadingDelayOffset = computed(() => props.heading ? headingWords.value.length : 0)
</script>

<template>
  <div
    class="slide-copy"
    :class="{ 'has-line-transition': animate }"
  >
    <p
      v-if="subheading"
      class="slide-subheading animated-copy-block"
      :style="{ '--subheading-scale': subheadingSize / 100 }"
    >
      <span
        v-for="(line, index) in subheadingLines"
        :key="`subheading-line-${index}`"
        class="animated-copy-word animated-copy-line"
        :style="{ '--word-delay': `${subheadingDelayMs + (subheadingDelayOffset + index) * wordStaggerMs}ms` }"
      >{{ line }}</span>
    </p>
    <h2
      v-if="heading"
      class="animated-copy-block"
      :style="{ '--heading-scale': headingSize / 100 }"
    >
      <span
        v-for="(word, index) in headingWords"
        :key="`heading-${index}`"
        class="animated-copy-word"
        :class="[
          { 'has-word-gap': !word.breakAfter },
          word.highlight ? `has-heading-highlight--${word.highlight}` : ''
        ]"
        :style="{ '--word-delay': `${index * wordStaggerMs}ms` }"
      >{{ word.text }}<br v-if="word.breakAfter"></span>
    </h2>
  </div>
</template>
