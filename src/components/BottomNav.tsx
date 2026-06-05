'use client'

import Link from 'next/link'
import { Home, Search, Sparkles, Bell, User } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', icon: Home, label: 'Home', key: 'home' },
  { href: '/explore', icon: Search, label: 'Explore', key: 'explore' },
  { href: '/agent', icon: Sparkles, label: 'TatzAI', key: 'agent' },
  { href: '/notifications', icon: Bell, label: 'Alerts', key: 'notifications' },
  { href: '/profile', icon: User, label: 'Me', key: 'profile' },
]

export function BottomNav({ active }: { active: string }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-[#2a2a2a] safe-area-pb">
      <div className="flex items-center justify-around max-w-lg mx-auto px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {NAV_ITEMS.map(({ href, icon: Icon, label, key }) => {
          const isActive = active === key
          const isAI = key === 'agent'
          return (
            <Link
              key={key}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[52px] ${
                isAI
                  ? 'bg-[#c9a84c] text-black rounded-2xl px-4'
                  : isActive
                  ? 'text-[#c9a84c]'
                  : 'text-[#6b6b6b]'
              }`}
            >
              <Icon className={`w-5 h-5 ${isAI ? 'text-black' : ''}`} />
              <span className={`text-[10px] font-medium ${isAI ? 'text-black' : ''}`}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
