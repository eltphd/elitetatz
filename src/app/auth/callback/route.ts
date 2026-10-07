import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { safeNext } from '@/lib/safe-next'
import { createAdminClient } from '@/lib/supabase/admin'
import { singleArtistMode } from '@/lib/pilot'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // "Continue with Google" must not become a side door into the artist
      // area. In the pilot only existing artists may sign in: a Google
      // account with no artist row is signed straight back out.
      if (singleArtistMode() && data.user) {
        const db = createAdminClient()
        const { data: artist } = db
          ? await db.from('artists').select('id').eq('user_id', data.user.id).maybeSingle()
          : { data: null }
        if (!artist) {
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}/auth/login?error=not_artist`)
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`)
}
