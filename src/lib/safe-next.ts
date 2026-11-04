// Where to send an artist after sign-in. Only a path on this site: it must
// start with a single "/" and contain no scheme, backslash or control
// characters, so "//evil.com", "/\evil.com" and "https://evil.com" all fall
// back. The fallback is the inbox: "/" is Lacey's public client page, and an
// artist who just signed in should never land there (Nov 4 test).
export function safeNext(raw: string | null | undefined, fallback = '/dashboard'): string {
  const v = (raw ?? '').trim()
  if (!v.startsWith('/') || v.startsWith('//')) return fallback
  if (/[\\\u0000-\u001f]/.test(v)) return fallback
  return v
}
