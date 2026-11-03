import { redirect } from 'next/navigation'
import { artistContext } from '@/lib/artist-session'
import { isKind, type ApprovalView } from '@/lib/approvals'
import { ApprovalsView } from './ApprovalsView'

// Lacey's approvals: email campaigns to her list and blog posts for the site,
// each shown exactly as it will go out, with Approve / Ask for changes.
// Read through her session; nothing here sends.

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await artistContext()
  if (!ctx.ok && ctx.status === 401) redirect('/auth/login?next=/dashboard/approvals')
  if (!ctx.ok) redirect('/dashboard')
  const { artist, db, user } = ctx
  const { tab: rawTab } = await searchParams
  const tab = isKind(rawTab) ? rawTab : 'email_campaign'

  const { data } = await db
    .from('approvals')
    .select('id, kind, key, title, summary, subject, body_html, body_text, audience, audience_count, status, artist_notes, decided_at, submitted_by, created_at')
    .eq('artist_id', artist.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return <ApprovalsView items={(data ?? []) as ApprovalView[]} tab={tab} artistName={artist.name ?? user.email ?? ''} basePath="/dashboard/approvals" />
}
