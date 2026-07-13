const defaultAllowedOrigins = [
  'https://wb-gen.vercel.app',
  'http://127.0.0.1:3000',
  'http://localhost:3000'
]

function getAllowedOrigins() {
  const configured = process.env.NUXT_LOCAL_RENDERER_ALLOWED_ORIGINS
    ?.split(',')
    .map(origin => origin.trim())
    .filter(Boolean)

  return new Set(configured?.length ? configured : defaultAllowedOrigins)
}

export default defineEventHandler(event => {
  const origin = getHeader(event, 'origin')
  if (!origin || !getAllowedOrigins().has(origin)) return

  setHeader(event, 'Access-Control-Allow-Origin', origin)
  setHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')
  setHeader(event, 'Access-Control-Allow-Private-Network', 'true')
  setHeader(event, 'Access-Control-Max-Age', '600')
  appendHeader(event, 'Vary', 'Origin')

  if (event.method === 'OPTIONS') {
    return sendNoContent(event, 204)
  }
})
