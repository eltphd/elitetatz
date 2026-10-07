import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, CalendarDays, Check, Mail, ShieldCheck, X } from 'lucide-react'
import { artistContext } from '@/lib/artist-session'
import { googleConfigured } from '@/lib/google/oauth'
import { tokenCryptoConfigured } from '@/lib/google/crypto'

export const dynamic = 'force-dynamic'

// Where an artist lets the assistant read their Gmail and Calendar, sees
// what it can and can't do, and takes the permission back.

const NOTICES: Record<string, string> = {
  connected: 'Connected. Your assistant can now read your Gmail and Calendar.',
  disconnected: 'Disconnected. Access is withdrawn and the saved key is deleted.',
  cancelled: 'Nothing changed. You closed the Google screen before agreeing.',
  'error=scopes': 'Both boxes need to stay ticked on the Google screen (Gmail and Calendar). Nothing was saved. Try again when you are ready.',
  'error=state': 'That sign-in link expired. Please try again.',
  'error=exchange': 'Google did not finish the connection. Please try again.',
  'error=no_code': 'Google did not finish the connection. Please try again.',
  'error=store': 'Something went wrong saving the connection. Nothing was kept. Please try again.',
  'error=not_configured': 'Google connections are not switched on for this app yet.',
}

function fmt(iso: string | null): string {
  if (!iso) return 'never'
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' })
}

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await artistContext<{ id: string; name: string | null }>()
  if (!ctx.ok) redirect('/auth/login?next=/dashboard/connections')

  const sp = await searchParams
  const noticeKey = sp.connected ? 'connected' : sp.disconnected ? 'disconnected' : sp.cancelled ? 'cancelled' : sp.error ? `error=${sp.error}` : null
  const notice = noticeKey ? NOTICES[noticeKey] : null

  const { data: conn } = await ctx.db
    .from('artist_google_connections')
    .select('google_email, consented_at, last_used_at, needs_reconnect')
    .eq('artist_id', ctx.artist.id)
    .maybeSingle()

  const available = googleConfigured() && tokenCryptoConfigured()

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white">
      <header className="px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-[#1e1e1e]" aria-label="Back to inbox">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-semibold">Connections</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {notice && (
          <p role="status" className="rounded-xl border border-[#c9a84c]/30 bg-[#c9a84c]/10 px-4 py-3 text-sm text-[#e0c878]">{notice}</p>
        )}

        <section className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5 text-[#c9a84c]"><Mail className="w-5 h-5" /><CalendarDays className="w-5 h-5" /></div>
            <h1 className="text-lg font-semibold">Gmail and Google Calendar</h1>
          </div>

          {conn && !conn.needs_reconnect ? (
            <p className="text-sm text-[#b5b5b5]">
              Connected as <span className="text-white">{conn.google_email}</span> since {fmt(conn.consented_at)}.
              Last used {fmt(conn.last_used_at)}.
            </p>
          ) : conn?.needs_reconnect ? (
            <p className="text-sm text-[#e0c878]">Google stopped this connection (you may have removed it in your Google account). Reconnect to turn it back on.</p>
          ) : (
            <p className="text-sm text-[#b5b5b5]">Not connected. Your assistant can&apos;t see your email or calendar.</p>
          )}

          <div className="space-y-2 text-sm">
            <p className="font-medium">If you connect, your assistant can:</p>
            <ul className="space-y-1.5 text-[#b5b5b5]">
              <li className="flex gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0 text-[#c9a84c]" />Search your email to find a client&apos;s thread, a reference or a date, when you ask it to</li>
              <li className="flex gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0 text-[#c9a84c]" />See your upcoming calendar so it can tell you when you&apos;re free</li>
            </ul>
            <p className="font-medium pt-2">It can&apos;t, and won&apos;t:</p>
            <ul className="space-y-1.5 text-[#b5b5b5]">
              <li className="flex gap-2"><X className="w-4 h-4 mt-0.5 shrink-0 text-[#6b6b6b]" />Send, delete, move or change any email or event (read-only)</li>
              <li className="flex gap-2"><X className="w-4 h-4 mt-0.5 shrink-0 text-[#6b6b6b]" />Share your email, clients or calendar with other artists, the studio or anyone else</li>
              <li className="flex gap-2"><X className="w-4 h-4 mt-0.5 shrink-0 text-[#6b6b6b]" />Keep copies of your messages. It reads what it needs at the moment you ask.</li>
            </ul>
          </div>

          <p className="flex gap-2 text-xs text-[#8a8a8a]">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[#c9a84c]" />
            Your clients are yours. Turn this off any time here, or in your Google account under Security → Third-party connections. Turning it off deletes the saved key straight away.
          </p>

          {!available ? (
            <p className="text-sm text-[#8a8a8a]">Coming soon: Google connections aren&apos;t switched on yet.</p>
          ) : conn && !conn.needs_reconnect ? (
            <form action="/api/artist/google/disconnect" method="post">
              <button className="w-full rounded-2xl border border-[#2a2a2a] bg-[#1e1e1e] py-3.5 text-sm font-medium hover:border-[#c9a84c]/30">
                Disconnect Gmail and Calendar
              </button>
            </form>
          ) : (
            <a href="/api/artist/google/connect" className="block w-full rounded-2xl bg-[#c9a84c] py-4 text-center text-sm font-bold text-black hover:bg-[#d4b45a]">
              {conn?.needs_reconnect ? 'Reconnect Google' : 'Connect Gmail and Calendar'}
            </a>
          )}
        </section>
      </main>
    </div>
  )
}
