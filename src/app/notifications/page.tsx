'use client'

import { BottomNav } from '@/components/BottomNav'
import { Bell, Star, CheckCircle, Clock, Sparkles, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const MOCK_NOTIFICATIONS = [
  {
    id: '1',
    type: 'match_accepted',
    title: 'Marco Vega accepted your request!',
    body: 'He\'s ready to book your blackwork sleeve for $1,500.',
    time: '2h ago',
    read: false,
    icon: CheckCircle,
    iconColor: 'text-green-400',
    href: '/matches',
  },
  {
    id: '2',
    type: 'brief_ready',
    title: 'Your brief is ready to send',
    body: 'TatzAI finished refining your fine-line botanical piece. Send it to artists?',
    time: '1d ago',
    read: false,
    icon: Sparkles,
    iconColor: 'text-[#c9a84c]',
    href: '/agent',
  },
  {
    id: '3',
    type: 'match_pending',
    title: 'Request sent to 3 artists',
    body: 'Sofia Reyes and 2 others received your brief. They typically respond within 48h.',
    time: '2d ago',
    read: true,
    icon: Clock,
    iconColor: 'text-yellow-400',
    href: '/matches',
  },
]

export default function NotificationsPage() {
  return (
    <div className="flex flex-col min-h-dvh pb-20">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-lg font-bold">Notifications</h1>
          <button className="text-xs text-[#c9a84c]">Mark all read</button>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4">
        {MOCK_NOTIFICATIONS.length === 0 ? (
          <div className="text-center py-20">
            <Bell className="w-10 h-10 text-[#6b6b6b] mx-auto mb-4 opacity-40" />
            <p className="text-[#6b6b6b] text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {MOCK_NOTIFICATIONS.map((n) => {
              const Icon = n.icon
              return (
                <Link
                  key={n.id}
                  href={n.href}
                  className={`flex items-start gap-3 p-4 rounded-2xl border transition-colors ${
                    n.read
                      ? 'bg-[#141414] border-[#2a2a2a]'
                      : 'bg-[#1a1a1a] border-[#c9a84c]/20'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full bg-[#1e1e1e] flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`w-4 h-4 ${n.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold leading-tight ${n.read ? 'text-[#f5f5f0]' : 'text-white'}`}>
                        {n.title}
                      </p>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-[#c9a84c] shrink-0 mt-1" />}
                    </div>
                    <p className="text-xs text-[#6b6b6b] mt-0.5 leading-relaxed">{n.body}</p>
                    <p className="text-[10px] text-[#6b6b6b] mt-1">{n.time}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>

      <BottomNav active="notifications" />
    </div>
  )
}
