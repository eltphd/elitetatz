'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Lock, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const MIN_LENGTH = 8

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password.length < MIN_LENGTH) { setError(`Use at least ${MIN_LENGTH} characters`); return }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: form.password })
    setLoading(false)
    if (error) {
      // The recovery link is single-use and short-lived; a missing session
      // means it expired or was already consumed.
      setError(/session/i.test(error.message)
        ? 'This reset link has expired. Request a new one below.'
        : error.message)
      return
    }
    setDone(true)
    setTimeout(() => { router.push('/dashboard'); router.refresh() }, 1200)
  }

  const inputClass = 'w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl pl-11 pr-11 py-3 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors'

  return (
    <div className="min-h-dvh flex flex-col bg-[#0a0a0a]">
      <header className="px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/auth/login" className="p-2 -ml-2 rounded-full hover:bg-[#1e1e1e] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-semibold">New password</span>
        </div>
      </header>
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-8 pb-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-1">
            <span className="gradient-gold">Tatz</span><span className="text-white">AI</span>
          </h1>
          <p className="text-sm text-[#6b6b6b]">Choose a new password for your account</p>
        </div>

        {done ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-full bg-[#c9a84c]/10 border border-[#c9a84c]/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-[#c9a84c]" />
            </div>
            <p className="font-semibold mb-2">Password updated</p>
            <p className="text-sm text-[#6b6b6b]">Taking you to your dashboard…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">
                {error}
                {/session|expired/i.test(error) && (
                  <> <Link href="/auth/reset" className="text-[#c9a84c] underline">Request a new link</Link></>
                )}
              </div>
            )}

            <div>
              <label className="text-xs text-[#6b6b6b] mb-1.5 block">New password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                <input type={showPassword ? 'text' : 'password'} value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={`At least ${MIN_LENGTH} characters`} required minLength={MIN_LENGTH} autoComplete="new-password"
                  className={inputClass} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6b6b6b]" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-[#6b6b6b] mb-1.5 block">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                <input type={showPassword ? 'text' : 'password'} value={form.confirm}
                  onChange={(e) => setForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="Same password again" required minLength={MIN_LENGTH} autoComplete="new-password"
                  className={inputClass} />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-[#c9a84c] hover:bg-[#d4b45a] disabled:opacity-60 text-black font-bold py-4 rounded-2xl text-sm transition-colors mt-2 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Update password
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
