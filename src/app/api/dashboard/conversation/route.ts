import { artistContext } from '@/lib/artist-session'

export async function GET(req: Request) {
  const ctx = await artistContext()
  if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status })
  const { artist, db } = ctx

  const { searchParams } = new URL(req.url)
  const matchId = searchParams.get('matchId')
  if (!matchId) return Response.json({ error: 'matchId required' }, { status: 400 })

  // The artist_id filter is the ownership check.
  const { data: match } = await db
    .from('matches')
    .select('conversation_id')
    .eq('id', matchId)
    .eq('artist_id', artist.id)
    .single()

  if (!match?.conversation_id) return Response.json({ messages: [] })

  const { data: conversation } = await db
    .from('conversations')
    .select('messages')
    .eq('id', match.conversation_id)
    .single()

  return Response.json({ messages: conversation?.messages ?? [] })
}
