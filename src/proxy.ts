import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { singleArtistMode } from '@/lib/pilot'

function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return Boolean(url && /^https?:\/\//.test(url) && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

// In single-artist mode the mock marketplace must be unreachable: no
// fictional artists, no dead payment form. Every marketplace surface bounces
// to the artist landing page, and nobody can open a new account.

const SINGLE_ARTIST_HOME = '/rawsunart'

// Exact paths that belong to the marketplace, not the pilot.
const MARKETPLACE_PATHS = new Set([
  '/',
  '/explore',
  '/flash',
  '/vault',
  '/saved',
  '/matches',
  '/notifications',
  '/payment',
  '/profile',
  '/settings',
])

function isMarketplacePath(pathname: string): boolean {
  if (MARKETPLACE_PATHS.has(pathname)) return true
  // Mock artist profiles (/artist/1, /artist/2…). Artist signup stays reachable.
  if (pathname.startsWith('/artist/') && !pathname.startsWith('/artist/signup')) return true
  return false
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public community endpoints are unauthenticated + CORS-served: no session work.
  if (pathname.startsWith('/api/community')) {
    return NextResponse.next({ request })
  }

  if (singleArtistMode() && isMarketplacePath(pathname)) {
    return NextResponse.redirect(new URL(SINGLE_ARTIST_HOME, request.url))
  }
  if (singleArtistMode() && pathname.startsWith('/auth/signup')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // A missing or malformed Supabase env must degrade to "not signed in",
  // never take the whole site down.
  if (!supabaseConfigured()) {
    if (pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/auth/login?next=/dashboard', request.url))
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Refresh session if expired
    const { data: { user } } = await supabase.auth.getUser()

    // Protect /dashboard — artist only
    if (pathname.startsWith('/dashboard') && !user) {
      return NextResponse.redirect(new URL('/auth/login?next=/dashboard', request.url))
    }
  } catch (err) {
    console.error('proxy session refresh failed:', err)
    if (pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/auth/login?next=/dashboard', request.url))
    }
    return NextResponse.next({ request })
  }

  return supabaseResponse
}

export const config = {
  // Everything except the public community API, Next internals, the favicon
  // and image assets. That covers every marketplace path above plus
  // /dashboard and /artist/*.
  matcher: [
    '/((?!api/community|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
