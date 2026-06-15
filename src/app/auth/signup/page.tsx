'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Lock, User, Eye, EyeOff, Sparkles, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<'client' | 'artist'>('client')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  function update(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.name, role },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#0a0a0a]">
      <header className="px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-[#1e1e1e] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-semibold">Create account</span>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-8 pb-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-1">
            <span className="gradient-gold">Tatz</span><span className="text-white">AI</span>
          </h1>
          <p className="text-sm text-[#6b6b6b]">Join the platform</p>
        </div>

        {done ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-full bg-[#c9a84c]/10 border border-[#c9a84c]/30 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-[#c9a84c]" />
            </div>
            <p className="font-semibold mb-2">Check your email</p>
            <p className="text-sm text-[#6b6b6b]">We sent a confirmation link to <span className="text-white">{form.email}</span>. Click it to activate your account.</p>
            <Link href="/auth/login" className="inline-block mt-6 text-sm text-[#c9a84c] font-medium">Back to login</Link>
          </div>
        ) : (
          <>
            <div className="flex bg-[#1e1e1e] rounded-xl p-1 mb-6">
              {(['client', 'artist'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                    role === r ? 'bg-[#c9a84c] text-black' : 'text-[#6b6b6b]'
                  }`}
                >
                  {r === 'client' ? 'I want a tattoo' : 'I\'m an artist'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              {error && (
                <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>
              )}

              <div>
                <label className="text-xs text-[#6b6b6b] mb-1.5 block">Full name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                  <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Your name" required
                    className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors" />
                </div>
              </div>

              <div>
                <label className="text-xs text-[#6b6b6b] mb-1.5 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                  <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@example.com" required
                    className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors" />
                </div>
              </div>

              <div>
                <label className="text-xs text-[#6b6b6b] mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
                  <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="Min 8 characters" required
                    className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl pl-11 pr-11 py-3 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6b6b6b]">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {role === 'artist' && (
                <div className="bg-[#141414] border border-[#c9a84c]/20 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-[#c9a84c] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#6b6b6b]">Artist accounts are reviewed before going live. After signup you'll complete your full artist profile.</p>
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full bg-[#c9a84c] hover:bg-[#d4b45a] disabled:opacity-60 text-black font-bold py-4 rounded-2xl text-sm transition-colors mt-2 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Account
              </button>

              <p className="text-center text-xs text-[#6b6b6b]">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-[#c9a84c] font-medium">Log in</Link>
              </p>
              <p className="text-center text-[10px] text-[#6b6b6b] leading-relaxed">
                By signing up you agree to our Terms of Service and Privacy Policy.
              </p>
            </form>
          </>
        )}
      </main>
    </div>
  )
}
