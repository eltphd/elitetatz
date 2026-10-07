import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { artistContext } from '@/lib/artist-session'
import { encryptToken } from '@/lib/google/crypto'
import {
  CONSENT_VERSION, STATE_COOKIE, emailFromIdToken, exchangeCode, missingScopes, revokeToken, verifyState,
} from '@/lib/google/oauth'

// Google sends the artist back here after the consent screen.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const back = (q: string) => {
    const res = NextResponse.redirect(`${url.origin}/dashboard/connections?${q}`)
    res.cookies.set(STATE_COOKIE, '', { path: '/api/artist/google', maxAge: 0 })
    return res
  }

  const ctx = await artistContext()
  if (!ctx.ok) return NextResponse.redirect(`${url.origin}/auth/login?next=/dashboard/connections`)

  // The artist pressed Cancel on Google's screen: nothing changes.
  if (url.searchParams.get('error')) return back('cancelled=1')

  const jar = await cookies()
  if (!verifyState(url.searchParams.get('state'), jar.get(STATE_COOKIE)?.value, ctx.artist.id)) {
    return back('error=state')
  }

  const code = url.searchParams.get('code')
  if (!code) return back('error=no_code')

  let tokens
  try {
    tokens = await exchangeCode(code, url.origin)
  } catch {
    return back('error=exchange')
  }

  // Google lets people untick boxes on the consent screen. If Gmail or
  // Calendar was left unticked, don't store a half-connection.
  const missing = missingScopes(tokens.scope)
  if (missing.length || !tokens.refresh_token) {
    if (tokens.refresh_token) await revokeToken(tokens.refresh_token)
    return back('error=scopes')
  }

  const googleEmail = emailFromIdToken(tokens.id_token) ?? ctx.user.email ?? 'unknown'
  const scopes = tokens.scope.split(/\s+/).filter(Boolean)
  const now = new Date().toISOString()

  const { error } = await ctx.db.from('artist_google_connections').upsert({
    artist_id: ctx.artist.id,
    google_email: googleEmail,
    scopes,
    refresh_token_enc: encryptToken(tokens.refresh_token),
    consent_version: CONSENT_VERSION,
    consented_at: now,
    needs_reconnect: false,
    updated_at: now,
  })
  if (error) {
    await revokeToken(tokens.refresh_token)
    return back('error=store')
  }

  await ctx.db.from('artist_google_consent_log').insert({
    artist_id: ctx.artist.id, action: 'granted', scopes, google_email: googleEmail, consent_version: CONSENT_VERSION,
  })
  return back('connected=1')
}
