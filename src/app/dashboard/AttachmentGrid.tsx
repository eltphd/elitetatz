import { FileText, Paperclip } from 'lucide-react'

// The client's reference files, on the card. Images open full size in a new
// tab through their signed URL; PDFs and anything unsigned show as a link or
// a name. Server-rendered: the URLs are minted on the server per page load.

export interface AttachmentView {
  id: string
  filename: string
  mime: string | null
  size_bytes: number | null
  source: string
  url: string | null
  created_at: string
}

const kb = (n: number | null) => (n == null ? '' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

export function AttachmentGrid({ items, demo = false }: { items: AttachmentView[]; demo?: boolean }) {
  if (!items.length) return null
  const images = items.filter((a) => a.mime?.startsWith('image/') && a.url)
  const others = items.filter((a) => !(a.mime?.startsWith('image/') && a.url))
  return (
    <div className="mb-3">
      <p className="text-[10px] text-[#6b6b6b] uppercase tracking-wide font-medium mb-1.5 flex items-center gap-1">
        <Paperclip className="w-3 h-3" /> Reference files · {items.length}
      </p>
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((a) => (
            <a
              key={a.id}
              href={a.url!}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1e1e1e]"
              title={`${a.filename}${a.size_bytes ? ` · ${kb(a.size_bytes)}` : ''}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs change per load; next/image would need a remote pattern per bucket host */}
              <img src={a.url!} alt={a.filename} className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" loading="lazy" />
              <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-[#d0d0d0] px-1.5 py-0.5 truncate">{a.filename}</span>
            </a>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <ul className={`${images.length ? 'mt-2 ' : ''}space-y-1`}>
          {others.map((a) => (
            <li key={a.id} className="text-xs flex items-center gap-1.5 text-[#9b9b9b]">
              <FileText className="w-3 h-3 shrink-0" />
              {a.url && !demo ? (
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#c9a84c] truncate">{a.filename}</a>
              ) : (
                <span className="truncate">{a.filename}</span>
              )}
              {a.size_bytes ? <span className="text-[#6b6b6b] shrink-0">{kb(a.size_bytes)}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
