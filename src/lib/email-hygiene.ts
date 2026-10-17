import disposableDomains from 'disposable-email-domains'

// Addresses the Collectors Club will not take: role mailboxes nobody reads as a
// person, and throwaway domains from the maintained `disposable-email-domains`
// list. A rejected address is logged by reason only (join_rejections), never kept.

const ROLE_LOCALS = new Set([
  'noreply', 'no-reply', 'no_reply', 'donotreply', 'do-not-reply',
  'admin', 'administrator', 'info', 'test', 'testing', 'postmaster',
  'abuse', 'webmaster', 'hostmaster', 'mailer-daemon', 'root',
])

const DISPOSABLE = new Set<string>(disposableDomains as string[])

/** Trimmed, lower-cased address, or null when it is not an address at all. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null
  return email
}

export type EmailRejectReason = 'role' | 'disposable'

export function emailRejectReason(email: string): EmailRejectReason | null {
  const at = email.lastIndexOf('@')
  const local = email.slice(0, at).replace(/\+.*$/, '')
  const domain = email.slice(at + 1)
  if (ROLE_LOCALS.has(local)) return 'role'
  if (DISPOSABLE.has(domain)) return 'disposable'
  // a.b.c.mailinator.com → check each parent too
  const parts = domain.split('.')
  for (let i = 1; i < parts.length - 1; i++) if (DISPOSABLE.has(parts.slice(i).join('.'))) return 'disposable'
  return null
}
