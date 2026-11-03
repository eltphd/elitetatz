'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { useSpeechInput } from '@/components/useSpeechInput'
import { MicButton } from '@/components/MicButton'

const INPUT = 'w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors'
const CHANNELS = [
  { value: 'instagram', label: 'Instagram DM' },
  { value: 'facebook', label: 'Facebook Messenger' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'Text message' },
  { value: 'manual', label: 'In person / phone / other' },
]

export function NewLeadForm({ demo = false }: { demo?: boolean }) {
  const router = useRouter()
  const [channel, setChannel] = useState('instagram')
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const base = useRef('')
  const speech = useSpeechInput((t) => setText([base.current, t].filter(Boolean).join(' ')))
  function toggleMic() { if (!speech.listening) base.current = text.trim(); speech.toggle() }

  async function submit() {
    if (busy || !text.trim()) return
    setBusy(true); setError('')
    try {
      if (demo) { await new Promise((r) => setTimeout(r, 600)); router.push('/demo/inbox'); return }
      const res = await fetch('/api/dashboard/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, name, handle, email, phone, subject, text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not save')
      router.push('/dashboard')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
      setBusy(false)
    }
  }

  const needsContact = !name && !handle && !email && !phone

  return (
    <div className="space-y-3">
      <Field label="Where did it come from?">
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={INPUT}>
          {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan" className={INPUT} /></Field>
        <Field label={channel === 'instagram' || channel === 'facebook' ? 'Handle' : 'Handle (optional)'}><input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" className={INPUT} /></Field>
        <Field label="Email (optional)"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="so replies can go by email" className={INPUT} /></Field>
        <Field label="Phone (optional)"><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="so replies can go by text" className={INPUT} /></Field>
      </div>
      {channel === 'email' && <Field label="Subject (optional)"><input value={subject} onChange={(e) => setSubject(e.target.value)} className={INPUT} /></Field>}
      <Field label="What they wrote">
        <div className="relative">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder="Paste the message, or tap the mic and read it out." className={`${INPUT} resize-y pr-10`} />
          <MicButton supported={speech.supported} listening={speech.listening} onToggle={toggleMic} className="absolute right-1.5 top-1.5" />
        </div>
      </Field>
      {needsContact && text.trim() && <p className="text-[11px] text-amber-300">No name, handle, email or phone: the card will say Anonymous and you will not be able to reply from the inbox.</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button onClick={submit} disabled={busy || !text.trim()} className="w-full bg-[#c9a84c] text-black font-bold py-3 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-1.5">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        Add to inbox
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-[#6b6b6b] block mb-1">{label}</label>
      {children}
    </div>
  )
}
