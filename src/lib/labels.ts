// Short machine labels from untrusted input (inquiry sources, artist handles):
// lowercase letters, digits, dot, underscore and dash, at most 60 characters.
export function cleanLabel(raw: unknown, fallback: string): string {
  const s = String(raw ?? '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 60)
  return s || fallback
}
