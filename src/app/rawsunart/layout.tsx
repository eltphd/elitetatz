import type { Metadata } from 'next'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// This page mirrors rawsunart.com for the pilot. The site is the one Google
// should show, so this copy stays out of the index and points at it.
export const metadata: Metadata = {
  title: `${ARTIST_CONFIG.name} · ${ARTIST_CONFIG.handle}`,
  description: `Booking entry for ${ARTIST_CONFIG.name}, watercolor tattoo artist in ${ARTIST_CONFIG.city}, ${ARTIST_CONFIG.state}.`,
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://rawsunart.com/' },
}

export default function RawSunArtLayout({ children }: { children: React.ReactNode }) {
  return children
}
