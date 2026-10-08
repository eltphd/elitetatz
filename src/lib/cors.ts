// CORS for the public /api/community routes, called from artist presence sites.
// CORS is not a control (any script can post); it only lets browsers on these
// origins read the response. Rate limits and the bot check do the guarding.

const ALLOWED_ORIGINS = new Set([
  'https://rawsunart.com',
  'https://www.rawsunart.com',
  'https://rawsunart-web.vercel.app',
  'https://elitetatz.vercel.app',
  'http://localhost:3000',
])

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://rawsunart.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}
