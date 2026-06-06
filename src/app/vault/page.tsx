'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Vault, ImagePlus, X, Download, Tag } from 'lucide-react'
import { BottomNav } from '@/components/BottomNav'
import { MOCK_VAULT_ASSETS, VaultAsset } from '@/lib/mock-data'

const TYPE_CONFIG = {
  reference:   { label: 'Reference',   color: 'text-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-400/30' },
  sketch:      { label: 'Sketch',      color: 'text-purple-400',  bg: 'bg-purple-400/10',  border: 'border-purple-400/30' },
  final:       { label: 'Final',       color: 'text-[#c9a84c]',   bg: 'bg-[#c9a84c]/10',  border: 'border-[#c9a84c]/30' },
  inspiration: { label: 'Inspiration', color: 'text-green-400',   bg: 'bg-green-400/10',   border: 'border-green-400/30' },
}

const FILTERS = ['All', 'reference', 'sketch', 'final', 'inspiration'] as const

export default function VaultPage() {
  const [filter, setFilter] = useState<typeof FILTERS[number]>('All')
  const [preview, setPreview] = useState<VaultAsset | null>(null)

  const assets = MOCK_VAULT_ASSETS.filter(
    (a) => filter === 'All' || a.type === filter
  )

  return (
    <div className="flex flex-col min-h-dvh pb-20">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-0.5">
            <Vault className="w-4 h-4 text-[#c9a84c]" />
            <h1 className="text-lg font-bold">The Vault</h1>
          </div>
          <p className="text-xs text-[#6b6b6b]">Your reference images, sketches & completed work</p>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4">
        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs border font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-[#c9a84c] text-black border-[#c9a84c]'
                  : 'bg-transparent text-[#6b6b6b] border-[#2a2a2a]'
              }`}
            >
              {f === 'All' ? `All (${MOCK_VAULT_ASSETS.length})` : TYPE_CONFIG[f as keyof typeof TYPE_CONFIG].label}
            </button>
          ))}
        </div>

        {assets.length === 0 ? (
          <div className="text-center py-16">
            <Vault className="w-10 h-10 text-[#6b6b6b] mx-auto mb-3 opacity-40" />
            <p className="text-sm text-[#6b6b6b]">Nothing here yet</p>
            <p className="text-xs text-[#6b6b6b] mt-1">Assets are added automatically as you work with TatzAI and artists</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {assets.map((asset) => {
              const cfg = TYPE_CONFIG[asset.type]
              return (
                <button
                  key={asset.id}
                  onClick={() => setPreview(asset)}
                  className="block w-full text-left bg-[#141414] border border-[#2a2a2a] rounded-2xl overflow-hidden hover:border-[#c9a84c]/30 transition-colors"
                  data-testid={`vault-asset-${asset.id}`}
                >
                  <div className="relative aspect-square">
                    <Image
                      src={asset.url}
                      alt={asset.label}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 200px"
                    />
                    <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full ${cfg.bg} border ${cfg.border}`}>
                      <span className={`text-[9px] font-semibold ${cfg.color} uppercase tracking-wide`}>{cfg.label}</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium text-white leading-tight line-clamp-2">{asset.label}</p>
                    {asset.artist_name && (
                      <p className="text-[10px] text-[#6b6b6b] mt-0.5">{asset.artist_name}</p>
                    )}
                  </div>
                </button>
              )
            })}

            {/* Upload slot */}
            <button className="bg-[#141414] border border-dashed border-[#2a2a2a] rounded-2xl aspect-square flex flex-col items-center justify-center gap-2 hover:border-[#c9a84c]/30 transition-colors">
              <ImagePlus className="w-6 h-6 text-[#6b6b6b]" />
              <span className="text-[10px] text-[#6b6b6b]">Add reference</span>
            </button>
          </div>
        )}
      </main>

      {/* Full-screen preview */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" data-testid="vault-preview">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
            <div>
              <p className="text-sm font-semibold">{preview.label}</p>
              {preview.artist_name && (
                <p className="text-xs text-[#6b6b6b]">{preview.artist_name}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 rounded-full bg-[#1e1e1e]">
                <Download className="w-4 h-4 text-[#c9a84c]" />
              </button>
              <button onClick={() => setPreview(null)} className="p-2 rounded-full bg-[#1e1e1e]">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
          <div className="flex-1 relative">
            <Image
              src={preview.url}
              alt={preview.label}
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>
          <div className="px-4 py-4 border-t border-[#2a2a2a]">
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-[#6b6b6b]" />
              <span className={`text-xs font-medium capitalize ${TYPE_CONFIG[preview.type].color}`}>
                {TYPE_CONFIG[preview.type].label}
              </span>
              {preview.match_id && (
                <span className="text-xs text-[#6b6b6b]">· Linked to project</span>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav active="profile" />
    </div>
  )
}
