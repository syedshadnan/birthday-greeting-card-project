import { NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import { createSupabaseServerClient } from '../../../../lib/supabase/server'

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 })

  const cardId = new URL(request.url).searchParams.get('cardId')
  if (!cardId || !/^[a-z0-9]{12,32}$/.test(cardId)) {
    return NextResponse.json({ error: 'Card not found.' }, { status: 404 })
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) return NextResponse.json({ error: 'Payment service is not configured.' }, { status: 503 })

  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('id')
    .eq('public_id', cardId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (cardError) {
    console.error('Could not verify card ownership for payment access.', cardError)
    return NextResponse.json({ error: 'The card could not be verified.' }, { status: 500 })
  }
  if (!card) return NextResponse.json({ error: 'You are not authorized to access this card payment.' }, { status: 403 })

  const { data: paidOrder, error: paidOrderError } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', user.id)
    .eq('card_id', card.id)
    .eq('status', 'paid')
    .limit(1)

  if (paidOrderError) {
    console.error('Could not verify payment status for card sharing.', paidOrderError)
    return NextResponse.json({ error: 'Payment status could not be verified.' }, { status: 500 })
  }

  if (paidOrder?.[0]) {
    return NextResponse.json({ paid: true, pending: false, submitted: false }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const { data: pendingOrder, error: pendingOrderError } = await supabase
    .from('orders')
    .select('id, payment_submitted_at')
    .eq('user_id', user.id)
    .eq('card_id', card.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)

  if (pendingOrderError) {
    console.error('Could not verify pending payment status for card sharing.', pendingOrderError)
    return NextResponse.json({ error: 'Payment status could not be verified.' }, { status: 500 })
  }

  const order = pendingOrder?.[0]
  return NextResponse.json({
    paid: false,
    pending: Boolean(order),
    submitted: Boolean(order?.payment_submitted_at),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
