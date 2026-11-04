import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, CalendarDays, Check, Mail, ShieldCheck, X, Circle, CircleDot, UserRound } from 'lucide-react'
import { artistContext } from '@/lib/artist-session'
import { googleConfigured } from '@/lib/google/oauth'
import { tokenCryptoConfigured } from '@/lib/google/crypto'
import { connectionRows, connectionSummary, type ConnectionRow } from '@/lib/connection-status'

export const dynamic = 'force-dynamic'

// The checklist of every way a lead can reach the inbox, with the real
// status of each read from which env vars are set (names only), what it
// unlocks and who does the step. Below it, where an artist lets the
// assistant read their Gmail and Calendar, sees what it can and can't do,
// and takes the permission back.

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
  const googleConnected = Boolean(conn && !conn.needs_reconnect)
  const rows = connectionRows()
  const summary = connectionSummary(rows)

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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold">Where leads come from</h1>
              <p className="text-xs text-[#9b9b9b] mt-1">A channel that is not connected does not exist yet: nothing from it reaches the inbox, and nothing is lost either.</p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-[#c9a84c] bg-[#c9a84c]/10 border border-[#c9a84c]/30 rounded-full px-2.5 py-1">{summary.connected} of {summary.total}</span>
          </div>
          <ul className="divide-y divide-[#2a2a2a]">
            {rows.map((row) => (
              <ChannelRow key={row.key} row={row} googleConnected={googleConnected} />
            ))}
          </ul>
          <p className="text-[11px] text-[#6b6b6b]">Status is read from which settings are in place on the server, by name. No key or password is shown here or anywhere else.</p>
        </section>

        <section id="google" className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5 text-[#c9a84c]"><Mail className="w-5 h-5" /><CalendarDays className="w-5 h-5" /></div>
            <h2 className="text-lg font-semibold">Gmail and Google Calendar</h2>
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

function ChannelRow({ row, googleConnected }: { row: ConnectionRow; googleConnected: boolean }) {
  // The Google row has a second half: the server can be ready and she has not said yes yet.
  const googleReady = row.key === 'google' && row.status === 'on' && !googleConnected
  const state: 'on' | 'always' | 'ready' | 'off' = googleReady ? 'ready' : row.status
  const pill = {
    always: { label: 'Always on', cls: 'text-[#c9a84c] border-[#c9a84c]/30 bg-[#c9a84c]/10', icon: <CircleDot className="w-3 h-3" /> },
    on: { label: 'Connected', cls: 'text-green-400 border-green-800/40 bg-green-900/10', icon: <Check className="w-3 h-3" /> },
    ready: { label: 'Ready for your tap', cls: 'text-[#e0c878] border-[#c9a84c]/30 bg-[#c9a84c]/10', icon: <CircleDot className="w-3 h-3" /> },
    off: { label: 'Not yet', cls: 'text-[#6b6b6b] border-[#2a2a2a] bg-[#1e1e1e]', icon: <Circle className="w-3 h-3" /> },
  }[state]
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold leading-tight">{row.label}</p>
        <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold rounded-full border px-2 py-0.5 ${pill.cls}`}>{pill.icon}{pill.label}</span>
      </div>
      <p className="text-xs text-[#b5b5b5] mt-1">{row.unlocks}</p>
      <p className="flex items-start gap-1.5 text-[11px] text-[#8a8a8a] mt-1.5">
        <UserRound className={`w-3.5 h-3.5 mt-px shrink-0 ${row.artistLogsIn ? 'text-[#c9a84c]' : 'text-[#6b6b6b]'}`} />
        <span>
          {state === 'ready' ? 'Erica has switched it on. Tap Connect below and say yes to Google once.' : row.who}
          {row.status === 'off' && row.missing.length > 0 && (
            <span className="block text-[#6b6b6b] mt-0.5">Waiting on: {row.missing.map((m, i) => <span key={m}><code className="text-[#9b9b9b]">{m}</code>{i < row.missing.length - 1 ? ', ' : ''}</span>)}</span>
          )}
        </span>
      </p>
    </li>
  )
}
