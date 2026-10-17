import { corsHeaders, preflight } from '@/lib/cors'
import { signStamp, linksConfigured } from '@/lib/tokens'

export const dynamic = 'force-dynamic'

// Page-load stamp for the sign-up forms on rawsunart.com (static pages cannot
// render a signed value themselves). The form sends it back as `ts`; subscribe
// rejects a post made under 3 seconds or over 24 hours after this was issued.

export function OPTIONS(req: Request) {
  return preflight(req)
}

export function GET(req: Request) {
  return Response.json(
    { ts: linksConfigured() ? signStamp() : null },
    { headers: { ...corsHeaders(req), 'Cache-Control': 'no-store' } }
  )
}
