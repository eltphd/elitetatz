'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/'

  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [magicLoading, setMagicLoading] = useState(false)
  const [error, setError] = useState('')
  const [magicSent, setMagicSent] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push(next)
    router.refresh()
  }

  async function handleMagicLink() {
    if (!form.email) { setError('Enter your email first'); return }
    setError('')
    setMagicLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: form.email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${next}` },
    })
    setMagicLoading(false)
    if (error) { setError(error.message); return }
    setMagicSent(true)
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#0a0a0a]">
      <header className="px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-[#1e1e1e] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-semibold">Log in</span>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-8 pb-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-1">
            <span className="gradient-gold">Tatz</span><span className="text-white">AI</span>
          </h1>
          <p className="text-sm text-[#6b6b6b]">Welcome back</p>
        </div>

        {magicSent ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-full bg-[#c9a84c]/10 border border-[#c9a84c]/30 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-[#c9a84c]" />
            </div>
            <p className="font-semibold mb-2">Check your email</p>
            <p className="text-sm text-[#6b6b6b]">We sent a magic link to <span className="text-white">{form.email}</span></p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
            )}

            <div>
              <label className="text-xs text-[#6b6b6b] mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-[#6b6b6b]">Password</label>
                <Link href="/auth/reset" className="text-xs text-[#c9a84c]">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Your password"
                  required
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl pl-11 pr-11 py-3 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6b6b6b]">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#c9a84c] hover:bg-[#d4b45a] disabled:opacity-60 text-black font-bold py-4 rounded-2xl text-sm transition-colors mt-2 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Log In
            </button>

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-[#2a2a2a]" />
              <span className="text-xs text-[#6b6b6b]">or</span>
              <div className="flex-1 h-px bg-[#2a2a2a]" />
            </div>

            <button
              type="button"
              onClick={handleMagicLink}
              disabled={magicLoading}
              className="w-full flex items-center justify-center gap-2 bg-[#1e1e1e] border border-[#2a2a2a] hover:border-[#c9a84c]/30 text-white font-medium py-3.5 rounded-2xl text-sm transition-colors disabled:opacity-60"
            >
              {magicLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4 text-[#c9a84c]" />}
              Send magic link instead
            </button>

            <p className="text-center text-xs text-[#6b6b6b]">
              Don&apos;t have an account?{' '}
              <Link href="/auth/signup" className="text-[#c9a84c] font-medium">Sign up</Link>
            </p>
          </form>
        )}
      </main>
    </div>
  )
}
