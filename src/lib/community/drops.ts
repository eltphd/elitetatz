// Booth Drops registry — the artist's sellable pieces, config-first.
// ⚠️ PRICES ARE PLACEHOLDERS ($45) — confirm with the artist before promoting.
// Images are served from the artist's presence site (rawsunart.com/images/prints)
// so this app hotlinks them; no asset duplication. Items graduate to the `drops`
// table once the Telegram/SMS ingestion agent posts directly; the page reads
// this registry first so the store works with zero backend configuration.

export interface DropItem {
  slug: string
  title: string
  description: string
  kind: 'print' | 'original' | 'pottery' | 'flash' | 'merch'
  priceCents: number
  imageUrl: string
  boothQty: number            // physical copies at the booth this weekend
  status: 'available' | 'reserved' | 'sold'
}

export interface ArtistDropsConfig {
  artistHandle: string
  artistName: string
  artistFirstName: string
  notifyEmail: string          // artist's real inbox — where their copy lands
  fromEmail: string            // branded "from" on a domain the platform controls
  instagramUrl: string
  instagramHandle: string
  siteUrl: string
  intro: string
  boothNote?: string
  items: DropItem[]
}

const IMG = 'https://rawsunart.com/images/prints'
const PRINT_PRICE = 2500 // $25 per signed print

const DROPS: Record<string, ArtistDropsConfig> = {
  rawsunart: {
    artistHandle: 'rawsunart',
    artistName: 'Lacey Rawson',
    artistFirstName: 'Lacey',
    notifyEmail: 'lacey@rawsunart.com',
    fromEmail: 'RawSunArt <club@rawsunart.com>',
    instagramUrl: 'https://instagram.com/raw.sun.art',
    instagramHandle: '@raw.sun.art',
    siteUrl: 'https://rawsunart.com',
    intro:
      'Signed prints — only 10 of each came to Hell City. Reserve one and you\'ll get a pickup code by email: bring it to the booth within 20 minutes and it\'s yours. Miss the window and it releases to the next collector (or order online anytime).',
    boothNote: 'At Hell City now? Reserve → get your code → show Lacey at the booth. First come, first served.',
    items: [
      { slug: 'skull-heart', title: 'Skull Heart', description: 'Watercolor print · signed · limited to 10', kind: 'print', priceCents: PRINT_PRICE, imageUrl: `${IMG}/skull-heart.webp`, boothQty: 10, status: 'available' },
      { slug: 'sun', title: 'Sun', description: 'Watercolor print · signed · limited to 10', kind: 'print', priceCents: PRINT_PRICE, imageUrl: `${IMG}/sun.webp`, boothQty: 10, status: 'available' },
      { slug: 'cheetah', title: 'Cheetah', description: 'Watercolor print · signed · limited to 10', kind: 'print', priceCents: PRINT_PRICE, imageUrl: `${IMG}/cheetah.webp`, boothQty: 10, status: 'available' },
      { slug: 'compass', title: 'Compass', description: 'Ink & wash print · signed · limited to 10', kind: 'print', priceCents: PRINT_PRICE, imageUrl: `${IMG}/compass.webp`, boothQty: 10, status: 'available' },
      { slug: 'hot-air-balloon', title: 'Wander', description: 'Watercolor balloon print · signed · limited to 10', kind: 'print', priceCents: PRINT_PRICE, imageUrl: `${IMG}/hot-air-balloon.webp`, boothQty: 10, status: 'available' },
      { slug: 'purple-roses', title: 'Purple Roses', description: 'Illustrative print · signed · limited to 10', kind: 'print', priceCents: PRINT_PRICE, imageUrl: `${IMG}/purple-roses.webp`, boothQty: 10, status: 'available' },
      { slug: 'sunflowers', title: 'Sunflowers', description: 'Black & grey print · signed · limited to 10', kind: 'print', priceCents: PRINT_PRICE, imageUrl: `${IMG}/sunflowers.webp`, boothQty: 10, status: 'available' },
      { slug: 'coffin-roses', title: 'Coffin Roses', description: 'Black & grey print · signed · limited to 10', kind: 'print', priceCents: PRINT_PRICE, imageUrl: `${IMG}/coffin-roses.webp`, boothQty: 10, status: 'available' },
      { slug: 'cannabis-mandala', title: 'Leaf Mandala', description: 'Black & grey print · signed · limited to 10', kind: 'print', priceCents: PRINT_PRICE, imageUrl: `${IMG}/cannabis-mandala.webp`, boothQty: 10, status: 'available' },
      { slug: 'feather-geo', title: 'Feather Geometry', description: 'Sketch print · signed · limited to 10', kind: 'print', priceCents: PRINT_PRICE, imageUrl: `${IMG}/feather-geo.webp`, boothQty: 10, status: 'available' },
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
