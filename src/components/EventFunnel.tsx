'use client'

import { useState } from 'react'
import type { EventFunnelConfig } from '@/lib/community/events'

// Client half of the /e/[slug] event funnel: the signup card with
// success state ("show this screen at the booth").

export default function EventFunnel({ event }: { event: EventFunnelConfig }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email.')
      return
    }
    setStatus('sending')
    setError('')
    try {
      const res = await fetch('/api/community/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          artistHandle: event.artistHandle,
          eventSlug: event.slug,
          source: event.slug,
          giveawayEntry: event.giveaway,
        }),
      })
      if (!res.ok) throw new Error()
      setStatus('done')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setStatus('error')
      setError(`Bad signal? Try again, or DM ${event.instagramHandle} to join.`)
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-xl border border-[rgba(201,160,80,0.15)] bg-[#181410] p-7 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <h2 className="font-serif text-2xl mb-4">
          You&apos;re <em className="italic text-[#c9a050]">in.</em>
        </h2>
        <div className="rounded-lg border border-dashed border-[rgba(201,160,80,0.5)] bg-[rgba(201,160,80,0.12)] p-4 mb-5 text-sm">
          Show this screen at the booth for a <strong className="text-[#c9a050]">free sticker</strong> from the secret stash ✦
        </div>
        {event.giveaway && (
          <p className="text-sm text-[#a09070] mb-5">
            You&apos;re entered in the <strong className="text-[#f0ebe0]">original art giveaway</strong> — winner announced by
            email. Watch your inbox for the studio diary.
          </p>
        )}
        <a
          href={event.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-full border border-[rgba(201,160,80,0.3)] px-6 py-3.5 text-sm font-semibold text-[#c9a050] mb-2.5 hover:bg-[rgba(201,160,80,0.12)] transition-colors"
        >
          Follow {event.instagramHandle} ↗
        </a>
        <a
          href={event.siteUrl}
          className="block rounded-full border border-[rgba(201,160,80,0.3)] px-6 py-3.5 text-sm font-semibold text-[#c9a050] hover:bg-[rgba(201,160,80,0.12)] transition-colors"
        >
          See the full portfolio
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[rgba(201,160,80,0.15)] bg-[#181410] p-7">
      <h2 className="font-serif text-2xl mb-1.5">
        The <em className="italic text-[#c9a050]">Collectors Club</em>
      </h2>
      <p className="text-sm text-[#a09070] mb-5">Free, private, and worth it. This weekend it comes with extras:</p>
      <ul className="mb-6">
        {event.incentives.map((inc) => (
          <li
            key={inc.title}
            className="flex items-start gap-2.5 border-b border-[rgba(201,160,80,0.15)] py-2.5 text-sm text-[#a09070] last:border-b-0"
          >
            <span className="shrink-0">{inc.icon}</span>
            <span>
              <strong className="font-medium text-[#f0ebe0]">{inc.title}</strong> — {inc.detail}
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={submit}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First name (optional)"
          autoComplete="given-name"
          className="mb-2.5 w-full rounded-full border border-[rgba(201,160,80,0.15)] bg-[#111008] px-5 py-3.5 text-base text-[#f0ebe0] outline-none placeholder:text-[#6a5f4a] focus:border-[rgba(201,160,80,0.5)]"
        />
        <input
          type="email"
          required
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          autoComplete="email"
          className="mb-2.5 w-full rounded-full border border-[rgba(201,160,80,0.15)] bg-[#111008] px-5 py-3.5 text-base text-[#f0ebe0] outline-none placeholder:text-[#6a5f4a] focus:border-[rgba(201,160,80,0.5)]"
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="w-full rounded-full bg-[#c9a050] px-6 py-4 text-sm font-bold uppercase tracking-wider text-[#0a0805] transition-colors hover:bg-[#e0b96a] disabled:opacity-70"
        >
          {status === 'sending' ? 'Adding you…' : event.giveaway ? 'Join & Enter the Giveaway' : 'Join the Club'}
        </button>
        <p className="mt-2.5 min-h-5 text-center text-sm text-[#c06040]">{error}</p>
        <p className="text-center text-xs text-[#6a5f4a]">No spam. A monthly studio diary + first dibs. Unsubscribe anytime.</p>
      </form>
    </div>
  )
}
