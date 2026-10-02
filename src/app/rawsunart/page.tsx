'use client'

import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Clock, DollarSign, Sparkles, AtSign, Mail, Phone, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// Studio facts as Lacey publishes them today (rawsunart.com, Google Business
// Profile). ARTIST_CONFIG carries rates and the deposit policy; the location,
// hours and handle below are the canonical values for the pilot.
const STUDIO = {
  name: 'AION Tattoo',
  address: '2719 Sawbury Blvd',
  cityStateZip: 'Dublin, OH 43235',
  hours: 'Wednesday–Saturday, 12–6',
  hoursNote: 'Additional hours by appointment only',
  instagram: '@raw.sun.art',
  phoneDisplay: '614-858-5574',
  phoneTel: '+16148585574',
}

const DEPOSIT_DOLLARS = ARTIST_CONFIG.depositCents / 100

const STYLES = [
  { label: 'Watercolor', description: 'Her signature. Vivid color washes, soft edges, painterly movement.', icon: '🎨' },
  { label: 'Fine Line', description: 'Delicate single-needle work. Minimal, precise, timeless.', icon: '✏️' },
  { label: 'Illustrative', description: 'Drawing-inspired. Fluid, expressive, custom to your concept.', icon: '🖊️' },
  { label: 'Black & Grey', description: 'Classic shading and contrast. Lines only or full shading.', icon: '🖤' },
]

const FAQS = [
  {
    q: 'Do you do sketches before I book?',
    a: "Design happens at your appointment — that's what the deposit reserves time for. Once you're booked, we'll go through your concept together before anything touches skin. No pre-booking spec sketches.",
  },
  {
    q: 'What does the deposit cover?',
    a: `$${DEPOSIT_DOLLARS} per person, applied to your final price as long as you show up as scheduled. Non-refundable for no-shows or last-minute cancellations.`,
  },
  {
    q: 'How do you price tattoos?',
    a: `Around $${ARTIST_CONFIG.hourlyRate}/hr, or quoted as a project total depending on complexity. Minimum is one hour ($${ARTIST_CONFIG.hourlyRate}). Custom quotes given after I know size, placement, and style.`,
  },
  {
    q: 'When are you in the studio?',
    a: `${STUDIO.hours} at ${STUDIO.name}, ${STUDIO.address}, ${STUDIO.cityStateZip}. ${STUDIO.hoursNote}.`,
  },
  {
    q: 'Can I bring my own reference?',
    a: "Yes — and please do. I interpret references, I don't copy them. The more you share about what draws you to the image, the better the final result.",
  },
  {
    q: 'What\'s your watercolor style specifically?',
    a: "I typically anchor watercolor with subtle linework so the color holds over time. Pure watercolor without structure fades fast. You'll get the soft, painterly look with longevity built in.",
  },
  {
    q: 'Do you do color tattoos or just black?',
    a: "Both. Watercolor is full color. I also do black and grey, and lines-only pieces. Let me know what direction you're thinking — I'll tell you what works best for the placement.",
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-[#2a2a2a] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-4 text-left hover:bg-[#1e1e1e] transition-colors"
      >
        <span className="text-sm font-medium pr-4">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-[#6b6b6b] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#6b6b6b] shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4">
          <p className="text-sm text-[#9b9b9b] leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}

export default function RawSunArtPage() {
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white">

      {/* Hero */}
      <div className="relative h-72 overflow-hidden">
        <Image
          src="/artists/rawsunart-hero.webp"
          alt="Watercolor butterfly tattoo by Lacey Rawson"
          width={1080}
          height={1350}
          priority
          sizes="(max-width: 640px) 100vw, 640px"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-6 w-full max-w-lg mx-auto">
          <div className="flex items-end gap-4">
            <Image
              src="/artists/lacey.webp"
              alt="Lacey Rawson"
              width={1000}
              height={1250}
              sizes="80px"
              className="w-20 h-20 rounded-2xl object-cover shrink-0 shadow-lg border border-[#2a2a2a]"
            />
            <div>
              <p className="text-xs text-[#c9a84c] font-medium tracking-widest uppercase mb-1">{ARTIST_CONFIG.handle}</p>
              <h1 className="text-2xl font-bold leading-tight">{ARTIST_CONFIG.name}</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 text-[#9b9b9b]" />
                <span className="text-xs text-[#9b9b9b]">{STUDIO.name} · {STUDIO.cityStateZip}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-16">

        {/* Specialty chips */}
        <div className="flex flex-wrap gap-2 mt-5">
          {ARTIST_CONFIG.specialties.map((s) => (
            <span
              key={s}
              className={`text-xs px-3 py-1 rounded-full border capitalize font-medium ${
                s === ARTIST_CONFIG.primarySpecialty
                  ? 'bg-[#c9a84c]/10 border-[#c9a84c]/40 text-[#c9a84c]'
                  : 'bg-[#1e1e1e] border-[#2a2a2a] text-[#9b9b9b]'
              }`}
            >
              {s === ARTIST_CONFIG.primarySpecialty ? `★ ${s}` : s}
            </span>
          ))}
        </div>

        {/* Bio */}
        <p className="mt-5 text-sm text-[#9b9b9b] leading-relaxed">
          Custom tattoos only. Every piece is drawn for you — your concept, your body, your story.
          Watercolor is the signature: vivid, painterly, built to last. Tattooing out of{' '}
          {STUDIO.name} in {ARTIST_CONFIG.city}, {ARTIST_CONFIG.state}.
        </p>

        {/* Primary CTA */}
        <Link
          href="/agent?mode=rawsunart"
          className="mt-6 flex items-center justify-center gap-2 w-full bg-[#c9a84c] text-black font-bold py-4 rounded-2xl text-sm"
        >
          <Sparkles className="w-4 h-4" />
          Start Your Inquiry with EliteTatz
        </Link>
        <p className="text-center text-[11px] text-[#6b6b6b] mt-2">
          AI concierge gathers your concept — Lacey reviews and confirms
        </p>

        {/* Quick info */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
            <DollarSign className="w-4 h-4 text-[#c9a84c] mb-2" />
            <p className="text-xs text-[#6b6b6b] mb-0.5">Starting rate</p>
            <p className="text-sm font-semibold">${ARTIST_CONFIG.hourlyRate}/hr</p>
            <p className="text-[11px] text-[#6b6b6b] mt-0.5">${DEPOSIT_DOLLARS} deposit to hold</p>
          </div>
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
            <Clock className="w-4 h-4 text-[#c9a84c] mb-2" />
            <p className="text-xs text-[#6b6b6b] mb-0.5">Studio hours</p>
            <p className="text-sm font-semibold">{STUDIO.hours}</p>
            <p className="text-[11px] text-[#6b6b6b] mt-0.5">{STUDIO.hoursNote}</p>
          </div>
        </div>

        {/* Styles */}
        <div className="mt-8">
          <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium mb-4">What She Does</p>
          <div className="space-y-3">
            {STYLES.map((s) => (
              <div key={s.label} className="flex items-start gap-3 bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
                <span className="text-xl shrink-0">{s.icon}</span>
                <div>
                  <p className="text-sm font-semibold mb-0.5">{s.label}</p>
                  <p className="text-xs text-[#6b6b6b] leading-relaxed">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="mt-8">
          <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium mb-4">How Booking Works</p>
          <div className="space-y-3">
            {[
              { n: '1', title: 'Tell the AI your concept', body: "EliteTatz collects your idea, size, placement, style, and reference. Takes 5 minutes." },
              { n: '2', title: 'Lacey reviews and quotes', body: "She reviews your inquiry and sends a quote. You won't get a sketch yet — design is part of your session." },
              { n: '3', title: 'Deposit locks your time', body: `$${DEPOSIT_DOLLARS} reserves your appointment and is credited toward your final price.` },
              { n: '4', title: 'Come in, create together', body: "She goes over the design with you before anything touches skin. No surprises." },
            ].map(({ n, title, body }) => (
              <div key={n} className="flex gap-4 items-start">
                <div className="w-7 h-7 rounded-full bg-[#c9a84c]/10 border border-[#c9a84c]/30 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#c9a84c]">{n}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-0.5">{title}</p>
                  <p className="text-xs text-[#6b6b6b] leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-8">
          <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium mb-4">Common Questions</p>
          <div className="space-y-2">
            {FAQS.map((faq) => (
              <FAQItem key={faq.q} {...faq} />
            ))}
          </div>
        </div>

        {/* Contact strip */}
        <div className="mt-8 bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5">
          <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium mb-4">Find Her</p>
          <div className="space-y-3">
            <a
              href={`https://instagram.com/${STUDIO.instagram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 hover:text-[#c9a84c] transition-colors"
            >
              <AtSign className="w-4 h-4 text-[#6b6b6b]" />
              <span className="text-sm">{STUDIO.instagram}</span>
            </a>
            <a
              href={`tel:${STUDIO.phoneTel}`}
              className="flex items-center gap-3 hover:text-[#c9a84c] transition-colors"
            >
              <Phone className="w-4 h-4 text-[#6b6b6b]" />
              <span className="text-sm">{STUDIO.phoneDisplay}</span>
            </a>
            <a
              href={`mailto:${ARTIST_CONFIG.email}`}
              className="flex items-center gap-3 hover:text-[#c9a84c] transition-colors"
            >
              <Mail className="w-4 h-4 text-[#6b6b6b]" />
              <span className="text-sm">{ARTIST_CONFIG.email}</span>
            </a>
            <div className="flex items-start gap-3 text-[#9b9b9b]">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="text-sm">
                {STUDIO.name}<br />
                {STUDIO.address}, {STUDIO.cityStateZip}
              </span>
            </div>
            <div className="flex items-start gap-3 text-[#9b9b9b]">
              <Clock className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="text-sm">
                {STUDIO.hours}<br />
                <span className="text-[#6b6b6b]">{STUDIO.hoursNote}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-8 text-center">
          <Link
            href="/agent?mode=rawsunart"
            className="inline-flex items-center gap-2 bg-[#1e1e1e] border border-[#c9a84c]/20 text-[#c9a84c] font-medium px-6 py-3 rounded-2xl text-sm hover:bg-[#c9a84c]/10 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Start your inquiry
          </Link>
          <p className="text-[10px] text-[#6b6b6b] mt-3">
            Powered by <span className="text-[#c9a84c]">EliteTatz</span> · No account required to inquire
          </p>
        </div>

      </div>
    </div>
  )
}
