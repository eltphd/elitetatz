'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2, CheckCircle } from 'lucide-react'

// The client adds reference photos from their inquiry page. They go straight
// onto the lead, so there is no "did my attachment come through".

export function ReferenceUpload({ matchId, token, existing, artistName }: { matchId: string; token: string; existing: number; artistName: string }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  const [error, setError] = useState('')

  async function upload(files: FileList | null) {
    if (!files || !files.length || busy) return
    setBusy(true); setError(''); setDone(null)
    try {
      const fd = new FormData()
      fd.set('matchId', matchId)
      fd.set('t', token)
      for (const f of Array.from(files).slice(0, 6)) fd.append('files', f)
      const res = await fetch('/api/inquiry/upload', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not upload')
      setDone((data.files ?? []).length)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-4">
      <p className="text-sm font-semibold mb-1">Reference photos</p>
      <p className="text-xs text-[#9b9b9b] mb-3">
        {existing > 0 ? `${existing} file${existing === 1 ? '' : 's'} with ${artistName} already. ` : ''}
        Add the images you want {artistName} to see: what you love about them, the spot on your body, anything you&apos;d like covered. Images and PDFs, up to 25 MB each.
      </p>
      <input ref={input} type="file" accept="image/*,.pdf" multiple hidden onChange={(e) => upload(e.target.files)} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="flex items-center justify-center gap-2 w-full bg-[#1e1e1e] border border-[#c9a84c]/30 text-[#e0c878] font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
        {busy ? 'Uploading…' : 'Add photos'}
      </button>
      {done != null && <p className="mt-2 text-xs text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {done} file{done === 1 ? '' : 's'} added. {artistName} can see {done === 1 ? 'it' : 'them'} now.</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  )
}
