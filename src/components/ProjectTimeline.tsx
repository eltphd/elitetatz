'use client'

import { Check, Clock } from 'lucide-react'
import { ProjectStage, PROJECT_STAGES } from '@/lib/types'

const ACTIVE_STAGES = PROJECT_STAGES.filter((s) => s.key !== 'rejected')

function stageIndex(stage: ProjectStage): number {
  return ACTIVE_STAGES.findIndex((s) => s.key === stage)
}

export function ProjectTimeline({ stage }: { stage: ProjectStage }) {
  if (stage === 'rejected') {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
          <span className="text-red-400 text-[10px]">✕</span>
        </div>
        <span className="text-xs text-red-400 font-medium">Artist declined this request</span>
      </div>
    )
  }

  const currentIdx = stageIndex(stage)

  return (
    <div className="w-full py-3" data-testid="project-timeline">
      {/* Step dots + connector line */}
      <div className="relative flex items-center justify-between mb-3">
        {/* Background line */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#2a2a2a]" />
        {/* Progress line */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#c9a84c] transition-all duration-500"
          style={{
            width: currentIdx === 0
              ? '0%'
              : `${(currentIdx / (ACTIVE_STAGES.length - 1)) * 100}%`,
          }}
        />
        {ACTIVE_STAGES.map((s, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          return (
            <div
              key={s.key}
              className="relative z-10 flex items-center justify-center"
              data-testid={`stage-dot-${s.key}`}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                  done
                    ? 'bg-[#c9a84c] border-[#c9a84c]'
                    : active
                    ? 'bg-[#0a0a0a] border-[#c9a84c] ring-2 ring-[#c9a84c]/20'
                    : 'bg-[#0a0a0a] border-[#2a2a2a]'
                }`}
              >
                {done && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                {active && <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]" />}
              </div>
            </div>
          )
        })}
      </div>

      {/* Labels */}
      <div className="flex items-start justify-between">
        {ACTIVE_STAGES.map((s, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          return (
            <div
              key={s.key}
              className="flex flex-col items-center"
              style={{ width: `${100 / ACTIVE_STAGES.length}%` }}
            >
              <span
                className={`text-[9px] text-center leading-tight font-medium transition-colors ${
                  active ? 'text-[#c9a84c]' : done ? 'text-[#c9a84c]/60' : 'text-[#6b6b6b]'
                }`}
              >
                {s.label}
              </span>
              {active && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  <Clock className="w-2 h-2 text-[#c9a84c]" />
                  <span className="text-[8px] text-[#c9a84c]">Now</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
