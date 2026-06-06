'use client'

import Image from 'next/image'
import { Lock } from 'lucide-react'
import { FlashDesign } from '@/lib/mock-data'
import { formatPrice } from '@/lib/utils'

export function FlashCard({
  flash,
  onSelect,
}: {
  flash: FlashDesign
  onSelect: (f: FlashDesign) => void
}) {
  return (
    <button
      onClick={() => onSelect(flash)}
      className="block w-full text-left bg-[#141414] border border-[#2a2a2a] rounded-2xl overflow-hidden hover:border-[#c9a84c]/40 transition-colors"
    >
      <div className="relative aspect-square">
        <Image
          src={flash.image_url}
          alt={flash.title}
          fill
          className={`object-cover transition-opacity ${flash.sold ? 'opacity-40' : ''}`}
          sizes="(max-width: 768px) 50vw, 200px"
        />
        {flash.sold && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-1.5 bg-black/80 px-3 py-1.5 rounded-full">
              <Lock className="w-3 h-3 text-white" />
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">Claimed</span>
            </div>
          </div>
        )}
        {!flash.sold && (
          <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-green-400" />
        )}
      </div>
      <div className="p-3">
        <p className="font-semibold text-sm text-white leading-tight truncate">{flash.title}</p>
        <p className="text-[10px] text-[#6b6b6b] capitalize mt-0.5">{flash.style} · {flash.size_inches}"</p>
        <div className="flex items-center justify-between mt-2">
          <p className={`text-sm font-bold ${flash.sold ? 'text-[#6b6b6b] line-through' : 'text-[#c9a84c]'}`}>
            {formatPrice(flash.price_cents)}
          </p>
          <p className="text-[10px] text-[#6b6b6b]">{flash.artist.name.split(' ')[0]}</p>
        </div>
      </div>
    </button>
  )
}
