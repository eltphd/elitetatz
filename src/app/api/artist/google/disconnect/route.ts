import { NextResponse } from 'next/server'
import { artistContext } from '@/lib/artist-session'
import { decryptToken } from '@/lib/google/crypto'
import { revokeToken } from '@/lib/google/oauth'

// Withdraw consent: revoke at Google, delete the stored token, log it.
// The consent log row stays as the record that access was withdrawn.
export async function POST(req: Request) {
  const { origin } = new URL(req.url)
  const ctx = await artistContext()
  if (!ctx.ok) return NextResponse.redirect(`${origin}/auth/login?next=/dashboard/connections`, 303)

  const { data: conn } = await ctx.db
    .from('artist_google_connections')
    .select('refresh_token_enc, scopes, google_email')
    .eq('artist_id', ctx.artist.id)
    .maybeSingle()

  if (conn) {
    try { await revokeToken(decryptToken(conn.refresh_token_enc)) } catch { /* key rotated: delete anyway */ }
    await ctx.db.from('artist_google_connections').delete().eq('artist_id', ctx.artist.id)
    await ctx.db.from('artist_google_consent_log').insert({
      artist_id: ctx.artist.id, action: 'revoked', scopes: conn.scopes ?? [], google_email: conn.google_email,
    })
  }
  return NextResponse.redirect(`${origin}/dashboard/connections?disconnected=1`, 303)
}
