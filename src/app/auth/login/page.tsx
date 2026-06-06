'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  return (
    <div className="min-h-dvh flex flex-col bg-[#0a0a0a]">
      <header className="px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-[#1e1e1e] transition-colors">
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

        <div className="space-y-4">
          <div>
            <label className="text-xs text-[#6b6b6b] mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
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
                className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl pl-11 pr-11 py-3 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6b6b6b]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button className="w-full bg-[#c9a84c] hover:bg-[#d4b45a] text-black font-bold py-4 rounded-2xl text-sm transition-colors mt-2">
            Log In
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-[#2a2a2a]" />
            <span className="text-xs text-[#6b6b6b]">or</span>
            <div className="flex-1 h-px bg-[#2a2a2a]" />
          </div>

          {/* Magic link */}
          <button className="w-full flex items-center justify-center gap-2 bg-[#1e1e1e] border border-[#2a2a2a] hover:border-[#c9a84c]/30 text-white font-medium py-3.5 rounded-2xl text-sm transition-colors">
            <Mail className="w-4 h-4 text-[#c9a84c]" />
            Send magic link instead
          </button>

          <p className="text-center text-xs text-[#6b6b6b]">
            Don't have an account?{' '}
            <Link href="/auth/signup" className="text-[#c9a84c] font-medium">Sign up</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
