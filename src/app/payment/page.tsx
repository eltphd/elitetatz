'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CreditCard, Plus, Shield, CheckCircle, Trash2 } from 'lucide-react'
import { BottomNav } from '@/components/BottomNav'

const MOCK_CARDS = [
  { id: 'c1', brand: 'Visa', last4: '4242', expiry: '12/27', isDefault: true },
]

export default function PaymentPage() {
  const [cards, setCards] = useState(MOCK_CARDS)
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="flex flex-col min-h-dvh pb-20">
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-[#1e1e1e] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-bold">Payment Methods</h1>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4">
        {/* Security note */}
        <div className="flex items-start gap-3 p-3 bg-[#141414] border border-[#2a2a2a] rounded-xl mb-5">
          <Shield className="w-4 h-4 text-[#c9a84c] shrink-0 mt-0.5" />
          <p className="text-xs text-[#6b6b6b] leading-relaxed">
            Cards are stored securely via Stripe. TatzAI never stores your full card number.
          </p>
        </div>

        {/* Saved cards */}
        {cards.length > 0 && (
          <div className="mb-5">
            <p className="text-xs text-[#6b6b6b] uppercase tracking-widest mb-3">Saved cards</p>
            <div className="space-y-2">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center gap-3 p-4 bg-[#141414] border border-[#2a2a2a] rounded-xl"
                >
                  <div className="w-10 h-7 bg-[#1e1e1e] border border-[#2a2a2a] rounded-md flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 text-[#c9a84c]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{card.brand} ···· {card.last4}</p>
                    <p className="text-xs text-[#6b6b6b]">Expires {card.expiry}</p>
                  </div>
                  {card.isDefault && (
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-[#c9a84c]" />
                      <span className="text-[10px] text-[#c9a84c] font-medium">Default</span>
                    </div>
                  )}
                  <button
                    onClick={() => setCards((c) => c.filter((x) => x.id !== card.id))}
                    className="p-1.5 rounded-lg hover:bg-[#2a2a2a] transition-colors ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#6b6b6b]" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add card */}
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-3 w-full p-4 bg-[#141414] border border-dashed border-[#2a2a2a] hover:border-[#c9a84c]/30 rounded-xl transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-[#1e1e1e] flex items-center justify-center">
              <Plus className="w-4 h-4 text-[#c9a84c]" />
            </div>
            <span className="text-sm font-medium text-[#c9a84c]">Add new card</span>
          </button>
        ) : (
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 space-y-4">
            <p className="text-sm font-semibold">Add card</p>
            {[
              { label: 'Card number', placeholder: '1234 5678 9012 3456', type: 'text' },
              { label: 'Name on card', placeholder: 'Full name', type: 'text' },
            ].map(({ label, placeholder, type }) => (
              <div key={label}>
                <label className="text-xs text-[#6b6b6b] mb-1.5 block">{label}</label>
                <input
                  type={type}
                  placeholder={placeholder}
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors"
                />
              </div>
            ))}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-[#6b6b6b] mb-1.5 block">Expiry</label>
                <input
                  type="text"
                  placeholder="MM / YY"
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-[#6b6b6b] mb-1.5 block">CVC</label>
                <input
                  type="text"
                  placeholder="123"
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#6b6b6b] outline-none focus:border-[#c9a84c]/40 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 bg-[#1e1e1e] border border-[#2a2a2a] text-white font-medium py-3 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button className="flex-1 bg-[#c9a84c] text-black font-bold py-3 rounded-xl text-sm">
                Save Card
              </button>
            </div>
          </div>
        )}

        {/* Apple Pay / Google Pay note */}
        <div className="mt-5 p-4 bg-[#141414] border border-[#2a2a2a] rounded-xl">
          <p className="text-xs text-[#6b6b6b] text-center">
            Apple Pay and Google Pay available at checkout
          </p>
        </div>
      </main>

      <BottomNav active="profile" />
    </div>
  )
}
