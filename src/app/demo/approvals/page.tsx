import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Eye } from 'lucide-react'
import { ApprovalsView } from '@/app/dashboard/approvals/ApprovalsView'
import type { ApprovalView } from '@/lib/approvals'
import { RECONNECT_HTML, RECONNECT_SUBJECT, RECONNECT_TEXT } from './reconnect-email'

// The approvals screen with the real Reconnect email in it, for Lacey to read
// before Erica submits it for real. Approve here records nothing and sends
// nothing: it is a demo.

export const metadata: Metadata = { title: 'Approvals demo · RawSunArt', robots: { index: false, follow: false } }

const NOW = Date.now()
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString()

const ITEMS: ApprovalView[] = [
  {
    id: 'demo-approval-1',
    kind: 'email_campaign',
    key: 'rsa-reconnect-1',
    title: 'Reconnect: “it’s Lacey. I made something.”',
    summary: 'One email to the people you reviewed and kept on October 16. It says hello, shows the cardinal cards, and asks them to tap Keep me on the list or Take me off. Nobody who taps nothing hears from you again. Sent in batches of 150 over a few days once you approve.',
    subject: RECONNECT_SUBJECT,
    body_html: RECONNECT_HTML,
    body_text: RECONNECT_TEXT,
    audience: 'the list you reviewed Oct 16, minus anyone you excluded',
    audience_count: 197,
    status: 'pending',
    artist_notes: null,
    decided_at: null,
    submitted_by: 'erica',
    created_at: at(3 * 3_600_000),
  },
  {
    id: 'demo-approval-2',
    kind: 'blog_post',
    key: 'blog/2026-11-studio-diary',
    title: 'Studio diary, November: cardinals and the cold months',
    summary: 'A short post for rawsunart.com in your voice, drafted from your October notes. Goes on the Reflections page and in the next club email if you say so.',
    subject: null,
    body_html: null,
    body_text: 'The cold months are when I paint. The shop gets quiet after Halloween and I stop fighting it: the cardinals come out, the brushes get washed more than the machines, and I remember why I started doing this.\n\nThis year the cardinals turned into a set of five cards. People kept telling me a cardinal is someone stopping by, so I painted the visit. They are $25 for the pack, shipping included, and they are the easiest way I know to send someone a small thing that means a lot.\n\nIf you are thinking about a piece for the spring, now is the time to write. I book slower in winter and I like having the time to draw.\n\nLacey',
    audience: 'rawsunart.com/blog',
    audience_count: null,
    status: 'pending',
    artist_notes: null,
    decided_at: null,
    submitted_by: 'erica',
    created_at: at(26 * 3_600_000),
  },
]

export default async function DemoApprovalsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  // Demo data must never be mistaken for Lacey's own (Erica, Nov 3, 2026). Hidden in production unless SHOW_DEMO=1.
  if (process.env.NODE_ENV === 'production' && process.env.SHOW_DEMO !== '1') notFound()

  const { tab } = await searchParams
  return (
    <>
      <div className="bg-[#c9a84c] text-black text-xs font-semibold text-center px-4 py-2 flex items-center justify-center gap-2">
        <Eye className="w-3.5 h-3.5" /> Demo. The email is real copy; the buttons record nothing and send nothing.
      </div>
      <ApprovalsView items={ITEMS} tab={tab === 'blog_post' ? 'blog_post' : 'email_campaign'} artistName="Lacey Rawson" basePath="/demo/approvals" demo />
    </>
  )
}
