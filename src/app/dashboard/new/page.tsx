import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { artistContext } from '@/lib/artist-session'
import { NewLeadForm } from './NewLeadForm'

// A lead that did not come through a connected channel: a DM she pastes in, a
// voicemail she types up, someone who walked in. It becomes a card like every
// other one; the client is not contacted.

export const metadata: Metadata = { title: 'Add a lead · RawSunArt Inbox', robots: { index: false, follow: false } }

export default async function NewLeadPage() {
  const ctx = await artistContext()
  if (!ctx.ok && ctx.status === 401) redirect('/auth/login?next=/dashboard/new')
  if (!ctx.ok) redirect('/dashboard')
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white">
      <main className="max-w-lg mx-auto px-4 pt-6 pb-16">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-xs text-[#9b9b9b] hover:text-white mb-5"><ArrowLeft className="w-3.5 h-3.5" /> Inbox</Link>
        <h1 className="text-lg font-bold mb-1">Add a lead</h1>
        <p className="text-xs text-[#9b9b9b] mb-5">Paste what the client wrote wherever they wrote it. The brief fields are read out of the text; the card looks like every other card. Nothing is sent to them.</p>
        <NewLeadForm />
      </main>
    </div>
  )
}
