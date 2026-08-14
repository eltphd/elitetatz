import type { Metadata } from 'next'
import ArtistWaitlistForm from '@/components/ArtistWaitlistForm'

export const metadata: Metadata = {
  title: 'TatzAI for Artists — Your art. Your people. One link.',
  description:
    'A presence hub, an AI concierge that qualifies clients in your voice, and a community engine that turns convention crowds into collectors. You make art. It handles the rest.',
}

const PILLARS = [
  {
    icon: '🖼',
    title: 'A presence, not a template',
    body: 'A gallery-grade site under your own domain: portfolio, travel dates, fine art, drops. Built to convert convention foot traffic and Instagram taps — not to sit pretty.',
  },
  {
    icon: '💬',
    title: 'An AI concierge in your voice',
    body: 'It answers inquiries the way you actually talk, asks your qualifying questions, quotes your rates, gates sketch-fishers behind your deposit — and hands you a complete brief. Your DMs go quiet; your bookings don\'t.',
  },
  {
    icon: '📇',
    title: 'A community engine',
    body: 'QR funnels for every convention booth. Signups become a collectors list you own — early access drops, travel announcements, giveaway entries. Follow-up happens automatically while you tattoo.',
  },
  {
    icon: '🌐',
    title: 'A network, not another app',
    body: 'Guest spots, conventions, artist-to-artist referrals. When your books close, the right client finds the right artist next door — and everybody wins.',
  },
]

const HANDLED = [
  'Client qualification & pre-screening',
  'Deposit collection & booking flow',
  'Welcome emails & lead magnets',
  'Convention QR funnels',
  'Collectors list & drop announcements',
  'Follow-up while you\'re at the machine',
]

export default function ArtistsPage() {
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-[#f5f5f0]">
      <div className="mx-auto max-w-lg px-5 pb-20 pt-10">
        {/* Hero */}
        <p className="mb-8 text-sm font-semibold uppercase tracking-[0.2em] text-[#c9a84c]">TatzAI · For Artists</p>
        <h1 className="mb-5 text-4xl font-bold leading-tight">
          You win them at the booth.
          <br />
          <span className="text-[#c9a84c]">Stop losing them in your DMs.</span>
        </h1>
        <p className="mb-4 leading-relaxed text-[#a0a0a0]">
          Every convention weekend, hundreds of people fall in love with your work — then vanish into a pile of unread
          messages, unpaid sketch requests, and &ldquo;how much for a sleeve?&rdquo;
        </p>
        <p className="mb-10 leading-relaxed text-[#a0a0a0]">
          TatzAI gives you a <strong className="text-[#f5f5f0]">presence hub</strong>, an{' '}
          <strong className="text-[#f5f5f0]">AI concierge that sounds like you</strong>, and a{' '}
          <strong className="text-[#f5f5f0]">community that compounds</strong> — with every complexity handled invisibly
          in the background. AI for the admin. Never for the art.
        </p>

        {/* Live proof */}
        <a
          href="https://rawsunart.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-12 block rounded-xl border border-[#2a2a2a] bg-[#141414] p-5 transition-colors hover:border-[#c9a84c]"
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#c9a84c]">Live now · Hell City Phoenix</p>
          <p className="mb-1 font-semibold">rawsunart.com — Lacey Rawson</p>
          <p className="text-sm text-[#6b6b6b]">
            Watercolor tattooer + fine artist. Booth QR funnel, collectors club, travel dates, AI-qualified booking.
            Tap to see a hub in the wild →
          </p>
        </a>

        {/* Pillars */}
        <div className="mb-12 space-y-4">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-5">
              <p className="mb-2 font-semibold">
                <span className="mr-2">{p.icon}</span>
                {p.title}
              </p>
              <p className="text-sm leading-relaxed text-[#a0a0a0]">{p.body}</p>
            </div>
          ))}
        </div>

        {/* What gets handled */}
        <div className="mb-12 rounded-xl border border-[#2a2a2a] bg-[#141414] p-5">
          <p className="mb-3 font-semibold">Handled for you, invisibly:</p>
          <ul className="grid grid-cols-1 gap-2 text-sm text-[#a0a0a0]">
            {HANDLED.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-0.5 text-[#c9a84c]">✓</span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-[#6b6b6b]">
            One subscription. No ESP account, no website builder, no booking tool, no funnel software to learn — we run
            the stack, you keep the audience.
          </p>
        </div>

        {/* Waitlist */}
        <h2 className="mb-2 text-2xl font-bold">Get your hub</h2>
        <p className="mb-6 text-sm text-[#a0a0a0]">
          We onboard a few artists at a time so every launch is polished. Convention-season spots go first.
        </p>
        <ArtistWaitlistForm source="artists-page" />

        <p className="mt-12 text-center text-xs text-[#6b6b6b]">
          TatzAI · AI for the admin, never for the art.
        </p>
      </div>
    </div>
  )
}
