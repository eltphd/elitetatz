'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Bell, Shield, Eye, Trash2, ChevronRight, Moon, Globe } from 'lucide-react'
import { BottomNav } from '@/components/BottomNav'

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-[#c9a84c]' : 'bg-[#2a2a2a]'}`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </button>
  )
}

export default function SettingsPage() {
  const [notifs, setNotifs] = useState({
    matchAlerts: true,
    artistResponses: true,
    promotions: false,
    weeklyDigest: true,
  })

  const [privacy, setPrivacy] = useState({
    showProfile: true,
    shareData: false,
  })

  function toggleNotif(key: keyof typeof notifs) {
    setNotifs((n) => ({ ...n, [key]: !n[key] }))
  }

  function togglePrivacy(key: keyof typeof privacy) {
    setPrivacy((p) => ({ ...p, [key]: !p[key] }))
  }

  return (
    <div className="flex flex-col min-h-dvh pb-20">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-[#1e1e1e] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-bold">Settings</h1>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 space-y-6">

        {/* Notifications */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-[#c9a84c]" />
            <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium">Notifications</p>
          </div>
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a]">
            {[
              { key: 'matchAlerts', label: 'Match alerts', sub: 'When an artist accepts or rejects' },
              { key: 'artistResponses', label: 'Artist responses', sub: 'Messages and offer updates' },
              { key: 'weeklyDigest', label: 'Weekly digest', sub: 'New artists and flash drops' },
              { key: 'promotions', label: 'Promotions', sub: 'Deals and platform news' },
            ].map(({ key, label, sub }) => (
              <div key={key} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-[#6b6b6b]">{sub}</p>
                </div>
                <Toggle
                  on={notifs[key as keyof typeof notifs]}
                  onToggle={() => toggleNotif(key as keyof typeof notifs)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Privacy */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-[#c9a84c]" />
            <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium">Privacy</p>
          </div>
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a]">
            {[
              { key: 'showProfile', label: 'Public profile', sub: 'Artists can see your preferences' },
              { key: 'shareData', label: 'Share usage data', sub: 'Help us improve the AI matching' },
            ].map(({ key, label, sub }) => (
              <div key={key} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-[#6b6b6b]">{sub}</p>
                </div>
                <Toggle
                  on={privacy[key as keyof typeof privacy]}
                  onToggle={() => togglePrivacy(key as keyof typeof privacy)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Account links */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-[#c9a84c]" />
            <p className="text-xs text-[#6b6b6b] uppercase tracking-widest font-medium">Account</p>
          </div>
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a]">
            {[
              { icon: Globe, label: 'Terms of Service', href: '#' },
              { icon: Shield, label: 'Privacy Policy', href: '#' },
            ].map(({ icon: Icon, label, href }) => (
              <Link key={label} href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#1e1e1e] transition-colors">
                <Icon className="w-4 h-4 text-[#6b6b6b]" />
                <span className="flex-1 text-sm">{label}</span>
                <ChevronRight className="w-4 h-4 text-[#6b6b6b]" />
              </Link>
            ))}
          </div>
        </section>

        {/* Danger zone */}
        <section>
          <div className="bg-[#141414] border border-red-900/30 rounded-xl divide-y divide-[#2a2a2a]">
            <button className="flex items-center gap-3 px-4 py-3.5 w-full text-left hover:bg-[#1e1e1e] transition-colors">
              <Moon className="w-4 h-4 text-[#6b6b6b]" />
              <span className="flex-1 text-sm">Log out</span>
            </button>
            <button className="flex items-center gap-3 px-4 py-3.5 w-full text-left hover:bg-[#1e1e1e] transition-colors">
              <Trash2 className="w-4 h-4 text-red-400" />
              <span className="flex-1 text-sm text-red-400">Delete account</span>
            </button>
          </div>
        </section>

        <p className="text-center text-[10px] text-[#6b6b6b] pb-2">TatzAI v0.1.0</p>
      </main>

      <BottomNav active="profile" />
    </div>
  )
}
