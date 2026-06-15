import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const matchId = searchParams.get('matchId')
  if (!matchId) return Response.json({ error: 'matchId required' }, { status: 400 })

  // Verify the match belongs to this artist
  const { data: artist } = await supabase.from('artists').select('id').eq('user_id', user.id).single()
  if (!artist) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { data: match } = await supabase
    .from('matches')
    .select('conversation_id')
    .eq('id', matchId)
    .eq('artist_id', artist.id)
    .single()

  if (!match?.conversation_id) return Response.json({ messages: [] })

  const { data: conversation } = await supabase
    .from('conversations')
    .select('messages')
    .eq('id', match.conversation_id)
    .single()

  return Response.json({ messages: conversation?.messages ?? [] })
}
