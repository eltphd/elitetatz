'use client'

import { useState } from 'react'
import { LeadActions, type QuoteHint } from './LeadActions'
import { AssistantPanel } from './AssistantPanel'
import { WordingHelper } from './WordingHelper'
import { NotesPanel, type NoteView } from './NotesPanel'
import { ConversationViewer } from './ConversationViewer'
import type { ThreadMessage } from '@/components/InquiryThread'

// The interactive half of a lead card: her buttons, the assistant, her notes,
// the thread. Held together here so an assistant draft can land in the reply
// box or the "More info" question with one tap. Everything is still hers to
// send; nothing here contacts the client on its own.

export interface LeadWorkspaceProps {
  matchId: string
  status: string
  actionable: boolean
  conversationId: string | null
  thread: ThreadMessage[]
  clientName: string
  canReply: boolean
  dateRequest: string | null
  appointmentAt: string | null
  suggestedQuestion: string
  quote: QuoteHint | null
  notes: NoteView[]
  replyVia: string
  reviewUrlConfigured: boolean
  sessionDone: boolean
  returning?: boolean
  demo?: boolean
}

export function LeadWorkspace(p: LeadWorkspaceProps) {
  const [draft, setDraft] = useState('')
  const [draftKey, setDraftKey] = useState(0)
  const [question, setQuestion] = useState('')
  const [questionKey, setQuestionKey] = useState(0)
  const canAskMore = p.status === 'pending' || p.status === 'info_requested'

  const open = !['rejected', 'cancelled', 'completed'].includes(p.status)

  return (
    <>
      {open && (
        <WordingHelper
          matchId={p.matchId}
          clientName={p.clientName}
          canReply={p.canReply}
          onUse={(t) => {
            setDraft(t); setDraftKey((k) => k + 1)
            // Bring the reply box into view: that is where she reads it over and sends.
            if (typeof document !== 'undefined') document.getElementById(`thread-${p.matchId}`)?.scrollIntoView({ behavior: 'smooth', block: 'end' })
          }}
          demo={p.demo}
        />
      )}
      {p.actionable && (
        <LeadActions
          matchId={p.matchId}
          status={p.status as 'pending' | 'info_requested' | 'accepted' | 'paid' | 'booked' | 'completed'}
          clientName={p.clientName}
          dateRequest={p.dateRequest}
          appointmentAt={p.appointmentAt}
          suggestedQuestion={p.suggestedQuestion}
          quote={p.quote ?? undefined}
          draftQuestion={question}
          draftKey={questionKey}
          reviewUrlConfigured={p.reviewUrlConfigured}
          sessionDone={p.sessionDone}
          demo={p.demo}
        />
      )}
      <AssistantPanel
        matchId={p.matchId}
        notes={p.notes}
        onDraft={(t) => { setDraft(t); setDraftKey((k) => k + 1) }}
        onQuestion={canAskMore && p.actionable ? (t) => { setQuestion(t); setQuestionKey((k) => k + 1) } : undefined}
        returning={p.returning}
        demo={p.demo}
      />
      <NotesPanel matchId={p.matchId} notes={p.notes} demo={p.demo} />
      <ConversationViewer
        matchId={p.matchId}
        conversationId={p.conversationId}
        thread={p.thread}
        clientName={p.clientName}
        canReply={p.canReply}
        replyVia={p.replyVia}
        draft={draft}
        draftKey={draftKey}
        demo={p.demo}
      />
    </>
  )
}
