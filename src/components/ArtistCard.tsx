'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Star, MapPin, CheckCircle } from 'lucide-react'
import { Artist } from '@/lib/types'
import { formatPrice } from '@/lib/utils'

export function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link href={`/artist/${artist.id}`} className="block bg-[#141414] border border-[#2a2a2a] rounded-2xl overflow-hidden hover:border-[#c9a84c]/40 transition-colors">
      <div className="relative aspect-square">
        <Image
          src={artist.portfolio_images[0]}
          alt={`${artist.name} tattoo work`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 200px"
        />
        {!artist.available && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-xs font-medium text-white bg-black/80 px-2 py-1 rounded-full">Waitlist</span>
          </div>
        )}
        {artist.verified && (
          <div className="absolute top-2 right-2">
            <CheckCircle className="w-4 h-4 text-[#c9a84c] fill-[#0a0a0a]" />
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-1 mb-1">
          <p className="font-semibold text-sm text-white leading-tight truncate">{artist.name}</p>
          <div className="flex items-center gap-0.5 shrink-0">
            <Star className="w-3 h-3 text-[#c9a84c] fill-[#c9a84c]" />
            <span className="text-[11px] text-[#c9a84c] font-medium">{artist.rating}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 mb-2">
          <MapPin className="w-3 h-3 text-[#6b6b6b]" />
          <span className="text-[11px] text-[#6b6b6b]">{artist.location_city}, {artist.location_state}</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {artist.styles.slice(0, 2).map((style) => (
            <span key={style} className="text-[10px] px-2 py-0.5 bg-[#1e1e1e] border border-[#2a2a2a] rounded-full text-[#6b6b6b] capitalize">
              {style}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-[#c9a84c] font-medium mt-2">
          From {formatPrice(artist.min_piece_cents)}
        </p>
      </div>
    </Link>
  )
}
