'use client'

import { useState } from 'react'
import { CONSENT_SCOPES, CONSENT_NOTE, type ConsentScope } from '@/lib/consent'

// The client's opt-ins, both unticked by default. Controlled by the parent
// in the concierge (saved when the brief is sent); self-saving on the
// inquiry page, where each change is recorded as it is made.

export function ConsentBoxes({
  value,
  onChange,
  disabled,
}: {
  value: Record<ConsentScope, boolean>
  onChange: (scope: ConsentScope, granted: boolean) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Optional updates</legend>
      {(Object.keys(CONSENT_SCOPES) as ConsentScope[]).map((scope) => (
        <label key={scope} htmlFor={`consent-${scope}`} className="flex items-start gap-2.5 text-xs text-[#d6d6d0] leading-snug cursor-pointer">
          <input
            id={`consent-${scope}`}
            type="checkbox"
            checked={value[scope]}
            disabled={disabled}
            onChange={(e) => onChange(scope, e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#c9a84c]"
          />
          <span>{CONSENT_SCOPES[scope]}</span>
        </label>
      ))}
      <p className="text-[11px] text-[#6b6b6b] leading-snug">{CONSENT_NOTE}</p>
    </fieldset>
  )
}

export function InquiryConsent({
  matchId,
  token,
  initial,
}: {
  matchId: string
  token: string
  initial: Record<ConsentScope, boolean>
}) {
  const [value, setValue] = useState(initial)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function change(scope: ConsentScope, granted: boolean) {
    const previous = value
    setValue({ ...value, [scope]: granted })
    setState('saving')
    try {
      const res = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, t: token, choices: { [scope]: granted }, source: 'inquiry_page' }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setState('saved')
    } catch {
      setValue(previous)
      setState('error')
    }
  }

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4 space-y-2">
      <ConsentBoxes value={value} onChange={change} disabled={state === 'saving'} />
      <p role="status" className="text-[11px] min-h-[1em] text-[#6b6b6b]">
        {state === 'saved' && 'Saved.'}
        {state === 'error' && <span className="text-red-300">That didn&apos;t save. Try again.</span>}
      </p>
    </div>
  )
}
