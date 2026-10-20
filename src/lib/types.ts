export type ArtistStyle =
  | 'traditional' | 'neo-traditional' | 'realism' | 'blackwork'
  | 'geometric' | 'watercolor' | 'japanese' | 'tribal'
  | 'illustrative' | 'fine-line' | 'portrait' | 'cover-up'

export type MatchStatus = 'pending' | 'info_requested' | 'accepted' | 'rejected' | 'paid' | 'booked' | 'completed' | 'cancelled'

export type ProjectStage =
  | 'pending'       // sent to artist, awaiting response
  | 'accepted'      // artist said yes
  | 'deposit_paid'  // client paid deposit
  | 'sketching'     // artist is drawing
  | 'approval'      // client reviewing sketch
  | 'booked'        // appointment confirmed
  | 'completed'     // tattoo done
  | 'rejected'      // artist declined

export const PROJECT_STAGES: { key: ProjectStage; label: string }[] = [
  { key: 'pending',      label: 'Sent' },
  { key: 'accepted',     label: 'Accepted' },
  { key: 'deposit_paid', label: 'Deposit' },
  { key: 'sketching',    label: 'Sketching' },
  { key: 'approval',     label: 'Approval' },
  { key: 'booked',       label: 'Booked' },
  { key: 'completed',    label: 'Done' },
]

export interface Artist {
  id: string
  user_id: string
  name: string
  bio: string
  location_city: string
  location_state: string
  location_lat: number
  location_lng: number
  styles: ArtistStyle[]
  hourly_rate_cents: number
  min_piece_cents: number
  portfolio_images: string[]
  avatar_url: string
  instagram_handle?: string
  years_experience: number
  rating: number
  review_count: number
  available: boolean
  verified: boolean
  created_at: string
}

export interface Client {
  id: string
  user_id: string
  name: string
  email: string
  avatar_url?: string
  budget_cents?: number
  preferred_styles?: ArtistStyle[]
  location_city?: string
  location_state?: string
  ai_context_summary?: string
  created_at: string
}

export interface Match {
  id: string
  client_id: string
  artist_id: string
  status: MatchStatus
  stage?: ProjectStage
  client_brief: string
  ai_summary: string
  offered_price_cents: number
  final_price_cents?: number
  reference_images?: string[]
  placement?: string
  size_inches?: number
  artist_response?: string
  artist_responded_at?: string
  created_at: string
  artist?: Artist
  client?: Client
}

export interface Conversation {
  id: string
  client_id: string
  messages: Message[]
  brief_extracted?: ClientBrief
  created_at: string
  updated_at: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  // How the client put it in. Spoken turns are transcribed in the browser
  // and sent as text; the mark stays on the saved conversation.
  input?: 'text' | 'voice'
}

// What a reference image is there for, in the client's own choice of words.
// The six keepers are the whole vocabulary the concierge offers.
export interface ReferenceKeeper {
  for: Array<'subject' | 'style' | 'density' | 'size' | 'color' | 'flow'>
  note: string
}

// The brief the concierge emits (src/lib/artists/lacey-rawson.ts). Read it
// through src/lib/brief.ts, never by trusting a field directly.
export interface ConciergeBrief {
  concept: string
  styles: string[]
  placement: string
  size: string
  has_reference: boolean
  creative_freedom: boolean
  budget_min_cents: number
  budget_max_cents: number
  deposit_ready: boolean
  feasibility_flags: string[]
  reference_keepers: ReferenceKeeper[]
  scale_check: string
  scale_confirmed: boolean
  open_questions: string[]
  client_name: string
  client_email: string
  client_phone: string
  readiness_score: number
}

export interface ClientBrief {
  idea: string
  styles: ArtistStyle[]
  placement: string
  size: string
  budget_min_cents: number
  budget_max_cents: number
  timeline: string
  reference_notes: string
  location_preference: string
  readiness_score: number
}
