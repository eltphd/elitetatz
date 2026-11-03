import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, Clock, CheckCircle, CalendarCheck, Eye } from 'lucide-react'
import type { ThreadMessage } from '@/components/InquiryThread'
import { LeadCard, groupOf, type Group, type Lead } from '@/app/dashboard/LeadCard'
import type { AttachmentView } from '@/app/dashboard/AttachmentGrid'
import type { NoteView } from '@/app/dashboard/NotesPanel'
import type { ClientHistory } from '@/lib/client-history'

// The inbox with four made-up leads, one per channel, for showing Lacey what
// she gets before any account is connected. Nothing on this page is real and
// nothing on it sends anything: every button fakes its result locally.

export const metadata: Metadata = { title: 'Inbox demo · RawSunArt', robots: { index: false, follow: false } }

const H = 3_600_000
const D = 24 * H
const NOW = Date.now()
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString()

const base = {
  offered_price_cents: null, placement: null, artist_response: null, conversation_id: null, external_thread_id: null,
  proposed_dates: null, appointment_at: null, design_fee_cents: null, date_request: null, stripe_payment_intent_id: null,
  last_client_message_at: null, clients: null,
}

const LEADS: Lead[] = [
  {
    ...base,
    id: 'demo-1111-aaaa-bbbb-000000000001',
    status: 'pending',
    channel: 'instagram',
    created_at: at(2 * H),
    client_name: 'Maya R.',
    client_email: null,
    client_phone: null,
    external_thread_id: 'chatwoot:demo-1',
    ai_summary: 'Watercolor peony on the outer forearm, about 4 inches',
    client_brief: JSON.stringify({
      concept: 'Watercolor peony on the outer forearm, loose color splash, for her mom who grew peonies',
      styles: ['watercolor'], placement: 'outer forearm', size: 'about 4 inches',
      budget_max_cents: 50000, has_reference: true, creative_freedom: true, handle: '@maya.inks',
      open_questions: ['whether she wants fine lines under the color or color only', 'whether it wraps toward the inner arm'],
    }),
  },
  {
    ...base,
    id: 'demo-2222-aaaa-bbbb-000000000002',
    status: 'info_requested',
    channel: 'email',
    created_at: at(2 * D),
    client_name: 'Devon Carter',
    client_email: 'devon.carter@example.com',
    client_phone: '+16145550142',
    ai_summary: 'Fine-line moth with a watercolor wash, sternum',
    client_brief: JSON.stringify({
      concept: 'Fine-line moth with a soft watercolor wash behind it',
      styles: ['fine-line', 'watercolor'], placement: 'sternum', size: '',
      budget_max_cents: 70000, has_reference: true, subject: 'Tattoo inquiry - moth piece',
      scale_check: 'The reference has wing detail that will close up under 5 inches.', scale_confirmed: false,
    }),
  },
  {
    ...base,
    id: 'demo-3333-aaaa-bbbb-000000000003',
    status: 'accepted',
    channel: 'concierge',
    conversation_id: 'demo-conv',
    created_at: at(4 * D),
    client_name: 'Priya Natarajan',
    client_email: 'priya@example.com',
    client_phone: null,
    offered_price_cents: 65000,
    proposed_dates: 'Thu Nov 13 at 1pm or Sat Nov 15 at noon',
    ai_summary: 'Floral forearm piece, illustrative with color',
    client_brief: JSON.stringify({
      concept: 'Illustrative floral band around the forearm, color', styles: ['illustrative', 'watercolor'], placement: 'forearm', size: '6 inches',
      budget_min_cents: 50000, budget_max_cents: 80000, has_reference: true, deposit_ready: true, readiness_score: 82, scale_confirmed: true,
      reference_keepers: [{ for: ['color', 'flow'], note: 'the way the stems wrap' }],
    }),
  },
  {
    ...base,
    id: 'demo-4444-aaaa-bbbb-000000000004',
    status: 'booked',
    channel: 'sms',
    created_at: at(12 * D),
    client_name: null,
    client_email: null,
    client_phone: '+16145550199',
    offered_price_cents: 40000,
    appointment_at: at(5 * D),
    ai_summary: 'Small lines-only wave behind the ear',
    client_brief: JSON.stringify({ concept: 'Small lines-only wave behind the ear', styles: ['fine-line'], placement: 'behind the ear', size: '1.5 inches', budget_max_cents: 30000 }),
  },
  {
    ...base,
    id: 'demo-5555-aaaa-bbbb-000000000005',
    status: 'pending',
    channel: 'email',
    created_at: at(5 * H),
    client_name: 'Jordan Ellis',
    client_email: 'jordan.ellis@example.com',
    client_phone: '+16145550177',
    ai_summary: 'Second watercolor fern, right shoulder, to pair with the first',
    client_brief: JSON.stringify({
      concept: 'A second watercolor fern on the right shoulder to pair with the one from last spring, a little warmer in color',
      styles: ['watercolor'], placement: 'right shoulder', size: 'same as the first, about 5 inches',
      budget_max_cents: 60000, has_reference: false, creative_freedom: true, subject: 'Round two!',
    }),
  },
]

// Who Lacey already knows. Read from her records on the live inbox; fixed here.
const HISTORY: Record<string, ClientHistory> = {
  [LEADS[4].id]: { kind: 'returning', sessions: 1, lastSessionAt: at(230 * D), priorLeads: 0, onList: true, listStatus: 'legacy-customer', listSince: '2025', lastService: null, listSource: 'client export' },
}

const THREADS: Record<string, ThreadMessage[]> = {
  [LEADS[0].id]: [
    { id: 't1', sender: 'system', body: 'Inquiry arrived by instagram dm.', created_at: at(2 * H) },
    { id: 't2', sender: 'client', channel: 'instagram', body: "hi!! i've been following your watercolor stuff forever. i want a peony on my outer forearm, maybe 4 inches? it's for my mom, she grew them. i have a reference but i like it loose, more of a color splash than the exact flower. budget is around $500. sending two pics 🌸", created_at: at(2 * H) },
  ],
  [LEADS[1].id]: [
    { id: 't3', sender: 'system', body: 'Inquiry arrived by email.', created_at: at(2 * D) },
    { id: 't4', sender: 'client', channel: 'email', body: "Hi Lacey,\n\nI'd love to get a fine-line moth on my sternum with a soft watercolor wash behind it. Reference attached (the wing detail is what I love). Budget up to $700. I'm free most weekends.\n\nThanks,\nDevon", created_at: at(2 * D) },
    { id: 't5', sender: 'artist', body: 'Hey Devon! I can work with this. Quick thing before I quote: roughly how big are you picturing it? The wing detail in your reference will close up under about 5 inches on the sternum, so I want to make sure the amount of detail is what you want and not just the style.', created_at: at(2 * D - 3 * H) },
    { id: 't6', sender: 'client', channel: 'email', body: "Oh good to know. I was thinking 4 inches but I'd go to 5 or 6 if that keeps the wings. The style matters more to me than every line.", created_at: at(5 * H) },
  ],
  [LEADS[2].id]: [
    { id: 't7', sender: 'system', body: 'Inquiry sent from the concierge.', created_at: at(4 * D) },
    { id: 't8', sender: 'artist', body: 'Accepted — quote $650.\nProposed dates: Thu Nov 13 at 1pm or Sat Nov 15 at noon', created_at: at(3 * D) },
    { id: 't9', sender: 'client', body: 'Saturday works! Paying the deposit now.', created_at: at(3 * D - 2 * H) },
  ],
  [LEADS[4].id]: [
    { id: 't14', sender: 'system', body: 'Inquiry arrived by email.', created_at: at(5 * H) },
    { id: 't15', sender: 'client', channel: 'email', body: "Hey Lacey! It's Jordan, you did my fern last March. I'm ready for its pair on the other shoulder, maybe a little warmer in the color this time. Same size. Any Saturdays open this month? I know the drill on the deposit.", created_at: at(5 * H) },
  ],
  [LEADS[3].id]: [
    { id: 't10', sender: 'system', body: 'Inquiry arrived by text message.', created_at: at(12 * D) },
    { id: 't11', sender: 'client', channel: 'sms', body: 'Hey! Do you do tiny stuff? Want a little wave behind my ear, just lines. Like 1.5 inches', created_at: at(12 * D) },
    { id: 't12', sender: 'artist', body: 'Accepted — quote $400.\nProposed dates: Wed Oct 29 at 2pm', created_at: at(11 * D) },
    { id: 't13', sender: 'artist', body: 'Appointment confirmed: Wed, Oct 29, 2:00 PM', created_at: at(10 * D) },
  ],
}

const FILES: Record<string, AttachmentView[]> = {
  [LEADS[0].id]: [
    { id: 'f1', filename: 'peony-ref.jpg', mime: 'image/jpeg', size_bytes: 412_000, source: 'instagram', url: '/demo/ref-1.svg', created_at: at(2 * H) },
    { id: 'f2', filename: 'color-splash.jpg', mime: 'image/jpeg', size_bytes: 388_000, source: 'instagram', url: '/demo/ref-3.svg', created_at: at(2 * H) },
  ],
  [LEADS[1].id]: [
    { id: 'f3', filename: 'moth-reference.png', mime: 'image/png', size_bytes: 1_240_000, source: 'email', url: '/demo/ref-2.svg', created_at: at(2 * D) },
    { id: 'f4', filename: 'placement-idea.pdf', mime: 'application/pdf', size_bytes: 2_100_000, source: 'email', url: null, created_at: at(2 * D) },
  ],
  [LEADS[2].id]: [
    { id: 'f5', filename: 'floral-band.jpg', mime: 'image/jpeg', size_bytes: 650_000, source: 'client', url: '/demo/ref-3.svg', created_at: at(4 * D) },
  ],
}

const NOTES: Record<string, NoteView[]> = {
  [LEADS[1].id]: [
    { id: 'n1', author: 'artist', kind: 'note', body: 'Sternum + fine line = suggest 5" minimum. Check skin tone for the wash.', created_at: at(2 * D - 2 * H) },
    { id: 'n2', author: 'assistant', kind: 'question', body: '[intent]', created_at: at(6 * H) },
    { id: 'n3', author: 'assistant', kind: 'answer', body: 'Devon wants the moth for the style, not the line count: they said so directly in the reply. They moved from 4 to 5–6 inches without being pushed, so size is settled enough to quote. Budget up to $700 covers your 4–10 inch band at the low end.\n\nStill unknown:\n- Color palette for the wash (warm or cool)\n\nI would quote now, around $700, and ask about the palette in the same message.', created_at: at(6 * H) },
  ],
}

export default function DemoInboxPage() {
  const groups: Record<Group, Lead[]> = { needs_you: [], waiting: [], booked: [], closed: [] }
  for (const lead of LEADS) groups[groupOf(lead, THREADS[lead.id] ?? [])].push(lead)
  const sections: { key: Group; title: string; hint?: string; pulse?: boolean }[] = [
    { key: 'needs_you', title: 'Needs you', hint: 'New inquiries and client replies', pulse: true },
    { key: 'waiting', title: 'Waiting on client', hint: 'Questions out, quotes unpaid' },
    { key: 'booked', title: 'Booked', hint: 'Deposit in' },
    { key: 'closed', title: 'Closed' },
  ]

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white">
      <div className="bg-[#c9a84c] text-black text-xs font-semibold text-center px-4 py-2 flex items-center justify-center gap-2">
        <Eye className="w-3.5 h-3.5" /> Demo inbox. Nothing here is real and nothing on this page sends anything.
      </div>
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#c9a84c] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
            <div>
              <p className="text-sm font-bold">RawSunArt Studio</p>
              <p className="text-[10px] text-[#6b6b6b]">Lead inbox · Lacey Rawson</p>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            <span className="text-xs text-[#c9a84c] font-medium">Add a lead</span>
            <Link href="/demo/approvals" className="text-xs text-[#c9a84c] font-medium">Approvals <span className="text-[10px] font-bold bg-[#c9a84c] text-black rounded-full px-1.5 leading-4">2</span></Link>
            <Link href="/rawsunart" className="text-xs text-[#9b9b9b] font-medium hidden sm:inline">Portfolio →</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-16">
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Needs you', value: groups.needs_you.length, icon: Clock, color: 'text-[#c9a84c]' },
            { label: 'Waiting', value: groups.waiting.length, icon: CheckCircle, color: 'text-[#e0c878]' },
            { label: 'Booked', value: groups.booked.length, icon: CalendarCheck, color: 'text-green-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 text-center">
              <Icon className={`w-4 h-4 ${color} mx-auto mb-1.5`} />
              <p className="text-2xl font-bold mb-0.5">{value}</p>
              <p className="text-[10px] text-[#6b6b6b]">{label}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4 text-xs text-[#9b9b9b] leading-relaxed">
          <p className="text-white font-semibold mb-1">What you are looking at</p>
          <p>Five inquiries that came in four different ways: an Instagram DM, two emails, the website concierge, a text. Each is one card with the client&apos;s words, their reference photos, what is still open, a starting number from your price bands, your private notes, and an assistant that has read all of it. One of them is someone you have tattooed before, and the card says so. Tap anything.</p>
          <p className="mt-2">Nothing changes in what you do now. Email still lands in Gmail, DMs stay in Instagram, texts still ring your phone. This is a copy of all of it in one place, with the thinking done. Use it alongside, and see which one you reach for.</p>
        </div>

        {sections.map(({ key, title, hint, pulse }) => {
          const list = groups[key]
          if (list.length === 0) return null
          return (
            <section key={key} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                {pulse && <div className="w-2 h-2 rounded-full bg-[#c9a84c] animate-pulse" />}
                <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium">{title} · {list.length}</p>
                {hint && <p className="text-[10px] text-[#4a4a4a] ml-auto">{hint}</p>}
              </div>
              <div className="space-y-3">
                {list.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} group={key} thread={THREADS[lead.id] ?? []} attachments={FILES[lead.id] ?? []} notes={NOTES[lead.id] ?? []} history={HISTORY[lead.id]} reviewUrlConfigured demo />
                ))}
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}
