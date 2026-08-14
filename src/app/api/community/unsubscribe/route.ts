import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// One-click unsubscribe. The member's UUID doubles as the unguessable token —
// it is only ever delivered inside that member's own welcome email.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function page(title: string, body: string): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#0a0805;color:#f0ebe0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px;">
<div><h1 style="font-family:Georgia,serif;font-weight:400;color:#c9a050;">${title}</h1><p style="color:#a09070;max-width:420px;">${body}</p></div>
</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!UUID_RE.test(id)) {
    return page('Hmm.', 'That unsubscribe link looks incomplete. Try the link from your email again.')
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return page('Try again later', 'We could not process this right now. Reply to any email from us and we will remove you by hand.')
  }

  const { data } = await supabase
    .from('community_members')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('id', id)
    .is('unsubscribed_at', null)
    .select('id')

  void data
  return page(
    "You're unsubscribed.",
    'No hard feelings — the art will be here if you ever want back in. Rejoining takes one click on the site.'
  )
}
