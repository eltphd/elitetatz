'use client'

import { useState } from 'react'
import { ArrowLeft, Camera, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { ArtistStyle } from '@/lib/types'

const ALL_STYLES: ArtistStyle[] = ['traditional', 'neo-traditional', 'realism', 'blackwork', 'geometric', 'watercolor', 'japanese', 'tribal', 'illustrative', 'fine-line', 'portrait', 'cover-up']

const STEPS = ['Basics', 'Styles & Pricing', 'Portfolio', 'Done']

export default function ArtistSignupPage() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '',
    bio: '',
    location_city: '',
    location_state: '',
    instagram_handle: '',
    years_experience: '',
    styles: [] as ArtistStyle[],
    hourly_rate: '',
    min_piece: '',
  })

  function toggleStyle(style: ArtistStyle) {
    setForm((f) => ({
      ...f,
      styles: f.styles.includes(style)
        ? f.styles.filter((s) => s !== style)
        : [...f.styles, style],
    }))
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-[#1e1e1e]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-semibold">Artist Application</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto w-full px-4 pt-4">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1 rounded-full transition-colors ${i <= step ? 'bg-[#c9a84c]' : 'bg-[#2a2a2a]'}`} />
              <p className={`text-[10px] mt-1 text-center ${i === step ? 'text-[#c9a84c]' : 'text-[#6b6b6b]'}`}>{s}</p>
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-2">Tell us about yourself</h2>
            {[
              { key: 'name', label: 'Full Name / Artist Name', placeholder: 'Marco Vega' },
              { key: 'location_city', label: 'City', placeholder: 'New York' },
              { key: 'location_state', label: 'State', placeholder: 'NY' },
              { key: 'instagram_handle', label: 'Instagram', placeholder: 'yourhandle (no @)' },
              { key: 'years_experience', label: 'Years of Experience', placeholder: '5', type: 'number' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="text-xs text-[#6b6b6b] mb-1.5 block">{label}</label>
                <input
                  type={type || 'text'}
                  value={form[key as keyof typeof form] as string}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors"
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-[#6b6b6b] mb-1.5 block">Bio (what makes you unique)</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="I specialize in dark, intricate blackwork..."
                rows={3}
                className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors resize-none"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold mb-2">Styles & Pricing</h2>
            <div>
              <label className="text-xs text-[#6b6b6b] mb-3 block">Your styles (select all that apply)</label>
              <div className="flex flex-wrap gap-2">
                {ALL_STYLES.map((style) => (
                  <button
                    key={style}
                    onClick={() => toggleStyle(style)}
                    className={`px-3 py-1.5 rounded-full text-xs border capitalize transition-colors ${
                      form.styles.includes(style)
                        ? 'bg-[#c9a84c] text-black border-[#c9a84c]'
                        : 'bg-transparent text-[#6b6b6b] border-[#2a2a2a]'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
            {[
              { key: 'hourly_rate', label: 'Hourly Rate (USD)', placeholder: '200' },
              { key: 'min_piece', label: 'Minimum Piece Price (USD)', placeholder: '300' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs text-[#6b6b6b] mb-1.5 block">{label}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b6b6b] text-sm">$</span>
                  <input
                    type="number"
                    value={form[key as keyof typeof form] as string}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-4 pl-8 py-3 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold mb-2">Portfolio</h2>
            <p className="text-sm text-[#6b6b6b] mb-6">Add 3–10 of your best pieces. These are the first thing clients see.</p>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <button
                  key={i}
                  className="aspect-square bg-[#1e1e1e] border border-dashed border-[#2a2a2a] rounded-xl flex items-center justify-center hover:border-[#c9a84c]/40 transition-colors"
                >
                  <Plus className="w-5 h-5 text-[#6b6b6b]" />
                </button>
              ))}
            </div>
            <p className="text-xs text-[#6b6b6b] text-center mt-4">Connect Instagram to auto-import (coming soon)</p>
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-[#c9a84c]/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✓</span>
            </div>
            <h2 className="text-xl font-bold mb-2">Application submitted!</h2>
            <p className="text-sm text-[#6b6b6b] mb-6">
              We review all artists manually to maintain quality. You'll hear back within 48–72 hours.
            </p>
            <Link href="/" className="inline-flex items-center justify-center bg-[#c9a84c] text-black font-semibold px-6 py-3 rounded-xl text-sm">
              Back to Home
            </Link>
          </div>
        )}

        {step < 3 && (
          <div className="flex gap-3 mt-8 pb-8">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex-1 bg-[#1e1e1e] border border-[#2a2a2a] text-white font-medium py-3.5 rounded-xl text-sm"
              >
                Back
              </button>
            )}
            <button
              onClick={() => setStep((s) => Math.min(s + 1, 3))}
              className="flex-1 bg-[#c9a84c] text-black font-semibold py-3.5 rounded-xl text-sm"
            >
              {step === 2 ? 'Submit Application' : 'Continue'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
