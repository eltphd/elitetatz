import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import EventFunnel from '@/components/EventFunnel'
import { getEventConfig } from '@/lib/community/events'

// Reusable convention QR funnel: /e/hellcity-phoenix-2026 etc.
// One config entry in lib/community/events.ts = a new live funnel.

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const event = getEventConfig(slug)
  if (!event) return { title: 'Event not found' }
  return {
    title: `Hey ${event.cityShort} — ${event.artistName} at ${event.eventTitle}`,
    description: event.intro,
    robots: { index: false },
  }
}

export default async function EventFunnelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = getEventConfig(slug)
  if (!event) notFound()

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
      <div className="relative mx-auto max-w-md px-5 pb-16 pt-8">
        <a href={event.siteUrl} className="font-serif text-lg italic text-[#c9a050]">
          {event.artistName.split(' ')[0] === 'Lacey' ? 'RawSunArt' : event.artistName}
        </a>

        <div className="mt-10 flex items-center gap-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#c9a050]">
          <span className="block h-px w-7 bg-[#c9a050]" />
          {event.eventTitle} · {event.city}
        </div>
        <h1 className="mb-4 mt-4 font-serif text-5xl leading-[1.05]">
          {event.headline ?? (
            <>
              Hey <em className="italic text-[#c9a050]">{event.cityShort}.</em>
            </>
          )}
        </h1>
        <p className="mb-8 leading-relaxed text-[#a09070]">{event.intro}</p>

        <EventFunnel event={event} />

        <div className="mt-7 text-center text-sm">
          <a href={event.bookingUrl} className="text-[#a09070] hover:text-[#f0ebe0]">
            Book a tattoo
          </a>
          <span className="mx-2.5 text-[#6a5f4a]">·</span>
          <a href={event.siteUrl} className="text-[#a09070] hover:text-[#f0ebe0]">
            Full portfolio
          </a>
          <span className="mx-2.5 text-[#6a5f4a]">·</span>
          <a href={event.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-[#a09070] hover:text-[#f0ebe0]">
            {event.instagramHandle}
          </a>
        </div>

        <p className="mt-10 text-center text-xs text-[#6a5f4a]">
          {event.artistName} · powered by{' '}
          <a href="/artists" className="text-[#c9a050]">
            EliteTatz
          </a>{' '}
          — artists, get your own funnel →
        </p>
      </div>
    </div>
  )
}
