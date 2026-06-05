export type ArtistStyle =
  | 'traditional' | 'neo-traditional' | 'realism' | 'blackwork'
  | 'geometric' | 'watercolor' | 'japanese' | 'tribal'
  | 'illustrative' | 'fine-line' | 'portrait' | 'cover-up'

export type MatchStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'paid'

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
  readiness_score: number // 0-100
}
