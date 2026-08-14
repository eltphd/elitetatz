import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return Boolean(url && /^https?:\/\//.test(url) && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public community endpoints are unauthenticated + CORS-served: no session work.
  if (pathname.startsWith('/api/community') || pathname.startsWith('/e/') || pathname.startsWith('/drops/')) {
    return NextResponse.next({ request })
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
