// Where to send someone after sign-in. Only a path on this site: it must start
// with a single "/" and contain no scheme, backslash or control characters, so
// "//evil.com", "/\evil.com" and "https://evil.com" all fall back to "/".
export function safeNext(raw: string | null | undefined, fallback = '/'): string {
  const v = (raw ?? '').trim()
  if (!v.startsWith('/') || v.startsWith('//')) return fallback
  if (/[\\\u0000-\u001f]/.test(v)) return fallback
  return v
}
