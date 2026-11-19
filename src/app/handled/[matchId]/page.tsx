import type { Metadata } from 'next'
import Link from 'next/link'
import { verifyHandled } from '@/lib/tokens'
import { createAdminClient } from '@/lib/supabase/admin'
import { CAN_BE_HANDLED, handledElsewhere } from '@/lib/handled'
import { ConfirmHandled } from './ConfirmHandled'

// Where the "Already answered them another way?" link in a reminder lands.
// The artist's page, not the client's: no sign-in, because the link went to
// her own inbox and is signed for this one lead. It shows a first name and
// what the inquiry was about, which the email already told her, and one
// button. Opening it records nothing; the button does (see /api/handled).

export const metadata: Metadata = {
  title: 'Already handled?',
  robots: { index: false, follow: false },
}

export default async function HandledPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>
  searchParams: Promise<{ t?: string | string[] }>
}) {
  const { matchId } = await params
  const sp = await searchParams
  const token = (Array.isArray(sp.t) ? sp.t[0] : sp.t) ?? ''

  if (!verifyHandled(matchId, token)) {
    return (
      <Shell>
        <h1 className="text-xl font-bold mb-2">This link has expired</h1>
        <p className="text-base text-[#b8b8b8] leading-relaxed">Open your inbox and tap &ldquo;I already handled this&rdquo; on the card instead.</p>
      </Shell>
    )
  }

  const db = createAdminClient()
  const { data: match } = db
    ? await db.from('matches').select('id, status, client_name, ai_summary').eq('id', matchId).maybeSingle()
    : { data: null }
  if (!db || !match) {
    return (
      <Shell>
        <h1 className="text-xl font-bold mb-2">One moment</h1>
        <p className="text-base text-[#b8b8b8]">This page is not available right now. Try again in a minute, or open your inbox.</p>
      </Shell>
    )
  }

  const first = (match.client_name ?? '').trim().split(/\s+/)[0] || 'this client'
  const concept = (match.ai_summary ?? '').replace(/\s+/g, ' ').trim()
  const [{ data: thread }, { data: notes }] = await Promise.all([
    db.from('match_messages').select('sender, created_at').eq('match_id', matchId),
    db.from('lead_notes').select('created_at').eq('match_id', matchId).eq('author', 'artist'),
  ])
  const settled = !CAN_BE_HANDLED.includes(match.status) || Boolean(handledElsewhere(thread ?? [], notes ?? []))

  return (
    <Shell>
      <p className="text-sm uppercase tracking-widest text-[#9b9b9b] mb-2">{first}</p>
      {concept && <p className="text-base text-[#d0d0d0] leading-relaxed mb-6 line-clamp-4">{concept}</p>}
      {settled ? (
        <>
          <h1 className="text-xl font-bold mb-2">Nothing is waiting on you here</h1>
          <p className="text-base text-[#b8b8b8] leading-relaxed">This one is already marked, answered or closed. No reminders are going out about {first}.</p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold mb-2">Already answered {first} another way?</h1>
          <p className="text-base text-[#b8b8b8] leading-relaxed mb-5">
            By text, by phone, in Messenger or at the shop. Tap the button and the reminders about {first} stop. Nothing is sent to {first}.
          </p>
          <ConfirmHandled matchId={matchId} token={token} first={first} />
        </>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white">
      <main className="max-w-lg mx-auto px-5 pt-12 pb-16">
        {children}
        <p className="mt-8">
          <Link href="/dashboard" className="text-[#c9a84c] text-sm font-medium">Open your inbox →</Link>
        </p>
      </main>
    </div>
  )
}
