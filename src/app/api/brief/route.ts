import { createClient } from '@/lib/supabase/server'
import { Message } from '@/lib/types'
import { sendEmail } from '@/lib/resend'
import { sendSms } from '@/lib/sms'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// Called by AgentChat when BRIEF_READY fires.
// Saves the conversation + brief to Supabase, optionally emails Lacey.

interface BriefPayload {
  messages: Message[]
  brief: Record<string, unknown>
  mode?: string
  sessionId: string
}

export async function POST(req: Request) {
  try {
    const { messages, brief, mode, sessionId }: BriefPayload = await req.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Resolve or create a client row
    let clientId: string | null = null
    if (user) {
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (existing) {
        clientId = existing.id
      } else {
        const { data: created } = await supabase
          .from('clients')
          .insert({ user_id: user.id, email: user.email })
          .select('id')
          .single()
        clientId = created?.id ?? null
      }
    }

    // Save conversation
    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .insert({
        client_id: clientId,
        messages,
        brief_extracted: brief,
        session_id: sessionId,
        mode: mode ?? 'marketplace',
      })
      .select('id')
      .single()

    if (convErr) {
      console.error('conversation insert:', convErr)
      return Response.json({ error: 'DB error' }, { status: 500 })
    }

    // If single-artist mode, create a pending match/lead for Lacey
    if (mode === 'lacey') {
      // Find Lacey's artist row
      const { data: lacey } = await supabase
        .from('artists')
        .select('id')
        .eq('name', 'Lacey Rawson')
        .single()

      if (lacey) {
        const { data: match } = await supabase
          .from('matches')
          .insert({
            client_id: clientId,
            artist_id: lacey.id,
            conversation_id: conversation.id,
            status: 'pending',
            client_brief: JSON.stringify(brief),
            ai_summary: (brief.concept as string) ?? '',
            offered_price_cents: 25000, // minimum — Lacey will quote real price
            placement: (brief.placement as string) ?? '',
          })
          .select('id')
          .single()

        // Notify Lacey: email (full brief) + SMS heads-up (one-liner)
        if (match) {
          await notifyLacey(brief, match.id, sessionId)
        }
      }
    }

    return Response.json({ conversationId: conversation.id })
  } catch (err) {
    console.error('brief route:', err)
    return Response.json({ error: 'Failed to save brief' }, { status: 500 })
  }
}

async function notifyLacey(brief: Record<string, unknown>, matchId: string, sessionId: string) {
  const concept = String(brief.concept ?? 'a new piece')
  const style = Array.isArray(brief.styles) ? brief.styles.join(', ') : String(brief.styles ?? 'TBD')
  const placement = String(brief.placement ?? 'TBD')
  const size = String(brief.size ?? 'TBD')
  const budget = brief.budget_max_cents ? `$${Number(brief.budget_max_cents) / 100}` : 'TBD'
  const score = `${brief.readiness_score ?? 0}/100`

  // Full brief by email (branded, verified sender)
  const emailBody = `New qualified inquiry via your concierge:

Concept: ${concept}
Style: ${style}
Placement: ${placement}
Size: ${size}
Has reference: ${brief.has_reference ? 'Yes' : 'No'}
Budget: ${budget}
Readiness: ${score}

Just reply to this email to reach them.
(session ${sessionId} · match ${matchId})`

  await sendEmail({
    from: ARTIST_CONFIG.fromEmail,
    to: process.env.ARTIST_NOTIFICATION_EMAIL ?? ARTIST_CONFIG.email,
    subject: `🎨 New booking — ${concept} · ${placement}`,
    html: emailBody.replace(/\n/g, '<br>'),
    text: emailBody,
  })

  // One-line heads-up by SMS so she sees it where she lives (best-effort)
  await sendSms({
    to: ARTIST_CONFIG.smsNumber,
    text: `🔥 New qualified booking — ${concept} (${style}), ${placement}, ${size}. Budget ${budget}. Full brief in your email; reply there to reach them.`,
  })
}
