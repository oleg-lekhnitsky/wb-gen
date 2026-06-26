import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
  swapVerticalPanels: boolean
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

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const process = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let output = ''
    process.stderr.on('data', chunk => { output += String(chunk) })
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
  const width = Math.max(320, Math.min(3840, Math.round(settings.exportWidth)))
  const height = Math.max(180, Math.min(3840, Math.round(settings.exportHeight)))
  const fps = Math.max(1, Math.min(60, Math.round(settings.exportFps)))
  const viewportWidth = Math.max(
    320,
    Math.min(3840, Math.round(settings.previewViewportWidth || width))
  )
  const viewportHeight = Math.max(
    320,
    Math.min(3840, Math.round(settings.previewViewportHeight || height))
  )
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
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({
      viewport: { width: viewportWidth, height: viewportHeight },
      deviceScaleFactor: 2
    })
    await page.addInitScript(
      ({ key, value }) => {
        localStorage.setItem(key, value)
        localStorage.setItem('nuxt-devtools-enabled', 'false')
      },
      {
        key: 'slot-animation-generator-settings-v1',
        value: JSON.stringify(settings)
      }
    )
    await page.goto(origin, { waitUntil: 'networkidle' })
    await page.waitForSelector('.slot-stage')
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
        .animation-controls, .preview-toolbar {
          visibility: hidden !important;
          pointer-events: none !important;
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
    const stage = page.locator('.slot-stage')
    const portrait = settings.aspectHeight >= settings.aspectWidth
    const segmentDurations = Array.from(
      { length: slideCount },
      (_, index) => {
        const pause = index === 0 ? firstPause : settings.pauseSeconds
        const hasTransition = loopSlides || index < slideCount - 1
        return pause + (hasTransition ? settings.transitionSeconds : 0)
      }
    )

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
      const progress = transition
        ? cubicBezier(
            Math.min(1, (localTime - currentPause) / settings.transitionSeconds),
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
          portrait,
          reverseDirections,
          swapVerticalPanels,
          showPackshotOnFinalSlide,
          packshotWidth,
          packshotPlayback,
          packshotStartFrame,
          packshotEndFrame,
          packshotProgress,
          packshotVisible
        }) => {
          const panels = [
            document.querySelector('.slot-panel--left'),
            document.querySelector('.slot-panel--right')
          ]
          panels.forEach((panel, sideIndex) => {
            panel?.querySelectorAll<HTMLElement>('.slot-slide').forEach((slide, index) => {
              slide.style.opacity = '0'
              slide.style.zIndex = '0'
              slide.style.transform = portrait ? 'scaleX(0)' : 'scaleY(0)'
            })
            const current = panel?.querySelectorAll<HTMLElement>('.slot-slide')[currentIndex]
            const next = panel?.querySelectorAll<HTMLElement>('.slot-slide')[nextIndex]
            const visualIndex = portrait && swapVerticalPanels
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
              current.style.zIndex = '2'
              current.style.transformOrigin = origin(effectiveStart)
              current.style.transform = portrait ? 'scaleX(1)' : 'scaleY(1)'
            } else {
              if (next) {
                next.style.opacity = '1'
                next.style.zIndex = '2'
                next.style.transformOrigin = origin(effectiveStart)
                next.style.transform = portrait
                  ? `scaleX(${progress})`
                  : `scaleY(${progress})`
              }
              if (current) {
                current.style.opacity = '1'
                current.style.zIndex = '3'
                current.style.transformOrigin = origin(effectiveEnd)
                current.style.transform = portrait
                  ? `scaleX(${1 - progress})`
                  : `scaleY(${1 - progress})`
              }
            }
          })

          const finalIndex = panels[0]?.querySelectorAll('.slot-slide').length
            ? panels[0].querySelectorAll('.slot-slide').length - 1
            : 0
          const packshot = document.querySelector<HTMLElement>('.packshot-overlay')
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
        },
        {
          currentIndex,
          nextIndex,
          transition,
          progress,
          portrait,
          reverseDirections: settings.reverseDirections,
          swapVerticalPanels: settings.swapVerticalPanels,
          showPackshotOnFinalSlide: Boolean(settings.showPackshotOnFinalSlide),
          packshotWidth: Math.max(5, Math.min(100, Math.round(settings.packshotWidth || 28))),
          packshotPlayback: settings.packshotPlayback === 'loop' ? 'loop' : 'once',
          packshotStartFrame: Math.max(0, Math.min(80, Math.round(settings.packshotStartFrame || 0))),
          packshotEndFrame: Math.max(1, Math.min(80, Math.round(settings.packshotEndFrame || 30))),
          packshotProgress,
          packshotVisible
        }
      )
      await stage.screenshot({
        path: join(sourceDirectory, `frame-${String(frame + 1).padStart(digits, '0')}.png`),
        animations: 'disabled'
      })
    }

    await runFfmpeg([
      '-hide_banner', '-loglevel', 'error',
      '-framerate', String(fps),
      '-i', join(sourceDirectory, `frame-%0${digits}d.png`),
      '-vf',
      `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height}`,
      '-start_number', '1',
      '-y',
      join(outputDirectory, `frame-%0${digits}d.png`)
    ])

    if (settings.exportFormat === 'mp4') {
      const output = join(directory, 'animation.mp4')
      await runFfmpeg([
        '-hide_banner', '-loglevel', 'error',
        '-framerate', String(fps),
        '-i', join(outputDirectory, `frame-%0${digits}d.png`),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-movflags', '+faststart', '-y', output
      ])
      const video = await readFile(output)
      setHeader(event, 'Content-Type', 'video/mp4')
      return video
    }

    const names = (await readdir(outputDirectory)).filter(name => name.endsWith('.png')).sort()
    const files = await Promise.all(names.map(async name => ({
      name,
      data: new Uint8Array(await readFile(join(outputDirectory, name)))
    })))
    const zip = createZip(files)
    setHeader(event, 'Content-Type', 'application/zip')
    return zip
  } finally {
    await browser.close()
    await rm(directory, { recursive: true, force: true })
  }
})
