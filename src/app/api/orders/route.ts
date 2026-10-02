import { NextResponse } from 'next/server'
import { isSameOriginRequest } from '../../../lib/admin-auth'
import { getCurrentUser } from '../../../lib/auth'
import { createSupabaseServerClient, supabaseRequest } from '../../../lib/supabase/server'
import { getActivePaymentAccount, isPaymentMethod, normalizeBangladeshPhone } from '../../../lib/payment-accounts'

function isValidCardId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]{12,32}$/.test(value)
}

function hasOnlyAllowedFields(value: Record<string, unknown>) {
  return Object.keys(value).every(key => ['cardId', 'paymentMethod', 'customerPhone'].includes(key))
}

function publicPaymentAccount(account: { id: string; method: string; account_number: string } | null) {
  return account
    ? { id: account.id, method: account.method, accountNumber: account.account_number }
    : null
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Sign in is required before viewing an order.' }, { status: 401 })

  const cardId = new URL(request.url).searchParams.get('cardId')
  if (!cardId || !isValidCardId(cardId)) return NextResponse.json({ error: 'Card not found.' }, { status: 404 })

  const supabase = await createSupabaseServerClient()
  if (!supabase) return NextResponse.json({ error: 'Order service is not configured.' }, { status: 503 })

  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('id')
    .eq('public_id', cardId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (cardError) {
    console.error('Could not verify card ownership for order lookup.', cardError)
    return NextResponse.json({ error: 'The card could not be verified.' }, { status: 500 })
  }
  if (!card) return NextResponse.json({ error: 'You are not authorized to view this card payment.' }, { status: 403 })

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, card_id, amount_bdt, currency, status, payment_method, customer_phone, payment_account_id, payment_submitted_at, created_at, updated_at, expires_at')
    .eq('user_id', user.id)
    .eq('card_id', card.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (orderError) {
    console.error('Could not look up a pending order.', orderError)
    return NextResponse.json({ error: 'The order could not be loaded.' }, { status: 500 })
  }
  if (!order) return NextResponse.json({ order: null, account: null })

  const accountResponse = order.payment_account_id
    ? await supabaseRequest(`/rest/v1/payment_accounts?id=eq.${order.payment_account_id}&select=id,method,account_number&limit=1`)
    : null
  const [account] = accountResponse ? await accountResponse.json() as { id: string; method: string; account_number: string }[] : []
  return NextResponse.json({ order, account: publicPaymentAccount(account ?? null) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Order request was rejected.' }, { status: 403 })
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in is required before creating an order.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Order details are invalid.' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Order details are invalid.' }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  if (!hasOnlyAllowedFields(input) || !isValidCardId(input.cardId) || !isPaymentMethod(input.paymentMethod)) {
    return NextResponse.json({ error: 'Choose a valid card and payment method.' }, { status: 400 })
  }

  const customerPhone = normalizeBangladeshPhone(input.customerPhone)
  if (!customerPhone) {
    return NextResponse.json({ error: 'Enter a valid Bangladesh mobile number.' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Order service is not configured.' }, { status: 503 })
  }

  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('id, public_id')
    .eq('public_id', input.cardId)
    .eq('user_id', user.id)
    .in('status', ['draft', 'published'])
    .maybeSingle()

  if (cardError) {
    console.error('Could not verify card ownership for order creation.', cardError)
    return NextResponse.json({ error: 'The card could not be verified.' }, { status: 500 })
  }
  if (!card) {
    return NextResponse.json({ error: 'You are not authorized to create an order for this card.' }, { status: 403 })
  }

  const { data: existingOrder, error: existingError } = await supabase
    .from('orders')
    .select('id, card_id, amount_bdt, currency, status, payment_method, customer_phone, payment_account_id, payment_submitted_at, created_at, updated_at, expires_at')
    .eq('user_id', user.id)
    .eq('card_id', card.id)
    .eq('payment_method', input.paymentMethod)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingError) {
    console.error('Could not check for an existing pending order.', existingError)
    return NextResponse.json({ error: 'The order could not be created.' }, { status: 500 })
  }
  if (existingOrder) {
    const accountResponse = existingOrder.payment_account_id
      ? await supabaseRequest(`/rest/v1/payment_accounts?id=eq.${existingOrder.payment_account_id}&select=id,method,account_number&limit=1`)
      : null
    const [account] = accountResponse ? await accountResponse.json() as { id: string; method: string; account_number: string }[] : []
    return NextResponse.json({ order: existingOrder, account: publicPaymentAccount(account ?? null), existing: true })
  }

  const activeAccount = await getActivePaymentAccount(input.paymentMethod)
  if (!activeAccount) {
    return NextResponse.json({ error: `${input.paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} payment is currently unavailable.` }, { status: 503 })
  }

  const orderResponse = await supabaseRequest('/rest/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: user.id,
      card_id: card.id,
      amount_bdt: 99,
      currency: 'BDT',
      status: 'pending',
      payment_method: input.paymentMethod,
      customer_phone: customerPhone,
      payment_account_id: activeAccount.id,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }),
  })
  const [order] = await orderResponse.json() as { id: string }[]

  if (!order) {
    if (orderResponse.status === 409) {
      const { data: concurrentOrder } = await supabase
        .from('orders')
        .select('id, card_id, amount_bdt, currency, status, payment_method, customer_phone, payment_account_id, payment_submitted_at, created_at, updated_at, expires_at')
        .eq('user_id', user.id)
        .eq('card_id', card.id)
        .eq('payment_method', input.paymentMethod)
        .eq('status', 'pending')
        .maybeSingle()
      if (concurrentOrder) {
        const accountResponse = concurrentOrder.payment_account_id
          ? await supabaseRequest(`/rest/v1/payment_accounts?id=eq.${concurrentOrder.payment_account_id}&select=id,method,account_number&limit=1`)
          : null
        const [account] = accountResponse ? await accountResponse.json() as { id: string; method: string; account_number: string }[] : []
        return NextResponse.json({ order: concurrentOrder, account: publicPaymentAccount(account ?? null), existing: true })
      }
    }
    console.error('Could not create pending order.', orderResponse.status)
    return NextResponse.json({ error: 'The order could not be created.' }, { status: 500 })
  }

  return NextResponse.json({
    order,
    account: {
      id: activeAccount.id,
      method: activeAccount.method,
      accountNumber: activeAccount.account_number,
    },
    existing: false,
  }, { status: 201 })
}
