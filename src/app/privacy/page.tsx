import type { Metadata } from 'next'
import Link from 'next/link'

// The privacy policy for elitetatz.app: what the app collects from clients
// and artists, where it goes, and the Google Calendar terms Google requires
// us to state (the "Limited Use" line). Linked from sign-up, from the Google
// section of /dashboard/connections, and from the Google consent screen.
//
// Plain English on purpose. Lacey's clients read this on a phone.

export const metadata: Metadata = {
  title: 'Privacy Policy — EliteTatz',
  description: 'What EliteTatz collects from clients and artists, where it goes, how Google Calendar access is used, and how to ask for your data or have it deleted.',
  alternates: { canonical: 'https://elitetatz.app/privacy' },
}

const UPDATED = 'November 4, 2026'
const CONTACT = 'tech@measurementally.com'

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-[#f5f5f0]">
      <main className="mx-auto max-w-lg px-5 pb-20 pt-10 space-y-8 text-[15px] leading-relaxed text-[#d8d8d2]">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[#c9a84c]">EliteTatz</p>
          <h1 className="text-3xl font-semibold text-white">Privacy Policy</h1>
          <p className="text-sm text-[#8a8a8a]">Last updated {UPDATED}</p>
          <p>
            EliteTatz is a service of Measurementally. It helps tattoo artists take inquiries, answer them in one place, and book
            clients. This page says what we collect, what we do with it, and how to reach us. Short version: your inquiry goes to the
            artist you asked for and nobody else; we never sell anything about you; you can ask for your data or its deletion any time.
          </p>
        </header>

        <Section title="If you are a client">
          <p>When you send an inquiry, by the concierge chat, a web form, email, text or a social message, we keep:</p>
          <List items={[
            'Your name, email address and mobile number, so the artist can answer you.',
            'What you told us about the tattoo: the idea, size, placement, style, budget, dates, and any reference photos you attached.',
            'The chat transcript with the concierge, and the messages you and the artist exchange on your inquiry page.',
            'Whether a deposit was received and when a session was booked, so your inquiry page stays accurate.',
          ]} />
          <p>
            We use this to put your inquiry in front of the artist, to send you confirmations and reminders about it, and to let the
            artist quote and book you. The concierge is run by an AI model (Claude, by Anthropic) that reads your messages to ask
            the right questions and write a brief for the artist. The artist sees the brief and the transcript. Nothing you write is
            used to train any model.
          </p>
        </Section>

        <Section title="If you are an artist">
          <p>When you sign up we keep your name, email, the studio details you enter, and your sign-in. If you sign in with Google,
            we receive only your name and email address.</p>
          <p>
            Your dashboard also offers a separate, optional connection to <strong className="text-white">Google Calendar</strong>,
            read-only. If you turn it on, the app reads your upcoming events at the moment you ask, to tell you when you are free.
            It does not create, change or delete events, it does not copy your calendar into our database, and it never reads your
            email. The connection is stored as an encrypted token on your own row and can be removed on the Connections page or in
            your Google Account at any time; removing it deletes the token immediately.
          </p>
          <p>
            EliteTatz&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
            <a className="text-[#c9a84c] underline underline-offset-2" href="https://developers.google.com/terms/api-services-user-data-policy" rel="noreferrer" target="_blank">
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
        </Section>

        <Section title="Who sees what">
          <List items={[
            'A client’s inquiry is visible to the artist it was sent to, and to the operator who runs the app for that artist. No other artist can see it.',
            'An artist’s clients, messages and calendar are theirs. They are not shared with other artists, the studio, or anyone else.',
            'We do not sell personal information, and we do not use it for advertising.',
          ]} />
        </Section>

        <Section title="Services that handle data for us">
          <p>These companies process data on our behalf, under their own privacy terms, and only to do the job named:</p>
          <List items={[
            'Supabase stores the database and sign-in records.',
            'Vercel hosts the app and keeps short-lived server logs.',
            'Anthropic runs the concierge and the artist’s drafting assistant.',
            'Resend sends email. Dialpad sends and receives texts, where an artist has turned texting on.',
            'Cloudflare Turnstile checks that a form was sent by a person, not a bot.',
            'Google provides sign-in and, for artists who opt in, read-only calendar access.',
            'Square or the artist’s own payment provider takes deposits. We never see or store card numbers.',
          ]} />
        </Section>

        <Section title="How long we keep it">
          <p>
            Inquiries and messages stay for as long as the artist keeps their account, so a returning client is recognised. Server
            logs are kept for days, not months. An artist who closes their account has their data deleted, and their clients&apos;
            inquiries with it.
          </p>
        </Section>

        <Section title="Your choices">
          <List items={[
            `Ask what we hold about you, correct it, or have it deleted: email ${CONTACT}. We answer within 30 days.`,
            'Every email we send has an unsubscribe link. A text can be stopped by replying STOP.',
            'Artists can disconnect Google Calendar on the Connections page at any time.',
          ]} />
        </Section>

        <Section title="Other things to know">
          <List items={[
            'EliteTatz is for people 18 and over. We do not knowingly collect information from anyone younger.',
            'Data is stored in the United States.',
            'If this policy changes in a way that matters, we update the date above and tell artists by email.',
          ]} />
        </Section>

        <Section title="Contact">
          <p>
            Questions about privacy go to{' '}
            <a className="text-[#c9a84c] underline underline-offset-2" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
          </p>
        </Section>

        <footer className="border-t border-[#2a2a2a] pt-6 text-sm text-[#6b6b6b]">
          <Link href="/artists" className="text-[#c9a84c]">EliteTatz for artists</Link>
          <span className="mx-2">·</span>
          <a href="https://rawsunart.com/" className="text-[#c9a84c]">RawSunArt</a>
        </footer>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  )
}
