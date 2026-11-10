import { Eye, ArrowRight, Hourglass, CheckCircle2, ExternalLink } from 'lucide-react'
import { clientSaw, standing, whenWords, type StandingLead, type StandingMessage } from '@/lib/standing'

// The two things a card says before it offers anything to tap: where this
// stands (what already happened, whose move it is), and what the client has
// been sent. Server components; nothing here sends anything.

export function StandingBanner({ lead, thread, first }: { lead: StandingLead; thread: StandingMessage[]; first: string }) {
  const s = standing(lead, thread, first)
  const tone =
    s.whose === 'you' ? 'border-[#c9a84c]/40 bg-[#c9a84c]/10'
    : s.whose === 'them' ? 'border-green-800/40 bg-green-900/15'
    : 'border-[#2a2a2a] bg-[#1e1e1e]'
  const Icon = s.whose === 'you' ? ArrowRight : s.whose === 'them' ? Hourglass : CheckCircle2
  const label = s.whose === 'you' ? 'Your move' : s.whose === 'them' ? 'Their move' : 'Settled'
  return (
    <div className={`mb-3 rounded-xl border px-3 py-2.5 ${tone}`}>
      <p className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${s.whose === 'you' ? 'text-[#e0c878]' : s.whose === 'them' ? 'text-green-300' : 'text-[#9b9b9b]'}`}>
        <Icon className="w-3 h-3" /> Where this stands · {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-snug text-white">{s.headline}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-[#b8b8b8]">{s.detail}</p>
      {s.said && (
        <p className="mt-2 border-l-2 border-[#4a4a4a] pl-2 text-[11px] leading-relaxed text-[#d0d0d0] whitespace-pre-wrap line-clamp-4">
          <span className="text-[#8a8a8a]">{s.said.who === 'you' ? 'You said: ' : `${first} said: `}</span>{s.said.text}
        </p>
      )}
    </div>
  )
}

export function ClientView({
  lead,
  thread,
  first,
  replyVia,
  pageUrl,
  demo = false,
}: {
  lead: StandingLead
  thread: StandingMessage[]
  first: string
  /** How a message from here reaches them, in words: "email and text". */
  replyVia: string
  /** Their inquiry page, when links are configured. */
  pageUrl: string | null
  demo?: boolean
}) {
  const seen = clientSaw(lead, thread, replyVia)
  const hasPage = (lead.channel ?? 'web') === 'web' || lead.channel === 'concierge' || seen.some((s) => s.what === 'Your message')
  return (
    <details className="mb-3 rounded-xl border border-[#2a2a2a] bg-[#161616] group">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs text-[#d0d0d0]">
        <Eye className="w-3.5 h-3.5 text-[#9b9b9b]" />
        <span className="font-medium">What {first} has been sent</span>
        <span className="text-[#8a8a8a]">· {seen.length === 0 ? 'nothing yet' : `${seen.length} ${seen.length === 1 ? 'thing' : 'things'}`}</span>
        <span className="ml-auto text-[10px] text-[#8a8a8a] group-open:hidden">show</span>
        <span className="ml-auto hidden text-[10px] text-[#8a8a8a] group-open:inline">hide</span>
      </summary>
      <div className="space-y-2 border-t border-[#2a2a2a] px-3 py-2.5">
        {seen.length === 0 && (
          <p className="text-[11px] leading-relaxed text-[#b8b8b8]">
            Nothing has gone to {first} from here. They wrote to you; they have not been sent an email or a page by the portal.
          </p>
        )}
        {seen.map((s, i) => (
          <div key={`${s.at}-${i}`} className="text-[11px] leading-relaxed">
            <p className="text-[#d0d0d0]"><span className="font-semibold">{s.what}</span> <span className="text-[#8a8a8a]">· {whenWords(s.at)}</span></p>
            <p className="text-[#9b9b9b]">{s.how}.</p>
            {s.body && <p className="mt-0.5 border-l-2 border-[#3a3a3a] pl-2 text-[#b8b8b8] whitespace-pre-wrap line-clamp-3">{s.body}</p>}
          </div>
        ))}
        <div className="border-t border-[#2a2a2a] pt-2 text-[11px] leading-relaxed text-[#9b9b9b]">
          {hasPage ? (
            <>
              <p>
                <span className="font-semibold text-[#d0d0d0]">Their page.</span> {first} has one private page with this conversation, your quote, the deposit button and the date. No login.
              </p>
              {pageUrl ? (
                <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold text-[#e0c878] underline underline-offset-2">
                  Open the page {first} sees <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <p className="mt-1 text-[#8a8a8a]">{demo ? 'In the real inbox, a link here opens the exact page they see.' : 'The link to their page is not available right now.'}</p>
              )}
            </>
          ) : (
            <p>
              <span className="font-semibold text-[#d0d0d0]">No page yet.</span> {first} wrote to you directly, so all they have is your emails. They get a page the first time you send something from here.
            </p>
          )}
        </div>
      </div>
    </details>
  )
}
