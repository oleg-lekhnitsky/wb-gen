<script setup lang="ts">
import RelativeText from '~/components/RelativeText.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { copyAnimationTiming, copyLineIndices } from '~/utils/copy-animation'
import AutoScaleHeading from '~/components/AutoScaleHeading.vue'

type HeadingHighlightPreset = 'white-pink' | 'purple-white'
type HeadingHighlight = {
  start: number
  end: number
  preset: HeadingHighlightPreset
}

const props = withDefaults(defineProps<{
  heading: string
  headingHighlights?: HeadingHighlight[]
  textAlign?: 'left' | 'center'
  headingSize: number
  headingAutoScale?: boolean
  subheading: string
  subheadingSize: number
  subheadingRelative?: boolean
  subheadingHeadingRatio?: number
  animate?: boolean
  transitionSeconds?: number
}>(), {
  animate: false,
  transitionSeconds: .65,
  headingAutoScale: false,
  headingHighlights: () => []
})

type CopyWord = {
  text: string
  start: number
  end: number
  animationIndex: number
  breakAfter: boolean
  highlightIndex?: number
  highlight?: HeadingHighlightPreset
}

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
      animationIndex: words.length,
      breakAfter: Boolean(match[2]),
      highlight: props.headingHighlights.find(highlight => (
        highlight.start < end && highlight.end > start
      ))?.preset
    })
  }

  let highlightIndex = 0
  for (const word of words) {
    if (word.highlight) word.highlightIndex = highlightIndex++
  }
  return words
}

const headingWords = computed(() => splitWords(props.heading))
const subheadingWords = computed(() => splitWords(props.subheading))
const root = ref<HTMLElement | null>(null)
const headingLines = ref<number[]>([])
const subheadingLines = ref<number[]>([])
const lineCount = (indices: number[]) => indices.length ? Math.max(...indices) + 1 : 0
const timing = computed(() => {
  const lines = copyAnimationTiming(lineCount(headingLines.value), lineCount(subheadingLines.value), props.transitionSeconds * 1000)
  return {
    duration: lines.duration,
    enterDelay: lines.enterDelay,
    enterDuration: lines.enterDuration,
    heading: headingWords.value.map((_, index) => lines.heading[headingLines.value[index] ?? 0] ?? 0),
    subheading: subheadingWords.value.map((_, index) => lines.subheading[subheadingLines.value[index] ?? 0] ?? 0)
  }
})
let resizeObserver: ResizeObserver | undefined
let mutationObserver: MutationObserver | undefined
let measureFrame = 0
let mounted = false
function updateLines() {
  if (!mounted || !root.value) return
  const headingSelector = props.headingAutoScale
    ? '.word-fit-heading .animated-copy-word'
    : 'h2:not(.word-fit-heading__source):not(.word-fit-heading) .animated-copy-word'
  const measure = (selector: string) => copyLineIndices(
    Array.from(root.value!.querySelectorAll<HTMLElement>(selector)).map(word =>
      word.closest<HTMLElement>('.word-fit-heading__line')?.offsetTop ?? word.offsetTop)
  )
  const heading = measure(headingSelector)
  const subheading = measure('.slide-subheading .animated-copy-word')
  if (JSON.stringify(heading) !== JSON.stringify(headingLines.value)) headingLines.value = heading
  if (JSON.stringify(subheading) !== JSON.stringify(subheadingLines.value)) subheadingLines.value = subheading
}
function scheduleMeasure() {
  if (!mounted) return
  cancelAnimationFrame(measureFrame)
  measureFrame = requestAnimationFrame(updateLines)
}
watch(() => [props.heading, props.subheading, props.headingAutoScale, props.headingSize, props.subheadingSize], async () => {
  await nextTick()
  scheduleMeasure()
}, { flush: 'post' })
onMounted(() => {
  mounted = true
  resizeObserver = new ResizeObserver(scheduleMeasure)
  if (root.value) resizeObserver.observe(root.value)
  mutationObserver = new MutationObserver(scheduleMeasure)
  if (root.value) mutationObserver.observe(root.value, { childList: true, subtree: true, characterData: true })
  document.fonts.ready.then(scheduleMeasure)
  scheduleMeasure()
})
onBeforeUnmount(() => {
  mounted = false
  cancelAnimationFrame(measureFrame)
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
})
</script>

<template>
  <div
    ref="root"
    class="slide-copy"
    :data-text-align="textAlign || 'left'"
    :class="{ 'has-line-transition': animate }"
    :style="{ '--highlight-delay': `${transitionSeconds * 1000}ms`, textAlign: textAlign || 'left', '--copy-duration': `${timing.duration}ms`, '--copy-enter-delay': `${timing.enterDelay}ms`, '--copy-enter-duration': `${timing.enterDuration}ms` }"
  >
    <RelativeText
      kind="subheading"
      :relative="subheadingRelative"
      :ratio="subheadingHeadingRatio ?? 50"
      :heading-size="headingSize"
      v-if="subheading"
      class="slide-subheading animated-copy-block"
      :style="{ '--subheading-scale': subheadingSize / 100 }"
    >
      <template v-for="(word, index) in subheadingWords" :key="`subheading-word-${index}`">
      <span
        class="animated-copy-word"
        :class="{ 'has-word-gap': !word.breakAfter }"
        :style="{ '--word-delay': `${timing.subheading[index]}ms` }"
      >{{ word.text }}</span>
      <br v-if="word.breakAfter">
      </template>
    </RelativeText>
    <AutoScaleHeading
      v-if="heading && headingAutoScale"
      :words="headingWords"
      :heading-size="headingSize"
      :delays="timing.heading"
    />
    <h2
      v-if="heading"
      v-show="!headingAutoScale"
      class="animated-copy-block"
      :style="{ '--heading-scale': headingSize / 100 }"
    >
      <template v-for="(word, index) in headingWords" :key="`heading-${index}`">
      <span
        class="animated-copy-word"
        :class="[
          { 'has-word-gap': !word.breakAfter },
          word.highlight ? `has-heading-highlight--${word.highlight}` : ''
        ]"
        :style="{ '--word-delay': `${timing.heading[index]}ms`, '--highlight-stagger': `${(word.highlightIndex ?? 0) * 120}ms` }"
      >{{ word.text }}</span>
      <br v-if="word.breakAfter">
      </template>
    </h2>
  </div>
</template>
