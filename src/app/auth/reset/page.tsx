'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#0a0a0a]">
      <header className="px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/auth/login" className="p-2 -ml-2 rounded-full hover:bg-[#1e1e1e] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-semibold">Reset password</span>
        </div>
      </header>
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-8 pb-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-1">
            <span className="gradient-gold">Tatz</span><span className="text-white">AI</span>
          </h1>
          <p className="text-sm text-[#6b6b6b]">We&apos;ll email you a link to set a new password</p>
        </div>

        {sent ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-full bg-[#c9a84c]/10 border border-[#c9a84c]/30 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-[#c9a84c]" />
            </div>
            <p className="font-semibold mb-2">Check your email</p>
            <p className="text-sm text-[#6b6b6b]">
              If an account exists for <span className="text-white">{email}</span>, a reset link is on its way.
            </p>
            <Link href="/auth/login" className="inline-block mt-6 text-xs text-[#c9a84c]">Back to log in</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}

            <div>
              <label className="text-xs text-[#6b6b6b] mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" required autoComplete="email"
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors" />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-[#c9a84c] hover:bg-[#d4b45a] disabled:opacity-60 text-black font-bold py-4 rounded-2xl text-sm transition-colors mt-2 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Send reset link
            </button>

            <p className="text-center text-xs text-[#6b6b6b]">
              Remembered it?{' '}
              <Link href="/auth/login" className="text-[#c9a84c] font-medium">Log in</Link>
            </p>
          </form>
        )}
      </main>
    </div>
  )
}
