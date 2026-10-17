import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { singleArtistMode } from '@/lib/pilot'

function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return Boolean(url && /^https?:\/\//.test(url) && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

// The mock marketplace was removed on 2026-10-17. Its old URLs still circulate,
// so they bounce to the artist landing page instead of a 404. In single-artist
// mode nobody can open a new account either.

const SINGLE_ARTIST_HOME = '/rawsunart'

// Exact paths that belonged to the marketplace.
const RETIRED_PATHS = new Set([
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

function isRetiredPath(pathname: string): boolean {
  // Mock artist profiles (/artist/1, /artist/2…).
  return RETIRED_PATHS.has(pathname) || pathname.startsWith('/artist/')
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public community endpoints are unauthenticated + CORS-served: no session work.
  if (pathname.startsWith('/api/community')) {
    return NextResponse.next({ request })
  }

  // The old artist sign-up form posted nowhere; the real waitlist is /artists.
  if (pathname === '/artist/signup') {
    return NextResponse.redirect(new URL('/artists', request.url))
  }
  if (isRetiredPath(pathname)) {
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
  // and image assets. That covers every retired path above plus /dashboard.
  matcher: [
    '/((?!api/community|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
