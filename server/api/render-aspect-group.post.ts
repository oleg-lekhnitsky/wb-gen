import { chromium } from 'playwright'
import sharp from 'sharp'

type AspectPreset = {
  label: string
  width: number
  height: number
  exportWidth: number
  exportHeight: number
  pack?: string
  custom?: boolean
}

type RenderSettings = {
  panelSlides: {
    left: unknown[]
    right: unknown[]
  }
  selectedIndex?: number
  exportWidth: number
  exportHeight: number
  exportFps: number
  exportPrefix: string
  exportFormat: 'png' | 'mp4'
  aspectWidth: number
  aspectHeight: number
  reverseDirections: boolean
  narrowHorizontalAnimation?: boolean
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
  [key: string]: unknown
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

function sanitizeRenderName(value: string) {
  return value.trim().replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'aspects'
}

function clampDimension(value: number, min: number) {
  return Math.max(min, Math.min(3840, Math.round(value)))
}

function clampRenderScale(value: string | undefined) {
  const scale = Number(value)
  return scale === 2 ? 2 : 1
}

function isAspectPreset(value: unknown): value is AspectPreset {
  if (!value || typeof value !== 'object') return false
  const preset = value as Partial<AspectPreset>
  return (
    typeof preset.label === 'string'
    && typeof preset.width === 'number'
    && typeof preset.height === 'number'
    && typeof preset.exportWidth === 'number'
    && typeof preset.exportHeight === 'number'
    && preset.width > 0
    && preset.height > 0
    && preset.exportWidth > 0
    && preset.exportHeight > 0
  )
}

function getStageLayoutSize(aspectWidth: number, aspectHeight: number) {
  const layoutWidth = aspectHeight >= aspectWidth
    ? 520
    : 900
  return {
    width: layoutWidth,
    height: layoutWidth * aspectHeight / aspectWidth
  }
}

function renderViewportCss(
  width: number,
  height: number,
  layoutWidth: number,
  layoutHeight: number,
  aspectWidth: number,
  aspectHeight: number
) {
  const scaleX = width / layoutWidth
  const scaleY = height / layoutHeight

  return `
    .animation-controls, .preview-toolbar, .aspect-preview-control {
      visibility: hidden !important;
      pointer-events: none !important;
    }
    html, body, #__nuxt {
      width: ${width}px !important;
      height: ${height}px !important;
      overflow: hidden !important;
      background: transparent !important;
    }
    .animation-generator {
      display: block !important;
      width: ${width}px !important;
      height: ${height}px !important;
      padding: 0 !important;
      overflow: hidden !important;
    }
    .animation-preview {
      position: fixed !important;
      inset: 0 !important;
      display: block !important;
      width: ${width}px !important;
      height: ${height}px !important;
      padding: 0 !important;
      overflow: visible !important;
      border-radius: 0 !important;
    }
    .stage-zoom-frame,
    .stage-zoom-frame.is-portrait {
      --stage-preview-zoom: 1 !important;
      width: ${width}px !important;
      height: ${height}px !important;
      margin: 0 !important;
      overflow: hidden !important;
      aspect-ratio: ${aspectWidth} / ${aspectHeight} !important;
    }
    .slot-stage--main {
      width: ${layoutWidth}px !important;
      height: ${layoutHeight}px !important;
      transform: scale(${scaleX}, ${scaleY}) !important;
      transform-origin: top left !important;
      aspect-ratio: ${aspectWidth} / ${aspectHeight} !important;
    }
    .draggable-background__handle {
      display: none !important;
    }
    nuxt-devtools, nuxt-devtools-frame,
    [data-nuxt-devtools], [data-v-inspector],
    iframe[src*="devtools"], #nuxt-devtools-container {
      display: none !important;
      visibility: hidden !important;
    }
    .slot-slide {
      transition: none !important;
    }
  `
}

export default defineEventHandler(async event => {
  const parts = await readMultipartFormData(event)
  const settingsPart = parts?.find(part => part.name === 'settings')
  const presetsPart = parts?.find(part => part.name === 'presets')
  const labelPart = parts?.find(part => part.name === 'groupLabel')
  const activeIndexPart = parts?.find(part => part.name === 'activeIndex')
  const renderScalePart = parts?.find(part => part.name === 'renderScale')
  const responseModePart = parts?.find(part => part.name === 'responseMode')

  if (!settingsPart || !presetsPart) {
    throw createError({ statusCode: 400, statusMessage: 'Missing aspect render settings.' })
  }

  const settings = JSON.parse(settingsPart.data.toString()) as RenderSettings
  const presets = JSON.parse(presetsPart.data.toString()) as unknown
  if (!Array.isArray(presets) || !presets.every(isAspectPreset)) {
    throw createError({ statusCode: 400, statusMessage: 'Aspect presets are invalid.' })
  }
  if (!settings.panelSlides?.left?.length || !settings.panelSlides?.right?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Slide settings are invalid.' })
  }
  if (presets.length > 40) {
    throw createError({ statusCode: 400, statusMessage: 'Too many aspect screenshots requested.' })
  }

  const renderScale = clampRenderScale(renderScalePart?.data.toString())
  const responseMode = responseModePart?.data.toString() === 'png' ? 'png' : 'zip'
  if (responseMode === 'png' && presets.length !== 1) {
    throw createError({ statusCode: 400, statusMessage: 'A single preset is required for PNG output.' })
  }
  const totalPixels = presets.reduce(
    (sum, preset) =>
      sum
      + clampDimension(preset.exportWidth, 1)
      * clampDimension(preset.exportHeight, 1)
      * renderScale
      * renderScale,
    0
  )
  if (totalPixels > 160_000_000) {
    throw createError({ statusCode: 400, statusMessage: 'Aspect screenshot set is too large.' })
  }

  const protocol = getRequestProtocol(event)
  const host = getRequestHost(event)
  const origin = `${protocol}://${host}`
  const groupName = sanitizeRenderName(labelPart?.data.toString() || 'aspects')
  const activeIndex = Number(activeIndexPart?.data.toString())
  const selectedIndex = Number.isFinite(activeIndex)
    ? Math.max(0, Math.min(Math.round(activeIndex), settings.panelSlides.left.length - 1))
    : settings.selectedIndex

  const browser = await chromium.launch({ headless: true })

  try {
    const files: Array<{ name: string, data: Uint8Array }> = []

    for (const preset of presets) {
      const width = clampDimension(preset.exportWidth, 1)
      const height = clampDimension(preset.exportHeight, 1)
      const screenshotWidth = width * renderScale
      const screenshotHeight = height * renderScale
      const layout = getStageLayoutSize(preset.width, preset.height)
      const presetSettings: RenderSettings = {
        ...settings,
        selectedIndex,
        exportWidth: width,
        exportHeight: height,
        exportFormat: 'png',
        aspectWidth: preset.width,
        aspectHeight: preset.height,
        previewWidth: width,
        previewHeight: height
      }
      const page = await browser.newPage({
        viewport: { width: screenshotWidth, height: screenshotHeight },
        deviceScaleFactor: 1
      })

      try {
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
            value: JSON.stringify(presetSettings)
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
          () => [...document.images].every(image => image.complete),
          undefined,
          { timeout: 8000 }
        )
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
          content: renderViewportCss(
            screenshotWidth,
            screenshotHeight,
            layout.width,
            layout.height,
            preset.width,
            preset.height
          )
        })
        await page.evaluate(({ selectedIndex, showPackshotOnFinalSlide, packshotWidth }) => {
          const root = document.querySelector('.slot-stage--main')
          root?.querySelectorAll<HTMLElement>('.slot-panel').forEach(panel => {
            panel.querySelectorAll<HTMLElement>('.slot-slide').forEach((slide, index) => {
              slide.style.opacity = index === selectedIndex ? '1' : '0'
              slide.style.zIndex = index === selectedIndex ? '2' : '0'
              slide.style.transform = index === selectedIndex ? 'none' : 'scaleY(0)'
            })
          })
          const packshot = root?.querySelector<HTMLElement>('.packshot-overlay')
          if (packshot) {
            const finalIndex = Math.max(0, (root?.querySelectorAll('.slot-panel--left .slot-slide').length || 1) - 1)
            packshot.style.width = `${packshotWidth}%`
            packshot.style.opacity = showPackshotOnFinalSlide && selectedIndex === finalIndex ? '1' : '0'
          }
        }, {
          selectedIndex: selectedIndex || 0,
          showPackshotOnFinalSlide: Boolean(settings.showPackshotOnFinalSlide),
          packshotWidth: Math.max(5, Math.min(100, Math.round(settings.packshotWidth || 28)))
        })

        const data = await page.locator('.slot-stage--main').screenshot({
          animations: 'disabled',
          scale: 'css'
        })
        const output = renderScale > 1
          ? await sharp(data)
              .resize(width, height, {
                fit: 'fill',
                kernel: sharp.kernel.lanczos3
              })
              .png()
              .toBuffer()
          : data
        files.push({
          name: `${groupName}_${width}x${height}.png`,
          data: new Uint8Array(output)
        })
      } finally {
        await page.close()
      }
    }

    if (responseMode === 'png') {
      const file = files[0]
      if (!file) {
        throw createError({ statusCode: 500, statusMessage: 'The PNG screenshot was not created.' })
      }
      setHeader(event, 'Content-Type', 'image/png')
      setHeader(event, 'Content-Disposition', `inline; filename="${file.name}"`)
      return Buffer.from(file.data)
    }

    setHeader(event, 'Content-Type', 'application/zip')
    return createZip(files)
  } finally {
    await browser.close()
  }
})
