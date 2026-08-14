import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import DropsGallery from '@/components/DropsGallery'
import { getArtistDrops } from '@/lib/community/drops'

// Booth Drops: per-artist prints/originals storefront.
// v1 sale flow: claim -> artist gets an email with Reply-To buyer ->
// they arrange payment/pickup directly. Stripe checkout drops in later
// without changing this page's shape.

export async function generateMetadata({ params }: { params: Promise<{ artist: string }> }): Promise<Metadata> {
  const { artist } = await params
  const cfg = getArtistDrops(artist)
  if (!cfg) return { title: 'Not found' }
  return {
    title: `${cfg.artistName} — Prints & Pieces`,
    description: cfg.intro,
  }
}

export default async function DropsPage({ params }: { params: Promise<{ artist: string }> }) {
  const { artist } = await params
  const cfg = getArtistDrops(artist)
  if (!cfg) notFound()

  return (
    <div className="min-h-dvh bg-[#0a0805] text-[#f0ebe0] [font-family:system-ui,sans-serif]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 50% at 50% 0%, rgba(180,120,40,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 20% 80%, rgba(140,80,30,0.10) 0%, transparent 50%)',
        }}
      />
      <div className="relative mx-auto max-w-2xl px-5 pb-16 pt-8">
        <a href={cfg.siteUrl} className="font-serif text-lg italic text-[#c9a050]">
          {cfg.artistHandle === 'rawsunart' ? 'RawSunArt' : cfg.artistName}
        </a>

        <div className="mt-10 flex items-center gap-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#c9a050]">
          <span className="block h-px w-7 bg-[#c9a050]" />
          Prints &amp; Pieces
        </div>
        <h1 className="mb-4 mt-4 font-serif text-5xl leading-[1.05]">
          The <em className="italic text-[#c9a050]">Drop.</em>
        </h1>
        <p className="mb-2 leading-relaxed text-[#a09070]">{cfg.intro}</p>
        {cfg.boothNote && (
          <p className="mb-8 text-sm text-[#c9a050]">✦ {cfg.boothNote}</p>
        )}

        <DropsGallery artist={cfg} />

        <div className="mt-8 text-center text-sm">
          <a href={cfg.siteUrl} className="text-[#a09070] hover:text-[#f0ebe0]">
            Full portfolio
          </a>
          <span className="mx-2.5 text-[#6a5f4a]">·</span>
          <a href={cfg.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-[#a09070] hover:text-[#f0ebe0]">
            {cfg.instagramHandle}
          </a>
        </div>

        <p className="mt-10 text-center text-xs text-[#6a5f4a]">
          {cfg.artistName} · powered by{' '}
          <a href="/artists" className="text-[#c9a050]">
            EliteTatz
          </a>{' '}
          — artists, sell your prints without running a store →
        </p>
      </div>
    </div>
  )
}
