'use client'

import { useEffect, useRef } from 'react'

// Cloudflare Turnstile widget. Renders nothing until
// NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, matching the server, which only
// checks tokens once TURNSTILE_SECRET_KEY is set (lib/turnstile.ts).

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
      remove: (id: string) => void
    }
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  return new Promise((resolve, reject) => {
    let s = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`)
    if (!s) {
      s = document.createElement('script')
      s.src = SRC
      s.async = true
      document.head.appendChild(s)
    }
    s.addEventListener('load', () => resolve(), { once: true })
    s.addEventListener('error', () => reject(new Error('turnstile script')), { once: true })
  })
}

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return
    let id: string | undefined
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return
        id = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          theme: 'dark',
          callback: (t: string) => onToken(t),
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (id && window.turnstile) window.turnstile.remove(id)
    }
  }, [onToken])

  if (!SITE_KEY) return null
  return <div ref={ref} className="flex justify-center min-h-[65px]" />
}
