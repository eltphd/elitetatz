import { track as vercelTrack } from '@vercel/analytics/server'

// Funnel events for Vercel Web Analytics (custom events, Pro plan). Server-side
// so ad blockers cannot drop them. Properties never carry who: no names,
// emails, phones or match ids, only what happened and how.
export type FunnelEvent = 'inquiry_sent' | 'deposit_paid' | 'club_joined' | 'club_confirmed'

export async function track(
  event: FunnelEvent,
  req: Request,
  props?: Record<string, string | number | boolean | null>
): Promise<void> {
  try {
    await vercelTrack(event, props, { request: { headers: req.headers } })
  } catch (err) {
    console.warn(`analytics: ${event} not recorded`, err)
  }
}
