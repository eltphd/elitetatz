import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Star, MapPin, AtSign, CheckCircle, Sparkles, Calendar } from 'lucide-react'
import { MOCK_ARTISTS } from '@/lib/mock-data'
import { formatPrice } from '@/lib/utils'

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const artist = MOCK_ARTISTS.find((a) => a.id === id)
  if (!artist) notFound()

  return (
    <div className="min-h-dvh pb-24">
      {/* Back nav */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-[#1e1e1e] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-semibold">{artist.name}</span>
          {artist.verified && <CheckCircle className="w-4 h-4 text-[#c9a84c] fill-[#0a0a0a] ml-auto" />}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4">
        {/* Hero image */}
        <div className="relative w-full aspect-square mt-4 rounded-2xl overflow-hidden">
          <Image
            src={artist.portfolio_images[0]}
            alt={artist.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 512px"
            priority
          />
        </div>

        {/* Artist info */}
        <div className="mt-4 mb-6">
          <div className="flex items-start gap-4">
            <Image
              src={artist.avatar_url}
              alt={artist.name}
              width={64}
              height={64}
              className="rounded-full border-2 border-[#c9a84c]"
            />
            <div className="flex-1">
              <h1 className="text-xl font-bold">{artist.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-[#c9a84c] fill-[#c9a84c]" />
                  <span className="text-sm font-medium text-[#c9a84c]">{artist.rating}</span>
                  <span className="text-xs text-[#6b6b6b]">({artist.review_count})</span>
                </div>
                <div className="flex items-center gap-1 text-[#6b6b6b]">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="text-xs">{artist.location_city}, {artist.location_state}</span>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-3 text-sm text-[#6b6b6b] leading-relaxed">{artist.bio}</p>

          <div className="flex gap-2 flex-wrap mt-3">
            {artist.styles.map((style) => (
              <span key={style} className="text-xs px-3 py-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded-full text-[#c9a84c] capitalize">
                {style}
              </span>
            ))}
          </div>

          {artist.instagram_handle && (
            <div className="flex items-center gap-2 mt-3 text-[#6b6b6b]">
              <AtSign className="w-4 h-4" />
              <span className="text-sm">@{artist.instagram_handle}</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Min Piece', value: formatPrice(artist.min_piece_cents) },
            { label: 'Hourly', value: formatPrice(artist.hourly_rate_cents) },
            { label: 'Experience', value: `${artist.years_experience} yrs` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-3 text-center">
              <p className="text-sm font-semibold text-white">{value}</p>
              <p className="text-[10px] text-[#6b6b6b] mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Portfolio grid */}
        {artist.portfolio_images.length > 1 && (
          <div className="mb-6">
            <h2 className="text-base font-semibold mb-3">Portfolio</h2>
            <div className="grid grid-cols-3 gap-1.5">
              {artist.portfolio_images.map((img, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                  <Image src={img} alt="Portfolio" fill className="object-cover" sizes="30vw" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Availability */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4 mb-4 flex items-center gap-3">
          <Calendar className="w-5 h-5 text-[#c9a84c]" />
          <div>
            <p className="text-sm font-medium">{artist.available ? 'Taking new clients' : 'Waitlist only'}</p>
            <p className="text-xs text-[#6b6b6b]">{artist.available ? 'Usually responds within 48h' : 'Join waitlist for future openings'}</p>
          </div>
          <div className={`ml-auto w-2.5 h-2.5 rounded-full ${artist.available ? 'bg-green-500' : 'bg-yellow-500'}`} />
        </div>
      </div>

      {/* CTA */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-[#2a2a2a]">
        <div className="max-w-lg mx-auto flex gap-3">
          <Link
            href="/agent"
            className="flex-1 flex items-center justify-center gap-2 bg-[#c9a84c] hover:bg-[#d4b45a] text-black font-semibold px-4 py-3.5 rounded-2xl transition-colors text-sm"
          >
            <Sparkles className="w-4 h-4" />
            Match with TatzAI
          </Link>
          <button className="px-4 py-3.5 bg-[#1e1e1e] border border-[#2a2a2a] hover:border-[#c9a84c]/40 rounded-2xl transition-colors text-sm font-medium">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
