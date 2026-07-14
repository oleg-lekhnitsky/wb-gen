<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  count: number
  currentIndex: number
  leavingIndex: number | null
  isPlaying: boolean
  firstPauseSeconds: number
  pauseSeconds: number
  transitionSeconds: number
  loop: boolean
}>()

const emit = defineEmits<{
  select: [index: number]
}>()

const elapsedSeconds = ref(0)
let phaseStartedAt = 0
let animationFrame: number | undefined
let mounted = false

const segments = computed(() => {
  const result: Array<{
    index: number
    start: number
    pause: number
    transition: number
    end: number
  }> = []
  let start = 0

  for (let index = 0; index < props.count; index += 1) {
    const pause = Math.max(0, index === 0 ? props.firstPauseSeconds : props.pauseSeconds)
    const hasTransition = props.loop || index < props.count - 1
    const transition = hasTransition ? Math.max(0, props.transitionSeconds) : 0
    const end = start + pause + transition
    result.push({ index, start, pause, transition, end })
    start = end
  }

  return result
})

const totalSeconds = computed(() => segments.value.at(-1)?.end || 0)
const progressPercent = computed(() => totalSeconds.value > 0
  ? Math.max(0, Math.min(100, elapsedSeconds.value / totalSeconds.value * 100))
  : 0
)
const secondTicks = computed(() => {
  const boundaries = [
    ...segments.value.flatMap(segment => [
      segment.start,
      segment.start + segment.pause
    ]),
    totalSeconds.value
  ].sort((a, b) => a - b)

  return boundaries.filter((value, index) => (
    index === 0 || Math.abs(value - boundaries[index - 1]!) > 0.0001
  ))
})

function percent(value: number) {
  return totalSeconds.value > 0 ? `${value / totalSeconds.value * 100}%` : '0%'
}

function currentPhase() {
  if (props.leavingIndex !== null) {
    const leaving = segments.value[props.leavingIndex]
    return {
      base: (leaving?.start || 0) + (leaving?.pause || 0),
      duration: leaving?.transition || 0,
      running: true
    }
  }

  const current = segments.value[props.currentIndex]
  return {
    base: current?.start || 0,
    duration: current?.pause || 0,
    running: props.isPlaying
  }
}

function updateProgress() {
  if (animationFrame !== undefined) cancelAnimationFrame(animationFrame)
  const phase = currentPhase()
  const phaseElapsed = phase.running
    ? Math.max(0, (performance.now() - phaseStartedAt) / 1000)
    : 0
  elapsedSeconds.value = Math.min(totalSeconds.value, phase.base + Math.min(phase.duration, phaseElapsed))

  if (phase.running && phaseElapsed < phase.duration) {
    animationFrame = requestAnimationFrame(updateProgress)
  } else {
    animationFrame = undefined
  }
}

function resetPhase() {
  if (!mounted) return
  phaseStartedAt = performance.now()
  updateProgress()
}

function selectSlide(index: number) {
  phaseStartedAt = performance.now()
  emit('select', index)
  updateProgress()
}

function formatSeconds(value: number) {
  return `${value.toFixed(value < 10 ? 1 : 0)}s`
}

function formatSecondTick(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace(/0$/, '')}s`
}

watch(
  () => [
    props.count,
    props.currentIndex,
    props.leavingIndex,
    props.isPlaying,
    props.firstPauseSeconds,
    props.pauseSeconds,
    props.transitionSeconds,
    props.loop
  ],
  resetPhase
)

onMounted(() => {
  mounted = true
  resetPhase()
})

onBeforeUnmount(() => {
  mounted = false
  if (animationFrame !== undefined) cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <div
    class="slide-timeline"
    role="group"
    aria-label="Slide timeline"
  >
    <span
      class="visually-hidden"
      role="progressbar"
      aria-label="Playback progress"
      aria-valuemin="0"
      :aria-valuemax="totalSeconds"
      :aria-valuenow="Math.min(totalSeconds, elapsedSeconds)"
      :aria-valuetext="`${formatSeconds(elapsedSeconds)} of ${formatSeconds(totalSeconds)}`"
    />
    <div class="slide-timeline__labels" aria-hidden="true">
      <span
        v-for="segment in segments"
        :key="`label-${segment.index}`"
        :class="{
          'is-current': leavingIndex === null
            ? currentIndex === segment.index
            : leavingIndex === segment.index
        }"
        :style="{ left: percent(segment.start) }"
      >
        {{ segment.index + 1 }}
      </span>
    </div>

    <div class="slide-timeline__track">
      <template v-for="segment in segments" :key="segment.index">
        <button
          type="button"
          class="slide-timeline__pause"
          :class="{ 'is-current': currentIndex === segment.index && leavingIndex === null }"
          :style="{
            left: percent(segment.start),
            width: percent(segment.pause)
          }"
          :aria-label="`Show slide ${segment.index + 1}; pause ${formatSeconds(segment.pause)}`"
          @click="selectSlide(segment.index)"
        />
        <span
          v-if="segment.transition > 0"
          class="slide-timeline__transition"
          :class="{ 'is-current': leavingIndex === segment.index }"
          :style="{
            left: percent(segment.start + segment.pause),
            width: percent(segment.transition)
          }"
          :title="`Transition ${segment.index + 1}–${segment.index === count - 1 ? 1 : segment.index + 2}: ${formatSeconds(segment.transition)}`"
        />
      </template>

      <span
        class="slide-timeline__progress"
        :style="{ width: `${progressPercent}%` }"
      />
      <span
        class="slide-timeline__playhead"
        :style="{ left: `${progressPercent}%` }"
      />
    </div>

    <div class="slide-timeline__seconds" aria-hidden="true">
      <span
        v-for="tick in secondTicks"
        :key="tick"
        :style="{ left: percent(tick) }"
      >
        {{ formatSecondTick(tick) }}
      </span>
    </div>
  </div>
</template>
