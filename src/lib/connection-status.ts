import { CHANNEL_LABEL } from '@/lib/channel-types'

// The connections checklist: one row per way a lead can reach the inbox (and
// the two Google links), with its status read from which environment variables
// are set. Names only: a value never leaves the server and never reaches the
// page. The rule it reports is the one the routes enforce: a channel whose
// variables are missing answers 503 and does not exist (trust rule 7).

export type ConnectionKey = 'web' | 'concierge' | 'email' | 'social' | 'sms' | 'google' | 'review'
export type ConnectionStatus = 'always' | 'on' | 'off'

export interface ConnectionRow {
  key: ConnectionKey
  label: string
  /** One line: what the inbox can do once this is connected. */
  unlocks: string
  /** Who does the step, in words. */
  who: string
  /** Whether the step needs the artist to log in to something once. */
  artistLogsIn: boolean
  /** Environment variable names this channel needs. Names, never values. */
  env: string[]
  /** Which of those are not set. Empty when `status` is 'on' or 'always'. */
  missing: string[]
  status: ConnectionStatus
}

type Env = Record<string, string | undefined>

interface Spec {
  key: ConnectionKey
  label: string
  unlocks: string
  who: string
  artistLogsIn: boolean
  env: string[]
}

const SPECS: Spec[] = [
  {
    key: 'web',
    label: CHANNEL_LABEL.web,
    unlocks: 'The form on rawsunart.com lands here as a card with the brief and the client’s contact details.',
    who: 'Always on. Nobody has to do anything.',
    artistLogsIn: false,
    env: [],
  },
  {
    key: 'concierge',
    label: CHANNEL_LABEL.concierge,
    unlocks: 'The chat on rawsunart.com asks your questions, builds the brief and sends the client a link to their inquiry page.',
    who: 'Erica sets it.',
    artistLogsIn: false,
    env: ['ANTHROPIC_API_KEY', 'MATCH_TOKEN_SECRET'],
  },
  {
    key: 'email',
    label: 'Email to the inbox',
    unlocks: 'An inquiry emailed to you (or forwarded from your Gmail) becomes a card with the reference photos attached.',
    who: 'Erica sets it, then turns on the forward in your Gmail with you.',
    artistLogsIn: false,
    env: ['RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET', 'INBOUND_EMAIL_ADDRESS'],
  },
  {
    key: 'social',
    label: 'Instagram DM and Messenger',
    unlocks: 'A DM on Instagram or Messenger becomes a card, and your reply from here goes back to the same DM.',
    who: 'You log in once to Instagram and Facebook; Erica sets the rest.',
    artistLogsIn: true,
    env: ['CHATWOOT_URL', 'CHATWOOT_ACCOUNT_ID', 'CHATWOOT_API_TOKEN', 'CHATWOOT_WEBHOOK_SECRET'],
  },
  {
    key: 'sms',
    label: 'Texts to the studio line',
    unlocks: 'A text to the studio number becomes a card, and your reply from here goes back as a text.',
    who: 'Erica sets it.',
    artistLogsIn: false,
    env: ['DIALPAD_WEBHOOK_SECRET', 'DIALPAD_API_TOKEN', 'DIALPAD_FROM_NUMBER'],
  },
  {
    key: 'google',
    label: 'Gmail and Google Calendar',
    unlocks: 'The assistant can find a client’s thread or a date in your email and tell you when you are free. Read-only.',
    who: 'Erica switches it on; you tap Connect below and say yes to Google once.',
    artistLogsIn: true,
    env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_TOKEN_KEY'],
  },
  {
    key: 'review',
    label: 'Google Business review link',
    unlocks: 'After a booked session, an “Ask for a review” button that sends your review link only when you tap it.',
    who: 'Erica sets it.',
    artistLogsIn: false,
    env: ['GOOGLE_REVIEW_URL'],
  },
]

const isSet = (env: Env, name: string) => Boolean(env[name]?.trim())

/** The checklist, computed from which variables are present. Pure: pass any env. */
export function connectionRows(env: Env = process.env): ConnectionRow[] {
  return SPECS.map((spec) => {
    const missing = spec.env.filter((name) => !isSet(env, name))
    const status: ConnectionStatus = spec.env.length === 0 ? 'always' : missing.length === 0 ? 'on' : 'off'
    return { ...spec, missing, status }
  })
}

/** "5 of 7 connected" for the header. Always-on rows count as connected. */
export function connectionSummary(rows: ConnectionRow[]): { connected: number; total: number } {
  return { connected: rows.filter((r) => r.status !== 'off').length, total: rows.length }
}
