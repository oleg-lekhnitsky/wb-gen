import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { chromium } from 'playwright'

type RenderSettings = {
  panelSlides: {
    left: unknown[]
    right: unknown[]
  }
  transitionSeconds: number
  pauseSeconds: number
  firstPauseSeconds: number
  curve: {
    x1: number
    y1: number
    x2: number
    y2: number
  }
  exportWidth: number
  exportHeight: number
  exportFps: number
  exportPrefix: string
  exportFormat: 'png' | 'mp4'
  aspectWidth: number
  aspectHeight: number
  reverseDirections: boolean
  textLineTransition?: boolean
  swapVerticalPanels: boolean
  swapHorizontalPanels?: boolean
  swapUltraNarrowPanels?: boolean
  loopSlides?: boolean
  showPackshotOnFinalSlide?: boolean
  packshotWidth?: number
  packshotRenderer?: 'canvas' | 'svg'
  packshotPlayback?: 'once' | 'loop' | 'transition'
  packshotStartFrame?: number
  packshotEndFrame?: number
  packshotStartOffsetSeconds?: number
  packshotDurationSeconds?: number
  previewWidth?: number
  previewHeight?: number
  previewViewportWidth?: number
  previewViewportHeight?: number
}

const renderStreamContentType = 'application/x-resizer-render-stream'
const renderStreamHeartbeat = 0
const renderStreamResult = 1
const renderStreamError = 2
const renderStreamProgress = 3

function createRenderStreamFrame(type: number, data: Uint8Array = new Uint8Array()) {
  const header = Buffer.allocUnsafe(5)
  header.writeUInt8(type, 0)
  header.writeUInt32BE(data.byteLength, 1)
  return data.byteLength
    ? Buffer.concat([header, Buffer.from(data)])
    : header
}

function runFfmpeg(args: string[], onFrame?: (frame: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const process = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let output = ''
    let progressOutput = ''
    process.stderr.on('data', chunk => {
      const text = String(chunk)
      output += text
      if (!onFrame) return
      progressOutput += text
      const lines = progressOutput.split(/\r?\n/)
      progressOutput = lines.pop() || ''
      for (const line of lines) {
        const match = /^frame=(\d+)$/.exec(line.trim())
        if (match?.[1]) onFrame(Number(match[1]))
      }
    })
    process.once('error', reject)
    process.once('close', code => {
      if (code === 0) resolve()
      else reject(new Error(output || `FFmpeg exited with code ${code}.`))
    })
  })
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function createZip(files: Array<{ name: string, data: Uint8Array }>) {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const name = encoder.encode(file.name)
    const checksum = crc32(file.data)
    const local = new Uint8Array(30 + name.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true)
    localView.setUint32(14, checksum, true)
    localView.setUint32(18, file.data.length, true)
    localView.setUint32(22, file.data.length, true)
    localView.setUint16(26, name.length, true)
    local.set(name, 30)
    chunks.push(local, file.data)

    const entry = new Uint8Array(46 + name.length)
    const entryView = new DataView(entry.buffer)
    entryView.setUint32(0, 0x02014b50, true)
    entryView.setUint16(4, 20, true)
    entryView.setUint16(6, 20, true)
    entryView.setUint16(8, 0x0800, true)
    entryView.setUint32(16, checksum, true)
    entryView.setUint32(20, file.data.length, true)
    entryView.setUint32(24, file.data.length, true)
    entryView.setUint16(28, name.length, true)
    entryView.setUint32(42, offset, true)
    entry.set(name, 46)
    central.push(entry)
    offset += local.length + file.data.length
  }

  const centralLength = central.reduce((sum, item) => sum + item.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralLength, true)
  endView.setUint32(16, offset, true)
  return Buffer.concat([...chunks, ...central, end].map(item => Buffer.from(item)))
}

function cubicBezier(progress: number, curve: RenderSettings['curve']) {
  const sample = (t: number, a1: number, a2: number) => {
    const c = 3 * a1
    const b = 3 * (a2 - a1) - c
    const a = 1 - c - b
    return ((a * t + b) * t + c) * t
  }
  const slope = (t: number) => {
    const c = 3 * curve.x1
    const b = 3 * (curve.x2 - curve.x1) - c
    const a = 1 - c - b
    return 3 * a * t * t + 2 * b * t + c
  }
  let t = progress
  for (let index = 0; index < 8; index += 1) {
    const difference = sample(t, curve.x1, curve.x2) - progress
    const currentSlope = slope(t)
    if (Math.abs(difference) < 0.00001 || Math.abs(currentSlope) < 0.00001) break
    t -= difference / currentSlope
  }
  return sample(Math.max(0, Math.min(1, t)), curve.y1, curve.y2)
}

export default defineEventHandler(async event => {
  const parts = await readMultipartFormData(event)
  const settingsPart = parts?.find(part => part.name === 'settings')
  if (!settingsPart) {
    throw createError({ statusCode: 400, statusMessage: 'Missing render settings.' })
  }

  const settings = JSON.parse(settingsPart.data.toString()) as RenderSettings
  const width = Math.max(1, Math.min(3840, Math.round(settings.exportWidth)))
  const height = Math.max(1, Math.min(3840, Math.round(settings.exportHeight)))
  const fps = Math.max(1, Math.min(60, Math.round(settings.exportFps)))
  const renderWidth = Math.max(1, Math.min(3840, Math.round(settings.previewWidth || width)))
  const renderHeight = Math.max(1, Math.min(3840, Math.round(settings.previewHeight || height)))
  const viewportWidth = renderWidth
  const viewportHeight = renderHeight
  const slideCount = settings.panelSlides.left.length
  const firstPause = Number.isFinite(settings.firstPauseSeconds)
    ? settings.firstPauseSeconds
    : settings.pauseSeconds
  const loopSlides = settings.loopSlides !== false
  const transitionCount = loopSlides ? slideCount : Math.max(0, slideCount - 1)
  const duration =
    firstPause
    + settings.pauseSeconds * Math.max(0, slideCount - 1)
    + settings.transitionSeconds * transitionCount
  const frameCount = Math.max(1, Math.round(duration * fps))
  if (!slideCount || frameCount > 1200 || width * height * frameCount > 900_000_000) {
    throw createError({ statusCode: 400, statusMessage: 'Render settings are too large.' })
  }

  const protocol = getRequestProtocol(event)
  const host = getRequestHost(event)
  const origin = `${protocol}://${host}`
  const directory = await mkdtemp(join(tmpdir(), 'browser-render-'))
  const sourceDirectory = join(directory, 'source')
  const outputDirectory = join(directory, 'output')
  await mkdir(sourceDirectory)
  await mkdir(outputDirectory)
  const digits = String(frameCount).length
  const responseStream = new PassThrough()
  setHeader(event, 'Content-Type', renderStreamContentType)
  setHeader(event, 'Cache-Control', 'no-cache, no-transform')
  setHeader(event, 'Content-Encoding', 'identity')
  setHeader(event, 'X-Accel-Buffering', 'no')
  responseStream.write(createRenderStreamFrame(renderStreamHeartbeat))
  const sendProgress = (progress: number, status: string) => {
    if (responseStream.destroyed) return
    responseStream.write(createRenderStreamFrame(
      renderStreamProgress,
      new TextEncoder().encode(JSON.stringify({ progress, status }))
    ))
  }
  sendProgress(0.02, 'Starting renderer')
  const heartbeat = setInterval(() => {
    if (!responseStream.destroyed) {
      responseStream.write(createRenderStreamFrame(renderStreamHeartbeat))
    }
  }, 15_000)

  void (async () => {
    const browser = await chromium.launch({ headless: true })
    try {
    const page = await browser.newPage({
      viewport: { width: viewportWidth, height: viewportHeight },
      deviceScaleFactor: 2
    })
    await page.addInitScript(
      ({ key, value }) => {
        ;(window as Window & { __slotAnimationRenderSettings?: unknown }).__slotAnimationRenderSettings = JSON.parse(value)
        try {
          localStorage.setItem(key, value)
        } catch {}
        try {
          localStorage.setItem('nuxt-devtools-enabled', 'false')
        } catch {}
      },
      {
        key: 'slot-animation-generator-settings-v1',
        value: JSON.stringify(settings)
      }
    )
    await page.goto(origin, { waitUntil: 'networkidle' })
    await page.waitForSelector('.slot-stage--main')
    await page.waitForFunction(
      () => Boolean((window as Window & { __slotAnimationRenderSettingsLoaded?: boolean }).__slotAnimationRenderSettingsLoaded),
      undefined,
      { timeout: 5000 }
    )
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(
      () => {
        const animation = (window as Window & {
          __packshotAnimation?: { totalFrames?: number } | null
        }).__packshotAnimation
        return !document.querySelector('.packshot-animation') || Number(animation?.totalFrames || 0) > 0
      },
      undefined,
      { timeout: 5000 }
    ).catch(() => {})
    await page.addStyleTag({
      content: `
        .animation-controls, .preview-toolbar, .aspect-preview-control {
          visibility: hidden !important;
          pointer-events: none !important;
        }
        html, body, #__nuxt {
          width: ${renderWidth}px !important;
          height: ${renderHeight}px !important;
          overflow: hidden !important;
        }
        .animation-generator {
          display: block !important;
          width: ${renderWidth}px !important;
          height: ${renderHeight}px !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        .animation-preview {
          position: fixed !important;
          inset: 0 !important;
          display: block !important;
          width: ${renderWidth}px !important;
          height: ${renderHeight}px !important;
          padding: 0 !important;
          overflow: visible !important;
          border-radius: 0 !important;
        }
        .stage-zoom-frame,
        .stage-zoom-frame.is-portrait {
          --stage-preview-zoom: 1 !important;
          width: ${renderWidth}px !important;
          height: ${renderHeight}px !important;
          margin: 0 !important;
          aspect-ratio: ${settings.aspectWidth} / ${settings.aspectHeight} !important;
        }
        .slot-stage--main {
          width: ${renderWidth}px !important;
          height: ${renderHeight}px !important;
          transform: none !important;
          aspect-ratio: ${settings.aspectWidth} / ${settings.aspectHeight} !important;
        }
        .draggable-background__handle {
          display: none !important;
        }
        nuxt-devtools, nuxt-devtools-frame,
        [data-nuxt-devtools], [data-v-inspector],
        iframe[src*="devtools"], #nuxt-devtools-container { display: none !important; visibility: hidden !important; }
        .slot-slide { transition: none !important; }
      `
    })
    await page.waitForFunction(() =>
      [...document.images].every(image => image.complete)
    )
    await page.evaluate(async () => {
      const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('.draggable-background video'))
      await Promise.all(videos.map(video => new Promise<void>(resolve => {
        video.muted = true
        video.pause()
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          resolve()
          return
        }
        video.addEventListener('loadedmetadata', () => resolve(), { once: true })
        video.addEventListener('error', () => resolve(), { once: true })
      })))
    })
    const stage = page.locator('.slot-stage--main')
    const portrait = settings.aspectHeight >= settings.aspectWidth
    const ultraNarrow = !portrait && settings.aspectWidth / settings.aspectHeight >= 4
    const swapPanels = portrait
      ? settings.swapVerticalPanels
      : ultraNarrow
        ? Boolean(settings.swapUltraNarrowPanels)
        : Boolean(settings.swapHorizontalPanels)
    const segmentDurations = Array.from(
      { length: slideCount },
      (_, index) => {
        const pause = index === 0 ? firstPause : settings.pauseSeconds
        const hasTransition = loopSlides || index < slideCount - 1
        return pause + (hasTransition ? settings.transitionSeconds : 0)
      }
    )

    const renderProgressStep = Math.max(1, Math.ceil(frameCount / 100))
    for (let frame = 0; frame < frameCount; frame += 1) {
      const time = Math.min(frame / fps, duration)
      let currentIndex = 0
      let segmentStart = 0
      for (let index = 0; index < slideCount; index += 1) {
        const segmentEnd = segmentStart + segmentDurations[index]
        if (time < segmentEnd || index === slideCount - 1) {
          currentIndex = index
          break
        }
        segmentStart = segmentEnd
      }
      const localTime = time - segmentStart
      const currentPause = currentIndex === 0 ? firstPause : settings.pauseSeconds
      const hasTransition = loopSlides || currentIndex < slideCount - 1
      const nextIndex = hasTransition ? (currentIndex + 1) % slideCount : currentIndex
      const transition = hasTransition && localTime >= currentPause && settings.transitionSeconds > 0
      const rawProgress = transition
        ? Math.min(1, (localTime - currentPause) / settings.transitionSeconds)
        : 0
      const currentEntryProgress = !transition && currentIndex > 0 && settings.transitionSeconds > 0
        ? 1 + localTime / settings.transitionSeconds
        : 1
      const progress = transition
        ? cubicBezier(
            rawProgress,
            settings.curve
          )
        : 0
      const finalIndex = slideCount - 1
      const isFinalCurrent = currentIndex === finalIndex
      const isFinalEntering = transition && nextIndex === finalIndex
      const packshotStartOffset = Math.max(0, settings.packshotStartOffsetSeconds || 0)
      const packshotDuration = Math.max(0.1, settings.packshotDurationSeconds || 1)
      const finalTransitionStart = isFinalEntering
        ? segmentStart + currentPause
        : isFinalCurrent
          ? Math.max(0, segmentStart - settings.transitionSeconds)
          : Number.POSITIVE_INFINITY
      const packshotElapsed = time - finalTransitionStart - packshotStartOffset
      const packshotVisible = (isFinalEntering || isFinalCurrent) && packshotElapsed >= 0
      const packshotProgress = settings.packshotPlayback === 'loop'
        ? packshotElapsed / packshotDuration
        : Math.min(1, Math.max(0, packshotElapsed / packshotDuration))

      await page.evaluate(
        ({
          currentIndex,
          nextIndex,
          transition,
          progress,
          rawProgress,
          currentEntryProgress,
          transitionSeconds,
          curve,
          portrait,
          reverseDirections,
          swapPanels,
          textLineTransition,
          showPackshotOnFinalSlide,
          packshotWidth,
          packshotPlayback,
          packshotStartFrame,
          packshotEndFrame,
          packshotProgress,
          packshotVisible,
          time
        }) => {
          const root = document.querySelector('.slot-stage--main')
          const seekVideos = Array.from(root?.querySelectorAll<HTMLVideoElement>('.draggable-background video') || [])
            .map(video => new Promise<void>(resolve => {
              video.muted = true
              video.pause()
              if (!Number.isFinite(video.duration) || video.duration <= 0) {
                resolve()
                return
              }

              const targetTime = time % video.duration
              if (Math.abs(video.currentTime - targetTime) < 0.02) {
                resolve()
                return
              }

              let finished = false
              const finish = () => {
                if (finished) return
                finished = true
                resolve()
              }
              window.setTimeout(finish, 250)
              video.addEventListener('seeked', finish, { once: true })
              video.addEventListener('error', finish, { once: true })
              video.currentTime = targetTime
            }))
          return Promise.all(seekVideos).then(() => {
          const panels = [
            root?.querySelector('.slot-panel--left'),
            root?.querySelector('.slot-panel--right')
          ]
          const copyUnitSelector = '.slide-copy.has-line-transition .animated-copy-word'
          const clamp = (value: number) => Math.max(0, Math.min(1, value))
          const easeCopyProgress = (value: number) => {
            const sample = (t: number, a1: number, a2: number) => {
              const c = 3 * a1
              const b = 3 * (a2 - a1) - c
              const a = 1 - c - b
              return ((a * t + b) * t + c) * t
            }
            const slope = (t: number) => {
              const c = 3 * curve.x1
              const b = 3 * (curve.x2 - curve.x1) - c
              const a = 1 - c - b
              return 3 * a * t * t + 2 * b * t + c
            }
            const progress = clamp(value)
            let t = progress
            for (let index = 0; index < 8; index += 1) {
              const difference = sample(t, curve.x1, curve.x2) - progress
              const currentSlope = slope(t)
              if (Math.abs(difference) < 0.00001 || Math.abs(currentSlope) < 0.00001) break
              t -= difference / currentSlope
            }
            return sample(clamp(t), curve.y1, curve.y2)
          }
          const setCopyUnits = (
            slide: HTMLElement | undefined,
            mode: 'hidden' | 'visible' | 'entering' | 'leaving',
            timelineProgress = rawProgress
          ) => {
            const units = Array.from(slide?.querySelectorAll<HTMLElement>(copyUnitSelector) || [])
            units.forEach(unit => {
              unit.style.transition = 'none'

              if (!textLineTransition) {
                unit.style.opacity = ''
                unit.style.transform = ''
                return
              }

              const delay = Number.parseFloat(
                unit.style.getPropertyValue('--word-delay')
                || unit.style.getPropertyValue('--line-delay')
              ) || 0
              const delayRatio = transitionSeconds > 0 ? delay / (transitionSeconds * 1000) : 0
              const unitProgress = easeCopyProgress(timelineProgress - delayRatio)
              const visibility = mode === 'visible'
                ? 1
                : mode === 'hidden'
                  ? 0
                  : mode === 'entering'
                    ? unitProgress
                    : 1 - unitProgress
              const styles = window.getComputedStyle(unit)
              const enterOffset = Number.parseFloat(styles.getPropertyValue('--copy-enter-offset')) || 2.35
              const leaveOffset = Number.parseFloat(styles.getPropertyValue('--copy-leave-offset')) || -2.25

              unit.style.opacity = String(visibility)
              unit.style.transform = mode === 'entering'
                ? `translateY(${(1 - visibility) * enterOffset}em)`
                : mode === 'leaving'
                  ? `translateY(${unitProgress * leaveOffset}em)`
                  : visibility > 0
                    ? 'translateY(0)'
                    : `translateY(${enterOffset}em)`
            })
          }
          panels.forEach((panel, sideIndex) => {
            panel?.querySelectorAll<HTMLElement>('.slot-slide').forEach((slide, index) => {
              slide.style.opacity = '0'
              slide.style.zIndex = '0'
              slide.style.transform = portrait ? 'scaleX(0)' : 'scaleY(0)'
              slide.classList.toggle('is-active', !transition && index === currentIndex)
              slide.classList.toggle('is-leaving', transition && index === currentIndex)
              setCopyUnits(slide, 'hidden')
            })
            const current = panel?.querySelectorAll<HTMLElement>('.slot-slide')[currentIndex]
            const next = panel?.querySelectorAll<HTMLElement>('.slot-slide')[nextIndex]
            const visualIndex = swapPanels
              ? 1 - sideIndex
              : sideIndex
            const startOrigin = visualIndex === 0 ? 'start' : 'end'
            const endOrigin = visualIndex === 0 ? 'end' : 'start'
            const effectiveStart = reverseDirections ? endOrigin : startOrigin
            const effectiveEnd = reverseDirections ? startOrigin : endOrigin
            const origin = (position: 'start' | 'end') => portrait
              ? position === 'start' ? 'left' : 'right'
              : position === 'start' ? 'top' : 'bottom'

            if (!transition && current) {
              current.style.opacity = '1'
              current.style.zIndex = '3'
              current.style.transformOrigin = origin(effectiveStart)
              current.style.transform = portrait ? 'scaleX(1)' : 'scaleY(1)'
              setCopyUnits(
                current,
                currentIndex > 0 ? 'entering' : 'visible',
                currentEntryProgress
              )
            } else {
              if (next) {
                next.classList.add('is-active')
                next.style.opacity = '1'
                next.style.zIndex = '3'
                next.style.transformOrigin = origin(effectiveStart)
                next.style.transform = portrait
                  ? `scaleX(${progress})`
                  : `scaleY(${progress})`
                setCopyUnits(next, 'entering')
              }
              if (current) {
                current.classList.add('is-leaving')
                current.style.opacity = '1'
                current.style.zIndex = '2'
                current.style.transformOrigin = origin(effectiveEnd)
                current.style.transform = portrait
                  ? `scaleX(${1 - progress})`
                  : `scaleY(${1 - progress})`
                setCopyUnits(current, 'leaving')
              }
            }
          })

          const finalIndex = panels[0]?.querySelectorAll('.slot-slide').length
            ? panels[0].querySelectorAll('.slot-slide').length - 1
            : 0
          const packshot = root?.querySelector<HTMLElement>('.packshot-overlay')
          if (packshot) {
            packshot.style.width = `${packshotWidth}%`
            packshot.style.opacity = showPackshotOnFinalSlide && packshotVisible ? '1' : '0'
          }

          const animation = (window as Window & {
            __packshotAnimation?: {
              totalFrames?: number
              goToAndStop: (value: number, isFrame: boolean) => void
            } | null
          }).__packshotAnimation
          const totalFrames = animation?.totalFrames || 0
          if (animation && totalFrames > 0) {
            const frameProgress = packshotPlayback === 'loop'
              ? packshotProgress % 1
              : packshotProgress
            const startFrame = Math.max(0, Math.min(totalFrames - 1, packshotStartFrame))
            const endFrame = Math.max(startFrame, Math.min(totalFrames - 1, packshotEndFrame))
            animation.goToAndStop(startFrame + frameProgress * (endFrame - startFrame), true)
          }
          })
        },
        {
          currentIndex,
          nextIndex,
          transition,
          progress,
          rawProgress,
          currentEntryProgress,
          transitionSeconds: settings.transitionSeconds,
          curve: settings.curve,
          portrait,
          reverseDirections: settings.reverseDirections,
          swapPanels,
          textLineTransition: Boolean(settings.textLineTransition),
          showPackshotOnFinalSlide: Boolean(settings.showPackshotOnFinalSlide),
          packshotWidth: Math.max(5, Math.min(100, Math.round(settings.packshotWidth || 28))),
          packshotPlayback: settings.packshotPlayback === 'loop' ? 'loop' : 'once',
          packshotStartFrame: Math.max(0, Math.min(80, Math.round(settings.packshotStartFrame || 0))),
          packshotEndFrame: Math.max(1, Math.min(80, Math.round(settings.packshotEndFrame || 30))),
          packshotProgress,
          packshotVisible,
          time
        }
      )
      await stage.screenshot({
        path: join(sourceDirectory, `frame-${String(frame + 1).padStart(digits, '0')}.png`),
        animations: 'disabled'
      })
      const completedFrames = frame + 1
      if (completedFrames % renderProgressStep === 0 || completedFrames === frameCount) {
        sendProgress(
          0.05 + completedFrames / frameCount * 0.8,
          `Rendering frame ${completedFrames} of ${frameCount}`
        )
      }
    }

    const resizeFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height}`

    if (settings.exportFormat === 'mp4') {
      const scaleFilter = [
        'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        'flags=lanczos+accurate_rnd+full_chroma_int',
        'in_range=full',
        'out_range=limited',
        'out_color_matrix=bt709'
      ].join(':')
      const output = join(directory, 'animation.mp4')
      sendProgress(0.86, 'Encoding MP4')
      await runFfmpeg([
        '-hide_banner', '-loglevel', 'error', '-progress', 'pipe:2', '-nostats',
        '-framerate', String(fps),
        '-i', join(sourceDirectory, `frame-%0${digits}d.png`),
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
        '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:range=limited',
        '-pix_fmt', 'yuv420p',
        '-vf', `${resizeFilter},${scaleFilter},format=yuv420p`,
        '-color_primaries', 'bt709',
        '-color_trc', 'bt709',
        '-colorspace', 'bt709',
        '-color_range', 'tv',
        '-movflags', '+faststart',
        '-y', output
      ], encodedFrame => {
        const completedFrames = Math.max(0, Math.min(frameCount, encodedFrame))
        sendProgress(
          0.86 + completedFrames / frameCount * 0.12,
          `Encoding MP4: frame ${completedFrames} of ${frameCount}`
        )
      })
      sendProgress(0.99, 'Finalizing MP4')
      const video = await readFile(output)
      responseStream.write(createRenderStreamFrame(renderStreamResult, video))
      return
    }

    sendProgress(0.86, 'Resizing PNG frames')
    await runFfmpeg([
      '-hide_banner', '-loglevel', 'error', '-progress', 'pipe:2', '-nostats',
      '-framerate', String(fps),
      '-i', join(sourceDirectory, `frame-%0${digits}d.png`),
      '-vf', resizeFilter,
      '-start_number', '1',
      '-y',
      join(outputDirectory, `frame-%0${digits}d.png`)
    ], resizedFrame => {
      const completedFrames = Math.max(0, Math.min(frameCount, resizedFrame))
      sendProgress(
        0.86 + completedFrames / frameCount * 0.1,
        `Resizing PNG frame ${completedFrames} of ${frameCount}`
      )
    })

    sendProgress(0.97, 'Packaging PNG files')
    const names = (await readdir(outputDirectory)).filter(name => name.endsWith('.png')).sort()
    const files = await Promise.all(names.map(async name => ({
      name,
      data: new Uint8Array(await readFile(join(outputDirectory, name)))
    })))
    const zip = createZip(files)
    sendProgress(0.99, 'Finalizing PNG sequence')
    responseStream.write(createRenderStreamFrame(renderStreamResult, zip))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Browser render failed.'
      responseStream.write(createRenderStreamFrame(
        renderStreamError,
        new TextEncoder().encode(message)
      ))
    } finally {
      clearInterval(heartbeat)
      await browser.close().catch(() => {})
      await rm(directory, { recursive: true, force: true })
      responseStream.end()
    }
  })().catch(async error => {
    clearInterval(heartbeat)
    await rm(directory, { recursive: true, force: true }).catch(() => {})
    const message = error instanceof Error ? error.message : 'Browser renderer failed to start.'
    if (!responseStream.destroyed) {
      responseStream.end(createRenderStreamFrame(
        renderStreamError,
        new TextEncoder().encode(message)
      ))
    }
  })

  return sendStream(event, responseStream)
})
