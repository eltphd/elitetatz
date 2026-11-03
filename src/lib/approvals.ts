// Things Lacey signs off on before they go out. Approval is a record in
// `approvals` (migration 015); the thing itself is sent or published by Erica
// afterwards, by hand, and the send script checks the record first.

export const APPROVAL_KINDS = ['email_campaign', 'blog_post'] as const
export type ApprovalKind = (typeof APPROVAL_KINDS)[number]
export const APPROVAL_STATUSES = ['pending', 'approved', 'changes_requested', 'withdrawn', 'sent', 'published'] as const
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number]

export const KIND_LABEL: Record<ApprovalKind, string> = { email_campaign: 'Email campaigns', blog_post: 'Blog posts' }

export interface ApprovalView {
  id: string
  kind: ApprovalKind
  key: string
  title: string
  summary: string | null
  subject: string | null
  body_html: string | null
  body_text: string | null
  audience: string | null
  audience_count: number | null
  status: ApprovalStatus
  artist_notes: string | null
  decided_at: string | null
  submitted_by: string
  created_at: string
}

export const isKind = (v: unknown): v is ApprovalKind => typeof v === 'string' && (APPROVAL_KINDS as readonly string[]).includes(v)
