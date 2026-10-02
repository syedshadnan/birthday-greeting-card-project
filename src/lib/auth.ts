import { createSupabaseServerClient, hasSupabaseAuthConfig } from './supabase/server'

export async function getCurrentUser() {
  if (!hasSupabaseAuthConfig()) return null

  const supabase = await createSupabaseServerClient()
  if (!supabase) return null

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) return null
  return user
}

export async function getCurrentProfile() {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createSupabaseServerClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) return null
  return data
}

export async function getCurrentUserRole() {
  const profile = await getCurrentProfile()
  return profile?.role === 'admin' ? 'admin' : 'user'
}

export type OwnedCard = {
  id: string
  public_id: string
  recipient_name: string | null
  created_at: string
  expires_at: string | null
  status: string
  share_enabled_at: string | null
  payment_status: 'none' | 'pending' | 'submitted' | 'paid'
}

export async function getCurrentOwnedCards(): Promise<{ cards: OwnedCard[]; error: string | null }> {
  const user = await getCurrentUser()
  if (!user) return { cards: [], error: null }

  const supabase = await createSupabaseServerClient()
  if (!supabase) return { cards: [], error: 'Account data is unavailable because authentication is not configured.' }

  const { data, error } = await supabase
    .from('cards')
    .select('id, public_id, recipient_name, created_at, expires_at, status, share_enabled_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Could not load owned birthday cards.', error)
    return { cards: [], error: 'Your cards could not be loaded. Please try again.' }
  }

  const cards = data ?? []
  if (!cards.length) return { cards: [], error: null }

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('card_id, status, payment_submitted_at, created_at')
    .in('card_id', cards.map(card => card.id))
    .in('status', ['pending', 'paid'])
    .order('created_at', { ascending: false })

  if (ordersError) {
    console.error('Could not load payment status for owned birthday cards.', ordersError)
    return { cards: [], error: 'Your card payment status could not be loaded. Please try again.' }
  }

  const statusByCard = new Map<string, OwnedCard['payment_status']>()
  for (const order of orders ?? []) {
    const current = statusByCard.get(order.card_id)
    const next = order.status === 'paid' ? 'paid' : order.payment_submitted_at ? 'submitted' : 'pending'
    if (!current || current !== 'paid') statusByCard.set(order.card_id, next)
  }

  return {
    cards: cards.map(card => ({ ...card, payment_status: statusByCard.get(card.public_id) ?? 'none' })),
    error: null,
  }
}

export async function requireAuthenticatedUser() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('AUTH_REQUIRED')
  }
  return user
}

export async function requireAdminUser() {
  const user = await requireAuthenticatedUser()
  const role = await getCurrentUserRole()

  if (role !== 'admin') {
    throw new Error('ADMIN_REQUIRED')
  }

  return user
}
