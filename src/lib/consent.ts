import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// What a client can choose beyond their own inquiry. Both start unticked:
// sending an inquiry lets the artist answer it, and nothing more.
// Bump WORDING_VERSION whenever a sentence below changes.

export const WORDING_VERSION = '2026-10-06'

const firstName = ARTIST_CONFIG.name.split(' ')[0]

export const CONSENT_SCOPES = {
  artist_updates: `${firstName} can email me about flash drops and guest spots.`,
  elitetatz_network: 'EliteTatz can tell me about other artists who fit my style.',
} as const

export type ConsentScope = keyof typeof CONSENT_SCOPES
export type ConsentChoices = Partial<Record<ConsentScope, boolean>>

export const CONSENT_NOTE = `Either way, your inquiry stays with ${firstName}. You can change this anytime on your inquiry page.`

export function isScope(v: string): v is ConsentScope {
  return Object.prototype.hasOwnProperty.call(CONSENT_SCOPES, v)
}

// Latest row per scope wins; no row means no.
export function currentChoices(rows: { scope: string; granted: boolean; created_at: string }[]): Record<ConsentScope, boolean> {
  const out = { artist_updates: false, elitetatz_network: false } as Record<ConsentScope, boolean>
  const seen = new Set<string>()
  for (const r of [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    if (seen.has(r.scope) || !isScope(r.scope)) continue
    seen.add(r.scope)
    out[r.scope] = r.granted
  }
  return out
}
