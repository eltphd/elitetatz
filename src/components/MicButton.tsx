'use client'

import { Mic, Square } from 'lucide-react'

// One button, two states. Rendered only where the browser can transcribe.
export function MicButton({
  supported, listening, onToggle, className = '',
}: {
  supported: boolean
  listening: boolean
  onToggle: () => void
  className?: string
}) {
  if (!supported) return null
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={listening}
      aria-label={listening ? 'Stop listening' : 'Say it instead of typing'}
      title={listening ? 'Stop' : 'Say it instead of typing'}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
        listening ? 'bg-[#c9a84c] text-black animate-pulse' : 'text-[#6b6b6b] hover:text-[#c9a84c]'
      } ${className}`}
    >
      {listening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-5 w-5" />}
    </button>
  )
}
