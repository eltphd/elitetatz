import type { SupabaseClient } from '@supabase/supabase-js'

// First-visit onboarding for an artist. Nothing here is paper: the dashboard
// shows a three-step walkthrough until she dismisses it, the dismissal lives
// on her row in `artists` (migration 017), and at zero leads an example card
// stands in for the first real one. Pure decisions first, I/O after.

export type WalkthroughState = 'full' | 'collapsed' | 'hidden'

/**
 * The card shows in full until she has dismissed it. Dismissed with no leads
 * yet, it folds to one line she can reopen (the inbox is otherwise empty);
 * dismissed once a lead exists, it is gone.
 */
export function walkthroughState(input: { leadCount: number; dismissedAt: string | null | undefined }): WalkthroughState {
  if (!input.dismissedAt) return 'full'
  return input.leadCount === 0 ? 'collapsed' : 'hidden'
}

export type Platform = 'ios' | 'android' | 'other'

/** iPhone and iPad (iPadOS reports as a Mac with touch), Android, or something else. */
export function detectPlatform(userAgent: string | null | undefined, maxTouchPoints = 0): Platform {
  const ua = userAgent ?? ''
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

export interface HomeScreenHint {
  title: string
  steps: string[]
  done: boolean
}

/** The gesture for this phone, in words. `standalone` means it already opens from the home screen. */
export function homeScreenHint(platform: Platform, standalone: boolean): HomeScreenHint {
  if (standalone) {
    return { title: 'Already on your home screen', steps: ['You opened this from the icon. Nothing to do here.'], done: true }
  }
  switch (platform) {
    case 'ios':
      return {
        title: 'Put it on your home screen',
        steps: ['Open elitetatz.app in Safari.', 'Tap Share (the square with the arrow).', 'Tap Add to Home Screen, then Add.'],
        done: false,
      }
    case 'android':
      return {
        title: 'Put it on your home screen',
        steps: ['Open elitetatz.app in Chrome.', 'Tap the three-dot menu at the top right.', 'Tap Add to Home screen (or Install app).'],
        done: false,
      }
    default:
      return {
        title: 'Put it on your phone’s home screen',
        steps: ['On your phone, open elitetatz.app.', 'iPhone: Share → Add to Home Screen.', 'Android: three-dot menu → Add to Home screen.'],
        done: false,
      }
  }
}

// ---- storage ------------------------------------------------------------------

/**
 * When she dismissed the walkthrough, or null. A database that has not had
 * migration 017 applied answers with an error; that reads as "never", so a
 * deploy ahead of the migration shows the card instead of locking her out.
 */
export async function walkthroughDismissedAt(db: SupabaseClient, artistId: string): Promise<string | null> {
  const { data, error } = await db.from('artists').select('walkthrough_dismissed_at').eq('id', artistId).maybeSingle()
  if (error || !data) return null
  const v = (data as { walkthrough_dismissed_at?: string | null }).walkthrough_dismissed_at
  return v ?? null
}

/** Records her tap (or brings the card back). Writes only her own row. */
export async function setWalkthroughDismissed(
  db: SupabaseClient,
  artistId: string,
  dismissed: boolean,
  now = new Date(),
): Promise<{ ok: true; dismissedAt: string | null } | { ok: false; error: string }> {
  const dismissedAt = dismissed ? now.toISOString() : null
  const { error } = await db.from('artists').update({ walkthrough_dismissed_at: dismissedAt }).eq('id', artistId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, dismissedAt }
}
