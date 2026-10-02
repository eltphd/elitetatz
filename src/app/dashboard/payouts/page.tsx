import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Wallet } from 'lucide-react'
import { artistContext } from '@/lib/artist-session'
import { PayoutsClient } from './PayoutsClient'

// Artist-only. Where Lacey connects the account that receives her 80% and
// sees what TatzAI is holding for her.

function first(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const ctx = await artistContext()
  if (!ctx.ok && ctx.status === 401) redirect('/auth/login?next=/dashboard/payouts')
  const artist = ctx.ok ? ctx.artist : null
  const user = ctx.ok ? ctx.user : null

  const sp = await searchParams
  const connected = first(sp.connected)
  const refresh = first(sp.refresh)
  const banner: { kind: 'connected' | 'refresh'; target: 'artist' | 'shop' } | null =
    connected === 'artist' || connected === 'shop'
      ? { kind: 'connected', target: connected }
      : refresh === 'artist' || refresh === 'shop'
        ? { kind: 'refresh', target: refresh }
        : null

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-[#1e1e1e] transition-colors" aria-label="Back to inbox">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-8 h-8 rounded-full bg-[#c9a84c] flex items-center justify-center">
              <Wallet className="w-4 h-4 text-black" />
            </div>
            <div>
              <p className="text-sm font-bold">Payouts</p>
              <p className="text-[10px] text-[#6b6b6b]">{artist?.name ?? user?.email ?? ''}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-16">
        {!artist ? (
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 text-sm text-[#9b9b9b]">
            This login isn&apos;t linked to an artist profile yet, so there&apos;s nothing to pay out.
          </div>
        ) : (
          <PayoutsClient banner={banner} />
        )}
      </main>
    </div>
  )
}
