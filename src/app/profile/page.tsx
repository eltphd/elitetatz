'use client'

import { BottomNav } from '@/components/BottomNav'
import { User, ChevronRight, Star, Heart, Settings, LogOut, Shield } from 'lucide-react'
import Link from 'next/link'

const MENU_ITEMS = [
  { icon: Star, label: 'My Matches', sub: '3 active requests', href: '/matches' },
  { icon: Heart, label: 'Saved Artists', sub: '8 artists saved', href: '/saved' },
  { icon: Shield, label: 'Payment Methods', sub: 'Add card for booking', href: '/payment' },
  { icon: Settings, label: 'Settings', sub: 'Notifications, privacy', href: '/settings' },
]

export default function ProfilePage() {
  return (
    <div className="flex flex-col min-h-dvh pb-20">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold">Profile</h1>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-6">
        {/* Guest state */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-[#1e1e1e] border-2 border-[#2a2a2a] flex items-center justify-center mx-auto mb-4">
            <User className="w-9 h-9 text-[#6b6b6b]" />
          </div>
          <p className="text-lg font-semibold mb-1">Guest</p>
          <p className="text-sm text-[#6b6b6b] mb-5">Sign in to save artists and track requests</p>
          <div className="flex gap-3">
            <Link href="/auth/signup" className="flex-1 bg-[#c9a84c] text-black font-semibold py-3 rounded-xl text-sm text-center">
              Sign Up
            </Link>
            <Link href="/auth/login" className="flex-1 bg-[#1e1e1e] border border-[#2a2a2a] text-white font-medium py-3 rounded-xl text-sm text-center">
              Log In
            </Link>
          </div>
        </div>

        {/* Menu */}
        <div className="space-y-2 mb-6">
          {MENU_ITEMS.map(({ icon: Icon, label, sub, href }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-3 p-4 bg-[#141414] border border-[#2a2a2a] rounded-xl hover:border-[#c9a84c]/20 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-[#1e1e1e] flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[#c9a84c]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-[#6b6b6b]">{sub}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#6b6b6b]" />
            </Link>
          ))}
        </div>

        {/* Artist CTA */}
        <Link
          href="/artist/signup"
          className="block bg-[#141414] border border-[#c9a84c]/30 rounded-2xl p-4 text-center"
        >
          <p className="text-xs text-[#c9a84c] uppercase tracking-widest mb-1">Are you a tattoo artist?</p>
          <p className="text-sm font-medium">Join the platform →</p>
        </Link>
      </main>

      <BottomNav active="profile" />
    </div>
  )
}
