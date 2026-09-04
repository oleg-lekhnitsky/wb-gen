import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const process = spawn('ffmpeg', args, {
      stdio: ['ignore', 'ignore', 'pipe']
    })
    let errorOutput = ''

    process.stderr.on('data', chunk => {
      errorOutput += String(chunk)
    })
    process.once('error', reject)
    process.once('close', code => {
      if (code === 0) resolve()
      else reject(new Error(errorOutput || `FFmpeg exited with code ${code}.`))
    })
  })
}

function getTemporalMotionBlurFilter(enabled: boolean, fps: number, intensity: number) {
  const strength = Math.max(0, Math.min(100, intensity)) / 100
  if (!enabled || strength <= 0) return ''
  const exposureSeconds = 0.025 + strength * 0.105
  const frameCount = Math.max(2, Math.min(8, Math.round(fps * exposureSeconds) + 1))
  const trailWeight = 0.12 + strength * 0.65
  const decay = 0.35 + strength * 0.45
  const weights = Array.from(
    { length: frameCount },
    (_, index) => (
      index === 0 ? 1 : trailWeight * Math.pow(decay, index - 1)
    ).toFixed(3)
  ).join(' ')
  return `tmix=frames=${frameCount}:weights='${weights}'`
}

export default defineEventHandler(async event => {
  const parts = await readMultipartFormData(event)
  if (!parts) {
    throw createError({ statusCode: 400, statusMessage: 'Missing render data.' })
  }

  const fpsPart = parts.find(part => part.name === 'fps')
  const fps = Math.max(
    1,
    Math.min(60, Number.parseInt(fpsPart?.data.toString() || '30', 10))
  )
  const motionBlur = parts.find(part => part.name === 'motionBlur')
    ?.data.toString() === 'true'
  const motionBlurIntensity = Number(
    parts.find(part => part.name === 'motionBlurIntensity')?.data.toString() || 50
  )
  const frames = parts
    .filter(part => part.name === 'frames' && part.data.length > 0)
    .slice(0, 1201)

  if (frames.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'At least two frames are required.' })
  }

  const directory = await mkdtemp(join(tmpdir(), 'slot-render-'))
  const outputPath = join(directory, 'animation.mp4')
  const digits = String(frames.length).length

  try {
    await Promise.all(
      frames.map((frame, index) => writeFile(
        join(directory, `frame-${String(index + 1).padStart(digits, '0')}.png`),
        frame.data
      ))
    )

    await runFfmpeg([
      '-hide_banner',
      '-loglevel', 'error',
      '-framerate', String(fps),
      '-i', join(directory, `frame-%0${digits}d.png`),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '18',
      '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:range=limited',
      '-pix_fmt', 'yuv420p',
      '-vf', [
        getTemporalMotionBlurFilter(motionBlur, fps, motionBlurIntensity),
        [
          'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          'flags=lanczos+accurate_rnd+full_chroma_int',
          'in_range=full',
          'out_range=limited',
          'out_color_matrix=bt709'
        ].join(':'),
        'format=yuv420p'
      ].filter(Boolean).join(','),
      '-color_primaries', 'bt709',
      '-color_trc', 'bt709',
      '-colorspace', 'bt709',
      '-color_range', 'tv',
      '-movflags', '+faststart',
      '-y',
      outputPath
    ])

    const video = await readFile(outputPath)
    setHeader(event, 'Content-Type', 'video/mp4')
    setHeader(event, 'Content-Disposition', 'attachment; filename="animation.mp4"')
    setHeader(event, 'Content-Length', String(video.length))
    return video
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MP4 conversion failed.'
    throw createError({
      statusCode: 500,
      statusMessage: message.includes('ENOENT')
        ? 'FFmpeg is not installed on the server.'
        : 'MP4 conversion failed.',
      data: message
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
