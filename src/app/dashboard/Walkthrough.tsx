'use client'

import { useState, useSyncExternalStore } from 'react'
import { Smartphone, Hand, ShieldCheck, Check, X, ChevronRight, RotateCcw } from 'lucide-react'
import { detectPlatform, homeScreenHint, type Platform, type WalkthroughState } from '@/lib/onboarding'

// The first-visit walkthrough: three cards, read once, then "Got it". The tap
// is stored on her artist row through /api/dashboard/walkthrough, never in
// the browser, so a new phone sees the same answer. With no leads yet it
// folds to one line instead of vanishing, because the inbox is otherwise
// empty and she may want it back.

const TAPS: { name: string; button: string; what: string }[] = [
  { name: 'Quote', button: 'Accept', what: 'your number and two dates; the client gets the deposit link' },
  { name: 'Ask', button: 'More info', what: 'one question, already drafted from what the chat left open' },
  { name: 'Reply', button: 'the box under the thread', what: 'a plain message, sent only when you tap' },
  { name: 'Pass', button: 'Pass', what: 'a kind no, with or without a line of your own' },
  { name: 'Deposit received', button: 'Deposit received', what: 'when AION takes it; that is what holds the spot' },
]

const HOLDS: { at: string; what: string; tone?: 'warn' }[] = [
  { at: '0 h', what: 'You get an email: a card is waiting.' },
  { at: '36 h', what: 'The client hears “still with Lacey, by Thursday.” You get a nudge.' },
  { at: '72 h', what: 'Both again, and Erica is copied.', tone: 'warn' },
  { at: '14 d', what: 'You are told once. Nothing is closed for you.' },
]

// Which phone this is and whether it already opens from the home screen, read
// once on the client. The server renders the neutral version; the browser's
// answer replaces it on hydration without a second render pass.
const noop = () => () => {}
function phoneSnapshot(): string {
  const nav = navigator as Navigator & { standalone?: boolean }
  const standalone = Boolean(nav.standalone) || window.matchMedia?.('(display-mode: standalone)')?.matches === true
  return `${detectPlatform(navigator.userAgent, navigator.maxTouchPoints)}:${standalone ? 1 : 0}`
}
const serverSnapshot = () => 'other:0'

export function Walkthrough({ initialState, leadCount }: { initialState: WalkthroughState; leadCount: number }) {
  const [state, setState] = useState<WalkthroughState>(initialState)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [platform, standalone] = useSyncExternalStore(noop, phoneSnapshot, serverSnapshot).split(':')
  const hint = homeScreenHint(platform as Platform, standalone === '1')

  async function save(dismissed: boolean) {
    setBusy(true)
    setError('')
    const next: WalkthroughState = dismissed ? (leadCount === 0 ? 'collapsed' : 'hidden') : 'full'
    setState(next)
    try {
      const res = await fetch('/api/dashboard/walkthrough', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Could not save')
      }
    } catch (e) {
      setState(dismissed ? 'full' : 'collapsed')
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'hidden') return null

  if (state === 'collapsed') {
    return (
      <button
        onClick={() => save(false)}
        disabled={busy}
        className="w-full mb-6 flex items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-3 text-left text-xs text-[#9b9b9b] hover:border-[#c9a84c]/30 disabled:opacity-50"
      >
        <RotateCcw className="w-3.5 h-3.5 text-[#c9a84c] shrink-0" />
        <span className="flex-1">Walkthrough: home screen, the five taps, nothing slips.</span>
        <span className="text-[#c9a84c] font-medium">Show again</span>
      </button>
    )
  }

  return (
    <section aria-label="Getting started" className="mb-6 rounded-2xl border border-[#c9a84c]/30 bg-[#141414] p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] text-[#c9a84c] uppercase tracking-widest font-semibold mb-1">Getting started</p>
          <h2 className="text-base font-bold leading-tight">Three things, then it runs itself.</h2>
          <p className="text-xs text-[#9b9b9b] mt-1">Every inquiry lands here as one card. Every card ends with one tap from you.</p>
        </div>
        <button onClick={() => save(true)} disabled={busy} aria-label="Dismiss the walkthrough" className="p-1.5 -mr-1.5 -mt-1 rounded-full text-[#6b6b6b] hover:text-white hover:bg-[#1e1e1e] disabled:opacity-50">
          <X className="w-4 h-4" />
        </button>
      </div>

      <ol className="space-y-3">
        <Step n={1} icon={<Smartphone className="w-4 h-4" />} title={hint.title} done={hint.done}>
          <ol className="space-y-1 text-xs text-[#b5b5b5]">
            {hint.steps.map((s, i) => (
              <li key={s} className="flex gap-2">
                {hint.done ? <Check className="w-3.5 h-3.5 mt-px shrink-0 text-green-400" /> : <span className="text-[#6b6b6b] w-3.5 shrink-0 text-right">{i + 1}.</span>}
                <span>{s}</span>
              </li>
            ))}
          </ol>
          {!hint.done && <p className="text-[11px] text-[#6b6b6b] mt-2">It opens like an app, with your inbox on the first screen.</p>}
        </Step>

        <Step n={2} icon={<Hand className="w-4 h-4" />} title="One card, five taps">
          <p className="text-xs text-[#b5b5b5] mb-2">
            A card is one person: what they want, where, how big, their budget, their photos, and what is still open. Under it, your buttons.
          </p>
          <ul className="space-y-1.5">
            {TAPS.map((t) => (
              <li key={t.name} className="flex items-start gap-2 text-xs">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${t.name === 'Pass' || t.name === 'Deposit received' ? 'border border-[#2a2a2a] text-white' : 'bg-[#c9a84c] text-black'}`}>{t.name}</span>
                <span className="text-[#b5b5b5]"><span className="text-white">{t.button}</span>: {t.what}.</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-[#6b6b6b] mt-2">The assistant on each card has read all of it and drafts for you. It cannot send. Nothing reaches a client without your tap.</p>
        </Step>

        <Step n={3} icon={<ShieldCheck className="w-4 h-4" />} title="Nothing slips">
          <p className="text-xs text-[#b5b5b5] mb-2">If a card sits, the system speaks first, so no client waits in silence and you are never the last to know.</p>
          <ol className="space-y-1.5">
            {HOLDS.map((h) => (
              <li key={h.at} className="flex items-start gap-2 text-xs">
                <span className={`shrink-0 w-10 text-right font-mono text-[11px] ${h.tone === 'warn' ? 'text-amber-300' : 'text-[#c9a84c]'}`}>{h.at}</span>
                <span className="text-[#b5b5b5]">{h.what}</span>
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-[#6b6b6b] mt-2">A quote stays good for 14 days. A client who owes you an answer gets two weeks. Quiet hours 8 pm to 9 am: nothing fires at night.</p>
        </Step>
      </ol>

      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}

      <button
        onClick={() => save(true)}
        disabled={busy}
        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#c9a84c] py-3 text-sm font-bold text-black hover:bg-[#d4b45a] disabled:opacity-50"
      >
        Got it
        <ChevronRight className="w-4 h-4" />
      </button>
    </section>
  )
}

function Step({ n, icon, title, done, children }: { n: number; icon: React.ReactNode; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <li className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-green-900/30 text-green-400' : 'bg-[#c9a84c]/15 text-[#c9a84c]'}`}>{done ? <Check className="w-3.5 h-3.5" /> : icon}</span>
        <p className="text-sm font-semibold"><span className="text-[#6b6b6b] mr-1.5">{n}.</span>{title}</p>
      </div>
      {children}
    </li>
  )
}
