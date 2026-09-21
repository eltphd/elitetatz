import type Stripe from 'stripe'
import { stripe, artistShareCents, matchConcept } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { appUrl } from '@/lib/tokens'
import { ARTIST_CONFIG } from '@/lib/artists/lacey-rawson'

// Stripe Connect for the signed-in artist. Two Express accounts can exist per
// artist — her own and her shop's — and `payout_preference` picks which one
// receives the 80% share of each deposit.
//
//   GET                      → payout state for the payouts page
//   POST { target, intent }  → 'onboard' (default): create the Express account
//                              if missing, set the preference, return an
//                              onboarding (or Express dashboard) URL
//                              'prefer': only switch payout_preference

type Target = 'artist' | 'shop'

type ArtistRow = {
  id: string
  name: string | null
  payout_preference: Target | null
  shop_name: string | null
  stripe_account_id: string | null
  shop_stripe_account_id: string | null
  stripe_onboarding_complete: boolean | null
}

const ARTIST_COLUMNS =
  'id, name, payout_preference, shop_name, stripe_account_id, shop_stripe_account_id, stripe_onboarding_complete'

async function currentArtist(): Promise<
  | { artist: ArtistRow; email: string | null; db: Awaited<ReturnType<typeof createClient>> }
  | { error: Response }
> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: artist } = await db.from('artists').select(ARTIST_COLUMNS).eq('user_id', user.id).single()
  if (!artist) return { error: Response.json({ error: 'Not an artist account' }, { status: 403 }) }

  return { artist: artist as ArtistRow, email: user.email ?? null, db }
}

function columnFor(target: Target): 'stripe_account_id' | 'shop_stripe_account_id' {
  return target === 'shop' ? 'shop_stripe_account_id' : 'stripe_account_id'
}

// RLS-blocked updates come back with no error and no rows; treat that as a
// failure rather than pretending the preference was saved.
async function updateArtist(
  db: Awaited<ReturnType<typeof createClient>>,
  artistId: string,
  patch: Record<string, unknown>
): Promise<string | null> {
  const { data, error } = await db.from('artists').update(patch).eq('id', artistId).select('id')
  if (error) return error.message
  if (!data || data.length === 0) return 'Artist row could not be updated'
  return null
}

type AccountState = {
  exists: boolean
  complete: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  requirementsDue: string[]
  disabledReason: string | null
}

const EMPTY_STATE: AccountState = {
  exists: false, complete: false, chargesEnabled: false, payoutsEnabled: false,
  detailsSubmitted: false, requirementsDue: [], disabledReason: null,
}

async function accountState(id: string | null): Promise<AccountState> {
  if (!id) return EMPTY_STATE
  try {
    const acct = await stripe.accounts.retrieve(id)
    return {
      exists: true,
      complete: Boolean(acct.charges_enabled && acct.payouts_enabled),
      chargesEnabled: Boolean(acct.charges_enabled),
      payoutsEnabled: Boolean(acct.payouts_enabled),
      detailsSubmitted: Boolean(acct.details_submitted),
      requirementsDue: acct.requirements?.currently_due ?? [],
      disabledReason: acct.requirements?.disabled_reason ?? null,
    }
  } catch (err) {
    console.error('connect: could not retrieve account', id, err)
    return { ...EMPTY_STATE, exists: true }
  }
}

export async function GET() {
  const auth = await currentArtist()
  if ('error' in auth) return auth.error
  const { artist, db } = auth

  const [artistAcct, shopAcct, { data: matches }] = await Promise.all([
    accountState(artist.stripe_account_id),
    accountState(artist.shop_stripe_account_id),
    db
      .from('matches')
      .select('id, status, client_name, client_brief, ai_summary, payout_target, stripe_transfer_id, stripe_payment_intent_id, updated_at, created_at')
      .eq('artist_id', artist.id)
      .in('status', ['paid', 'booked', 'completed'])
      .not('stripe_payment_intent_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(100),
  ])

  const share = artistShareCents(ARTIST_CONFIG.depositCents)
  const rows = (matches ?? []).map((m) => ({
    id: m.id as string,
    status: m.status as string,
    client: (m.client_name as string | null) || 'Client',
    concept: matchConcept(m as { client_brief?: string | null; ai_summary?: string | null }),
    target: ((m.payout_target as Target | null) ?? 'artist') as Target,
    shareCents: share,
    sent: Boolean(m.stripe_transfer_id),
    at: (m.updated_at as string | null) ?? (m.created_at as string),
  }))
  const held = rows.filter((r) => !r.sent)
  const sent = rows.filter((r) => r.sent)

  return Response.json({
    preference: (artist.payout_preference ?? 'artist') as Target,
    shopName: artist.shop_name,
    onboardingComplete: Boolean(artist.stripe_onboarding_complete),
    depositCents: ARTIST_CONFIG.depositCents,
    shareCents: share,
    artist: artistAcct,
    shop: shopAcct,
    heldCents: held.length * share,
    heldCount: held.length,
    sentCents: sent.length * share,
    sentCount: sent.length,
    recent: rows.slice(0, 20),
  })
}

export async function POST(req: Request) {
  const auth = await currentArtist()
  if ('error' in auth) return auth.error
  const { artist, email, db } = auth

  let body: { target?: unknown; shop_name?: unknown; intent?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const target = body.target === 'shop' ? 'shop' : body.target === 'artist' ? 'artist' : null
  if (!target) return Response.json({ error: "target must be 'artist' or 'shop'" }, { status: 400 })
  const intent = body.intent === 'prefer' ? 'prefer' : 'onboard'
  const shopName = typeof body.shop_name === 'string' ? body.shop_name.trim().slice(0, 120) : ''

  const column = columnFor(target)
  let accountId = artist[column]

  if (intent === 'prefer') {
    if (!accountId) {
      return Response.json({ error: `Connect the ${target} account before choosing it for payouts.` }, { status: 409 })
    }
    const patch: Record<string, unknown> = { payout_preference: target }
    if (target === 'shop' && shopName) patch.shop_name = shopName
    // The completeness flag follows the chosen account.
    const state = await accountState(accountId)
    patch.stripe_onboarding_complete = state.complete
    const failure = await updateArtist(db, artist.id, patch)
    if (failure) return Response.json({ error: failure }, { status: 500 })
    return Response.json({ ok: true, preference: target })
  }

  if (target === 'shop' && !accountId && !shopName && !artist.shop_name) {
    return Response.json({ error: 'Give the shop a name first.' }, { status: 400 })
  }

  if (!accountId) {
    const params: Stripe.AccountCreateParams = {
      type: 'express',
      country: 'US',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: target === 'shop' ? 'company' : 'individual',
      metadata: { artist_id: artist.id, target },
    }
    if (target === 'artist') {
      if (email) params.email = email
      params.business_profile = {
        mcc: '7299', // miscellaneous personal services
        product_description: 'Custom tattoo work; TatzAI collects booking deposits on the artist\'s behalf.',
        name: artist.name ?? undefined,
      }
    } else {
      params.business_profile = {
        mcc: '7299',
        product_description: 'Tattoo studio; TatzAI collects booking deposits on the studio\'s behalf.',
        name: shopName || artist.shop_name || undefined,
      }
      params.company = { name: shopName || artist.shop_name || undefined }
    }

    let created: Stripe.Account
    try {
      created = await stripe.accounts.create(params)
    } catch (err) {
      console.error('connect: accounts.create failed', err)
      const message = err instanceof Error ? err.message : 'Stripe rejected the account'
      return Response.json({ error: message }, { status: 502 })
    }
    accountId = created.id

    const patch: Record<string, unknown> = { [column]: accountId, payout_preference: target }
    if (target === 'shop' && shopName) patch.shop_name = shopName
    const failure = await updateArtist(db, artist.id, patch)
    if (failure) {
      console.error('connect: failed to store account id', accountId, failure)
      return Response.json({ error: `Stripe account ${accountId} was created but could not be saved; contact support.` }, { status: 500 })
    }
  } else {
    const patch: Record<string, unknown> = { payout_preference: target }
    if (target === 'shop' && shopName) patch.shop_name = shopName
    const failure = await updateArtist(db, artist.id, patch)
    if (failure) return Response.json({ error: failure }, { status: 500 })
  }

  // Already fully onboarded: hand back the Express dashboard instead of
  // re-running onboarding they have nothing left to fill in.
  const state = await accountState(accountId)
  if (state.complete && state.detailsSubmitted && state.requirementsDue.length === 0) {
    await updateArtist(db, artist.id, { stripe_onboarding_complete: true })
    try {
      const login = await stripe.accounts.createLoginLink(accountId)
      return Response.json({ url: login.url, kind: 'dashboard' })
    } catch (err) {
      console.warn('connect: login link failed, falling back to onboarding link', err)
    }
  }

  const base = `${appUrl()}/dashboard/payouts`
  try {
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${base}?refresh=${target}`,
      return_url: `${base}?connected=${target}`,
    })
    return Response.json({ url: link.url, kind: 'onboarding' })
  } catch (err) {
    console.error('connect: accountLinks.create failed', err)
    const message = err instanceof Error ? err.message : 'Could not start Stripe onboarding'
    return Response.json({ error: message }, { status: 502 })
  }
}
