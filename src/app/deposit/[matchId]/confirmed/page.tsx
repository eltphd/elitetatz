import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

export default function DepositConfirmedPage() {
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-green-900/20 border border-green-800/40 flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-7 h-7 text-green-400" />
        </div>
        <h1 className="text-xl font-bold mb-2">You&apos;re booked in</h1>
        <p className="text-sm text-[#9b9b9b] mb-1">Your deposit is confirmed.</p>
        <p className="text-sm text-[#9b9b9b] mb-6">Lacey will reach out to lock in your appointment date and time.</p>
        <Link href="/matches" className="inline-flex items-center gap-2 bg-[#c9a84c] text-black font-bold px-6 py-3 rounded-2xl text-sm">
          View your project
        </Link>
      </div>
    </div>
  )
}
