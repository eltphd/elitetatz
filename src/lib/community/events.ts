// Event funnel registry — one entry per artist-at-event QR funnel.
// Adding a new convention for any artist is a config entry here, nothing else.
// (These can graduate to the artist_events table once the artist dashboard
// grows an events editor; the page and API read from this registry first.)

export interface EventIncentive {
  icon: string
  title: string
  detail: string
}

export interface EventFunnelConfig {
  slug: string
  artistHandle: string       // matches community_members.artist_handle
  artistName: string
  artistFirstName: string
  eventTitle: string         // e.g. 'Hell City Tattoo Festival'
  city: string               // 'Phoenix, AZ'
  cityShort: string          // 'Phoenix' — used in the "Hey ___" headline
  headline?: string          // override for the hero if the default doesn't fit
  intro: string
  incentives: EventIncentive[]
  giveaway: boolean
  siteUrl: string
  instagramUrl: string
  instagramHandle: string
  bookingUrl: string
  notifyEmail: string        // where walk-up interest pings land (artist inbox)
  fromEmail: string          // branded "from" on a platform-controlled domain
  smsNumber?: string         // Dialpad/cell for one-line heads-ups
  active: boolean
}

const EVENTS: Record<string, EventFunnelConfig> = {
  'hellcity-phoenix-2026': {
    slug: 'hellcity-phoenix-2026',
    artistHandle: 'rawsunart',
    artistName: 'Lacey Rawson',
    artistFirstName: 'Lacey',
    eventTitle: 'Hell City Tattoo Festival',
    city: 'Phoenix, AZ',
    cityShort: 'Phoenix',
    intro:
      "Thanks for stopping by the booth. I'm Lacey — watercolor tattooer, painter, and potter based in Ohio. My art travels. Join the club and it can find you, wherever you live.",
    incentives: [
      { icon: '🎁', title: 'Enter the Hell City giveaway', detail: 'an original piece, winner drawn Sunday' },
      { icon: '✨', title: 'Free watercolor sticker', detail: 'from the secret stash — show your screen at the booth' },
      { icon: '🏺', title: '24-hour early access', detail: 'to pottery & original art drops before Instagram sees them' },
      { icon: '🗺', title: 'Travel dates first', detail: "know when I'm coming to your city before books open" },
    ],
    giveaway: true,
    siteUrl: 'https://rawsunart.com',
    instagramUrl: 'https://instagram.com/raw.sun.art',
    instagramHandle: '@raw.sun.art',
    bookingUrl: 'https://rawsunart.com/#inquiry',
    notifyEmail: 'lacey@rawsunart.com',
    fromEmail: 'RawSunArt <club@rawsunart.com>',
    smsNumber: '+16148585574',
    active: true,
  },
}

export function getEventConfig(slug: string): EventFunnelConfig | null {
  const event = EVENTS[slug]
  return event && event.active ? event : null
}

export function listActiveEvents(): EventFunnelConfig[] {
  return Object.values(EVENTS).filter((e) => e.active)
}
