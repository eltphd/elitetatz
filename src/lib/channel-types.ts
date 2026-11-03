// Shared by server and client code: which ways a client can reach the artist,
// and how each is named on a card. The database helpers live in channels.ts.

export type Channel = 'web' | 'concierge' | 'email' | 'instagram' | 'facebook' | 'sms' | 'manual'
export const CHANNELS: Channel[] = ['web', 'concierge', 'email', 'instagram', 'facebook', 'sms', 'manual']

export const CHANNEL_LABEL: Record<Channel, string> = {
  web: 'Website form',
  concierge: 'Concierge chat',
  email: 'Email',
  instagram: 'Instagram DM',
  facebook: 'Facebook Messenger',
  sms: 'Text message',
  manual: 'Added by hand',
}

/** Short form for a badge. */
export const CHANNEL_SHORT: Record<Channel, string> = {
  web: 'Web',
  concierge: 'Concierge',
  email: 'Email',
  instagram: 'Instagram',
  facebook: 'Messenger',
  sms: 'Text',
  manual: 'By hand',
}

export function isChannel(v: unknown): v is Channel {
  return typeof v === 'string' && (CHANNELS as string[]).includes(v)
}

export function channelLabel(v: string | null | undefined, short = false): string {
  if (isChannel(v)) return short ? CHANNEL_SHORT[v] : CHANNEL_LABEL[v]
  return v ? v : short ? 'Web' : 'Website form'
}
