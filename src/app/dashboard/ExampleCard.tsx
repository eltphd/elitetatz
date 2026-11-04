import { Eye } from 'lucide-react'
import type { ThreadMessage } from '@/components/InquiryThread'
import { LeadCard, type Lead } from './LeadCard'

// One made-up lead for an inbox with none yet, so the five taps can be seen
// before the first real one. Rendered with the card's demo switch: every
// button fakes its result on the page, no request is made, nothing is
// written and nothing is sent. Not a demo page (those stay off in
// production): one card, inside her own inbox, marked as an example.

const H = 3_600_000
const at = (msAgo: number) => new Date(Date.now() - msAgo).toISOString()

export const EXAMPLE_ID = 'example-0000-0000-0000-000000000000'

function exampleLead(): Lead {
  return {
    id: EXAMPLE_ID,
    status: 'pending',
    channel: 'instagram',
    created_at: at(2 * H),
    client_name: 'Maya R.',
    client_email: null,
    client_phone: null,
    external_thread_id: 'chatwoot:example',
    ai_summary: 'Watercolor peony on the outer forearm, about 4 inches',
    client_brief: JSON.stringify({
      concept: 'Watercolor peony on the outer forearm, loose color splash, for her mom who grew peonies',
      styles: ['watercolor'], placement: 'outer forearm', size: 'about 4 inches',
      budget_max_cents: 50000, has_reference: true, creative_freedom: true, handle: '@maya.inks',
      open_questions: ['whether she wants fine lines under the color or color only'],
    }),
    offered_price_cents: null, placement: null, artist_response: null, conversation_id: null,
    proposed_dates: null, appointment_at: null, design_fee_cents: null, date_request: null, stripe_payment_intent_id: null,
    last_client_message_at: at(2 * H), clients: null,
  }
}

function exampleThread(): ThreadMessage[] {
  return [
    { id: 'ex-1', sender: 'system', body: 'Inquiry arrived by instagram dm.', created_at: at(2 * H) },
    { id: 'ex-2', sender: 'client', channel: 'instagram', body: "hi!! i've been following your watercolor stuff forever. i want a peony on my outer forearm, maybe 4 inches? it's for my mom, she grew them. i like it loose, more of a color splash than the exact flower. budget is around $500 \u{1F338}", created_at: at(2 * H) },
  ]
}

export function ExampleCard() {
  return (
    <section aria-label="Example card" className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium">Example · what a card looks like</p>
      </div>
      <div className="rounded-2xl border border-dashed border-[#c9a84c]/40 p-1.5">
        <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-[#c9a84c] py-1.5">
          <Eye className="w-3.5 h-3.5" />
          Example. Maya is not real. Tap anything: nothing is saved and nothing is sent.
        </div>
        <LeadCard lead={exampleLead()} group="needs_you" thread={exampleThread()} demo />
      </div>
    </section>
  )
}
