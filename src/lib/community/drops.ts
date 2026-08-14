// Booth Drops registry — the artist's sellable pieces, config-first.
// ⚠️ PRICES BELOW ARE PLACEHOLDERS — edit titles/prices/kinds with the artist
// before promoting hard. Items graduate to the `drops` table once the
// ingestion agent (Telegram/SMS -> post) is live; the page reads this
// registry first so the store works with zero backend configuration.

export interface DropItem {
  slug: string
  title: string
  description: string
  kind: 'print' | 'original' | 'pottery' | 'flash' | 'merch'
  priceCents: number
  imageUrl: string
  status: 'available' | 'reserved' | 'sold'
}

export interface ArtistDropsConfig {
  artistHandle: string
  artistName: string
  artistFirstName: string
  notifyEmail: string
  instagramUrl: string
  instagramHandle: string
  siteUrl: string
  intro: string
  boothNote?: string
  items: DropItem[]
}

const IMG = 'https://rawsunart.com/images/webp'

const DROPS: Record<string, ArtistDropsConfig> = {
  rawsunart: {
    artistHandle: 'rawsunart',
    artistName: 'Lacey Rawson',
    artistFirstName: 'Lacey',
    notifyEmail: 'lacey@rawsunart.com',
    instagramUrl: 'https://instagram.com/raw.sun.art',
    instagramHandle: '@raw.sun.art',
    siteUrl: 'https://rawsunart.com',
    intro:
      'Prints and pieces from the studio. Claim one and Lacey emails you directly — pay when you two connect, ship anywhere.',
    boothNote: 'At Hell City this weekend? Claimed pieces can be picked up at the booth.',
    items: [
      {
        slug: 'birdy-blue-print',
        title: 'Birdy Blue',
        description: 'Watercolor print · signed',
        kind: 'print',
        priceCents: 4500,
        imageUrl: `${IMG}/birdybluewatercolor.webp`,
        status: 'available',
      },
      {
        slug: 'cardinal-print',
        title: 'Cardinal',
        description: 'Watercolor print · signed',
        kind: 'print',
        priceCents: 4500,
        imageUrl: `${IMG}/cardinalcolor.webp`,
        status: 'available',
      },
      {
        slug: 'fall-leaves-print',
        title: 'Fall Leaves',
        description: 'Watercolor print · signed',
        kind: 'print',
        priceCents: 4500,
        imageUrl: `${IMG}/Fallleaveswatercolor.webp`,
        status: 'available',
      },
      {
        slug: 'crystals-print',
        title: 'Crystals',
        description: 'Watercolor print · signed',
        kind: 'print',
        priceCents: 4500,
        imageUrl: `${IMG}/crystalswatercolor.webp`,
        status: 'available',
      },
      {
        slug: 'butterflies-print',
        title: 'Butterflies',
        description: 'Watercolor print · signed',
        kind: 'print',
        priceCents: 4500,
        imageUrl: `${IMG}/butterflysandwatercolor.webp`,
        status: 'available',
      },
      {
        slug: 'black-roses-print',
        title: 'Black Roses',
        description: 'Black & grey print · signed',
        kind: 'print',
        priceCents: 4500,
        imageUrl: `${IMG}/blackroses.webp`,
        status: 'available',
      },
    ],
  },
}

export function getArtistDrops(handle: string): ArtistDropsConfig | null {
  return DROPS[handle.toLowerCase()] ?? null
}

export function findDropItem(handle: string, slug: string): DropItem | null {
  const cfg = getArtistDrops(handle)
  return cfg?.items.find((i) => i.slug === slug) ?? null
}
