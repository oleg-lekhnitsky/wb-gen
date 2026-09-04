<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type CopyWord = {
  text: string
  start: number
  end: number
  animationIndex: number
  breakAfter: boolean
  highlight?: 'white-pink' | 'purple-white'
}

type FittedLine = {
  words: CopyWord[]
}

const props = defineProps<{
  words: CopyWord[]
  headingSize: number
}>()

const createFallbackLines = (words: CopyWord[]): FittedLine[] => (
  words.map(word => ({ words: [word] }))
)

const source = ref<HTMLElement | null>(null)
const sourceWords = ref<HTMLElement[]>([])
const fittedLines = ref<HTMLElement[]>([])
const lines = ref<FittedLine[]>(createFallbackLines(props.words))
const headingScale = ref(1)
let resizeObserver: ResizeObserver | undefined
let measureFrame = 0
const groupedLineTolerance = 1.3
const shortWordRatio = 0.8

function getLayoutWidth(element: HTMLElement) {
  const computedWidth = Number.parseFloat(getComputedStyle(element).width)
  if (Number.isFinite(computedWidth) && computedWidth > 0) return computedWidth
  return element.offsetWidth
}

function setSourceWord(element: unknown, index: number) {
  if (element instanceof HTMLElement) sourceWords.value[index] = element
}

function setFittedLine(element: unknown, index: number) {
  if (element instanceof HTMLElement) fittedLines.value[index] = element
}

function measureLines() {
  cancelAnimationFrame(measureFrame)
  measureFrame = requestAnimationFrame(async () => {
    await nextTick()

    const sourceElement = source.value
    const elements = sourceWords.value.slice(0, props.words.length)
    if (!sourceElement || elements.length !== props.words.length || !elements.length) return

    const availableWidth = sourceElement.clientWidth
    if (availableWidth <= 0) return

    const measuredWords = elements.map((element, index) => ({
      word: props.words[index]!,
      // Layout widths ignore preview zoom and the scaleX(0)/scaleY(0) used by
      // inactive slides, so every slide can fit before it becomes visible.
      width: getLayoutWidth(element),
      gap: Number.parseFloat(getComputedStyle(element).marginRight) || 0
    }))
    if (measuredWords.some(word => word.width <= 0)) return

    const longestWordWidth = Math.max(...measuredWords.map(word => word.width))
    const groupedLineLimit = longestWordWidth * groupedLineTolerance
    const shortWordLimit = longestWordWidth * shortWordRatio
    const bestCosts = Array.from({ length: measuredWords.length + 1 }, () => Number.POSITIVE_INFINITY)
    const lineWordCounts = Array.from({ length: measuredWords.length }, () => 1)
    bestCosts[measuredWords.length] = 0

    const raggedness = (width: number) => {
      const difference = Math.abs(longestWordWidth - width) / longestWordWidth
      return difference * difference
    }

    // Balance the whole heading instead of accepting the first possible group.
    // Long words stay independent; runs of short words may form longer phrases.
    for (let index = measuredWords.length - 1; index >= 0; index -= 1) {
      const word = measuredWords[index]!
      bestCosts[index] = raggedness(word.width) + bestCosts[index + 1]!

      if (word.width > shortWordLimit) continue

      let groupWidth = word.width
      for (let end = index + 1; end < measuredWords.length; end += 1) {
        const previousWord = measuredWords[end - 1]!
        const nextWord = measuredWords[end]!
        if (previousWord.word.breakAfter || nextWord.width > shortWordLimit) break

        groupWidth += previousWord.gap + nextWord.width
        if (groupWidth > groupedLineLimit) break

        const wordCount = end - index + 1
        const groupCost = raggedness(groupWidth) + bestCosts[end + 1]!
        if (groupCost < bestCosts[index]!) {
          bestCosts[index] = groupCost
          lineWordCounts[index] = wordCount
        }
      }
    }

    const grouped: Array<{
      words: CopyWord[]
      width: number
    }> = []

    for (let index = 0; index < measuredWords.length; index += 1) {
      const measuredWord = measuredWords[index]!
      const wordCount = lineWordCounts[index]!
      if (wordCount > 1) {
        const lineWords = measuredWords.slice(index, index + wordCount)
        grouped.push({
          words: lineWords.map(word => word.word),
          width: lineWords.reduce((width, word, lineIndex) => (
            width + word.width + (lineIndex > 0 ? lineWords[lineIndex - 1]!.gap : 0)
          ), 0)
        })
        index += wordCount - 1
      } else {
        grouped.push({
          words: [measuredWord.word],
          width: measuredWord.width
        })
      }
    }

    const measuredLines = grouped.map((line) => {
      return {
        words: line.words,
        width: Math.max(1, line.width)
      }
    })
    const widestLineWidth = Math.max(...measuredLines.map(line => line.width))
    const nextScale = availableWidth / widestLineWidth
    const nextLines = measuredLines.map(({ words }) => ({ words }))

    lines.value = nextLines
    headingScale.value = nextScale
    await nextTick()

    // The browser's final glyph rounding can differ slightly from the hidden
    // reference. Correct the one shared scale against the widest visible line.
    const widestRenderedLine = Math.max(
      ...fittedLines.value
        .slice(0, nextLines.length)
        .map(getLayoutWidth)
    )
    if (Number.isFinite(widestRenderedLine) && widestRenderedLine > 0) {
      headingScale.value = nextScale * availableWidth / widestRenderedLine
    }
  })
}

watch(
  () => props.words,
  (words) => {
    lines.value = createFallbackLines(words)
    headingScale.value = 1
    measureLines()
  },
  { deep: true }
)

watch(() => props.headingSize, measureLines)

onMounted(() => {
  resizeObserver = new ResizeObserver(measureLines)
  if (source.value) resizeObserver.observe(source.value)
  document.fonts?.ready.then(measureLines)
  measureLines()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  cancelAnimationFrame(measureFrame)
})
</script>

<template>
  <h2
    ref="source"
    class="animated-copy-block word-fit-heading__source"
    :style="{ '--heading-scale': headingSize / 100 }"
    aria-hidden="true"
  >
    <span
      v-for="(word, index) in words"
      :key="`source-${index}`"
      :ref="element => setSourceWord(element, index)"
      class="word-fit-heading__source-word"
      :class="{ 'has-word-gap': !word.breakAfter }"
    >{{ word.text }}<br v-if="word.breakAfter"></span>
  </h2>

  <h2
    class="animated-copy-block word-fit-heading"
    :style="{
      '--heading-scale': headingSize / 100,
      '--word-fit-scale': headingScale
    }"
  >
    <span
      v-for="(line, lineIndex) in lines"
      :key="`line-${lineIndex}`"
      :ref="element => setFittedLine(element, lineIndex)"
      class="word-fit-heading__line"
    >
      <span
        v-for="(word, wordIndex) in line.words"
        :key="`heading-${word.start}-${word.end}`"
        class="animated-copy-word"
        :class="[
          { 'has-word-gap': wordIndex < line.words.length - 1 },
          word.highlight ? `has-heading-highlight--${word.highlight}` : ''
        ]"
        :style="{ '--word-delay': `${word.animationIndex * 25}ms` }"
      >{{ word.text }}</span>
    </span>
  </h2>
</template>
