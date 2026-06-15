import { createClient } from '@/lib/supabase/server'
import { Message } from '@/lib/types'

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

        // Notify Lacey via email if RESEND_API_KEY is set
        if (match && process.env.RESEND_API_KEY) {
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
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
  const body = `
New inquiry from TatzAI:

Concept: ${brief.concept ?? 'Not specified'}
Style: ${Array.isArray(brief.styles) ? brief.styles.join(', ') : brief.styles ?? 'TBD'}
Placement: ${brief.placement ?? 'TBD'}
Size: ${brief.size ?? 'TBD'}
Has reference: ${brief.has_reference ? 'Yes' : 'No'}
Budget: ${brief.budget_max_cents ? `$${Number(brief.budget_max_cents) / 100}` : 'TBD'}
Readiness score: ${brief.readiness_score ?? 0}/100

View and respond: ${dashboardUrl}
Match ID: ${matchId}
  `.trim()

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TatzAI <noreply@tatzai.com>',
      to: process.env.ARTIST_NOTIFICATION_EMAIL ?? 'lacey@rawsunart.com',
      subject: `New inquiry — ${brief.concept ?? 'new client'} · ${brief.placement ?? ''}`,
      text: body,
    }),
  })
}
