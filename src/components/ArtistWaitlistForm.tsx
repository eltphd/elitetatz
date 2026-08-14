'use client'

import { useState } from 'react'

// Waitlist form for artists / shop owners who want their own hub.
// Posts to /api/community/artist-lead.

export default function ArtistWaitlistForm({ source = 'artists-page' }: { source?: string }) {
  const [form, setForm] = useState({ name: '', email: '', instagram: '', role: 'artist', city: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError('Name and a valid email, please.')
      return
    }
    setStatus('sending')
    setError('')
    try {
      const res = await fetch('/api/community/artist-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source }),
      })
      if (!res.ok) throw new Error()
      setStatus('done')
    } catch {
      setStatus('error')
      setError('Something glitched — try again in a minute.')
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-7 text-center">
        <div className="mb-3 text-4xl">🤝</div>
        <h3 className="mb-2 text-xl font-semibold">
          You&apos;re on the list.
        </h3>
        <p className="text-sm text-[#6b6b6b]">
          We onboard a few artists at a time so every hub launches polished. You&apos;ll hear from us directly — usually
          within a couple of days.
        </p>
      </div>
    )
  }

  const inputCls =
    'w-full rounded-xl border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-3.5 text-base text-[#f5f5f0] outline-none placeholder:text-[#6b6b6b] focus:border-[#c9a84c]'

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <input
        type="text"
        required
        value={form.name}
        onChange={(e) => set('name', e.target.value)}
        placeholder="Your name"
        autoComplete="name"
        className={inputCls}
      />
      <input
        type="email"
        required
        inputMode="email"
        value={form.email}
        onChange={(e) => set('email', e.target.value)}
        placeholder="you@email.com"
        autoComplete="email"
        className={inputCls}
      />
      <input
        type="text"
        value={form.instagram}
        onChange={(e) => set('instagram', e.target.value)}
        placeholder="@your.instagram"
        className={inputCls}
      />
      <div className="grid grid-cols-2 gap-2.5">
        <select value={form.role} onChange={(e) => set('role', e.target.value)} className={inputCls}>
          <option value="artist">I&apos;m an artist</option>
          <option value="shop_owner">I own a shop</option>
          <option value="other">Other</option>
        </select>
        <input
          type="text"
          value={form.city}
          onChange={(e) => set('city', e.target.value)}
          placeholder="City"
          className={inputCls}
        />
      </div>
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full rounded-full bg-[#c9a84c] px-6 py-4 text-sm font-bold uppercase tracking-wider text-[#0a0a0a] transition-colors hover:bg-[#dbbb5e] disabled:opacity-70"
      >
        {status === 'sending' ? 'Sending…' : 'Get My Hub'}
      </button>
      <p className="min-h-5 text-center text-sm text-[#e85d2f]">{error}</p>
    </form>
  )
}
