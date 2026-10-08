import { clientIp } from '@/lib/rate-limit'

// Cloudflare Turnstile, the bot check on every public form. Free, no puzzle
// for people, no card on file.
//
// Off until TURNSTILE_SECRET_KEY is set, so the forms keep working before the
// widget exists. Once it is set, a missing or rejected token fails the form.
// If Cloudflare itself cannot be reached, the form goes through: a missed
// inquiry costs more than one extra piece of spam, and the rate limits still
// hold.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

// Pages the widget is allowed to run on. A token minted anywhere else fails,
// even with the right site key. Override with TURNSTILE_HOSTNAMES (comma list).
const DEFAULT_HOSTNAMES = ['rawsunart.com', 'www.rawsunart.com', 'elitetatz.vercel.app']

function allowedHostnames(): Set<string> {
  const list = (process.env.TURNSTILE_HOSTNAMES ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
  return new Set(list.length ? list : DEFAULT_HOSTNAMES)
}

// `action` names the form (inquiry, subscribe, artist_lead), so a token from
// one form cannot be spent on another.
export async function passesTurnstile(req: Request, token: unknown, action: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (typeof token !== 'string' || !token || token.length > 2048) return false

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token, remoteip: clientIp(req) }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      console.error(`turnstile: verify returned ${res.status}; letting the form through`)
      return true
    }
    const data = (await res.json()) as { success?: boolean; action?: string; hostname?: string; 'error-codes'?: string[] }
    if (!data.success) {
      console.warn('turnstile: rejected', (data['error-codes'] ?? []).join(','))
      return false
    }
    if (data.action !== action || !allowedHostnames().has(String(data.hostname ?? '').toLowerCase())) {
      console.warn(`turnstile: token for action=${data.action} host=${data.hostname}, expected ${action}`)
      return false
    }
    return true
  } catch (err) {
    console.error('turnstile: verify unreachable; letting the form through', err)
    return true
  }
}

export function failedCheck(headers: Record<string, string>): Response {
  return Response.json(
    { error: 'We could not confirm you are not a bot. Reload the page and try again.' },
    { status: 403, headers }
  )
}
