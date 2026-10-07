import { NextResponse } from 'next/server'
import { artistContext } from '@/lib/artist-session'
import { authUrl, googleConfigured, newState, STATE_COOKIE } from '@/lib/google/oauth'
import { tokenCryptoConfigured } from '@/lib/google/crypto'

// Step 2 of 2: the artist, already signed in, asks to let the assistant read
// their Gmail and Calendar. Sends them to Google's consent screen.
export async function GET(req: Request) {
  const { origin } = new URL(req.url)
  const ctx = await artistContext()
  if (!ctx.ok) return NextResponse.redirect(`${origin}/auth/login?next=/dashboard/connections`)
  if (!googleConfigured() || !tokenCryptoConfigured()) {
    return NextResponse.redirect(`${origin}/dashboard/connections?error=not_configured`)
  }

  const { nonce, state } = newState(ctx.artist.id)
  const res = NextResponse.redirect(authUrl({ origin, state, loginHint: ctx.user.email }))
  res.cookies.set(STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/artist/google',
    maxAge: 600,
  })
  return res
}
