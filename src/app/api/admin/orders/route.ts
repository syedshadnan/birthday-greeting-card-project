import { NextRequest, NextResponse } from 'next/server'
import { hasAdminSession, isSameOriginRequest } from '../../../../lib/admin-auth'
import { supabaseRequest } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) {
    return NextResponse.json({ error: 'Sign in as an admin to view pending orders.' }, { status: 401 })
  }

  try {
    const [ordersResponse, cardsResponse, accountsResponse, profilesResponse, verificationsResponse, auditsResponse, eventsResponse] = await Promise.all([
      supabaseRequest('/rest/v1/orders?select=id,user_id,card_id,amount_bdt,currency,status,payment_method,customer_phone,payment_account_id,payment_submitted_at,created_at&status=eq.pending&order=created_at.desc'),
      supabaseRequest('/rest/v1/cards?select=id,public_id,recipient_name'),
      supabaseRequest('/rest/v1/payment_accounts?select=id,account_number,method'),
      supabaseRequest('/rest/v1/profiles?select=id,email,full_name'),
      supabaseRequest('/rest/v1/payment_verifications?select=id,order_id,verification_status,reason_code,reason,provider,amount_bdt,sender_phone,transaction_id,provider_timestamp,trusted_source,trusted_receiving_account,webhook_event_id,created_at&order=created_at.desc'),
      supabaseRequest('/rest/v1/payment_verification_audit?select=order_id'),
      supabaseRequest('/rest/v1/webhook_events?select=id,matched_order_id,raw_message,received_at,processed_at&order=received_at.desc'),
    ])

    const [orders, cards, accounts, profiles, verifications, audits, events] = await Promise.all([
      ordersResponse.json() as Promise<{ id: string; user_id: string; card_id: string; amount_bdt: number; currency: string; status: string; payment_method: string; customer_phone: string; payment_account_id: string | null; payment_submitted_at: string | null; created_at: string }[]>,
      cardsResponse.json() as Promise<{ id: string; public_id: string; recipient_name: string | null }[]>,
      accountsResponse.json() as Promise<{ id: string; account_number: string; method: string }[]>,
      profilesResponse.json() as Promise<{ id: string; email: string | null; full_name: string | null }[]>,
      verificationsResponse.json() as Promise<{ id: string; order_id: string | null; verification_status: string; reason_code: string; reason: string; provider: string | null; amount_bdt: number | null; sender_phone: string | null; transaction_id: string | null; provider_timestamp: string | null; trusted_source: string | null; trusted_receiving_account: string | null; webhook_event_id: string; created_at: string }[]>,
      auditsResponse.json() as Promise<{ order_id: string }[]>,
      eventsResponse.json() as Promise<{ id: string; matched_order_id: string | null; raw_message: string | null; received_at: string; processed_at: string | null }[]>,
    ])

    const cardsById = new Map(cards.map(card => [card.id, card]))
    const accountsById = new Map(accounts.map(account => [account.id, account]))
    const profilesById = new Map(profiles.map(profile => [profile.id, profile]))
    const evidenceOrderIds = new Set([
      ...verifications.flatMap(item => item.order_id ? [item.order_id] : []),
      ...audits.map(item => item.order_id),
      ...events.flatMap(item => item.matched_order_id ? [item.matched_order_id] : []),
    ])
    const eventById = new Map(events.map(event => [event.id, event]))
    const verificationByOrderId = new Map<string, typeof verifications[number]>()
    verifications.forEach(item => {
      if (item.order_id && !verificationByOrderId.has(item.order_id)) verificationByOrderId.set(item.order_id, item)
    })
    const eventByOrderId = new Map<string, typeof events[number]>()
    events.forEach(item => {
      if (item.matched_order_id && !eventByOrderId.has(item.matched_order_id)) eventByOrderId.set(item.matched_order_id, item)
    })
    return NextResponse.json({
      orders: orders.map(order => ({
        ...order,
        card: cardsById.get(order.card_id) ?? null,
        payment_account: order.payment_account_id ? accountsById.get(order.payment_account_id) ?? null : null,
        customer: profilesById.get(order.user_id) ?? { id: order.user_id, email: null, full_name: null },
        verification: (() => {
          const item = verificationByOrderId.get(order.id)
          const event = item ? eventById.get(item.webhook_event_id) : eventByOrderId.get(order.id)
          return item ? { ...item, event: event ?? null } : {
            verification_status: null,
            reason_code: 'NO_PAYMENT_EVIDENCE',
            reason: 'No payment evidence has been received yet.',
            provider: null,
            amount_bdt: null,
            sender_phone: null,
            transaction_id: null,
            provider_timestamp: null,
            trusted_source: null,
            trusted_receiving_account: null,
            event: event ?? null,
          }
        })(),
        cleanup: evidenceOrderIds.has(order.id)
          ? { eligible: false, reason: 'Payment verification or webhook evidence is attached to this order.' }
          : { eligible: true, reason: 'Pending order has no payment verification or webhook evidence.' },
      })),
    }, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch (error) {
    console.error('Could not load pending orders for the admin dashboard.', error)
    return NextResponse.json({ error: 'Pending orders could not be loaded. Please try again.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'Admin access is required.' }, { status: 401 })
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Order cleanup request was rejected.' }, { status: 403 })
  const body = await request.json().catch(() => null) as { orderIds?: unknown } | null
  if (!body || !Array.isArray(body.orderIds) || body.orderIds.length < 1 || body.orderIds.length > 50 || body.orderIds.some(id => typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id))) {
    return NextResponse.json({ error: 'Select one or more valid pending test orders.' }, { status: 400 })
  }
  const orderIds = body.orderIds as string[]
  try {
    const [ordersResponse, verificationsResponse, auditsResponse, eventsResponse] = await Promise.all([
      supabaseRequest(`/rest/v1/orders?id=in.(${orderIds.join(',')})&select=id,status`),
      supabaseRequest(`/rest/v1/payment_verifications?order_id=in.(${orderIds.join(',')})&select=order_id`),
      supabaseRequest(`/rest/v1/payment_verification_audit?order_id=in.(${orderIds.join(',')})&select=order_id`),
      supabaseRequest(`/rest/v1/webhook_events?matched_order_id=in.(${orderIds.join(',')})&select=matched_order_id`),
    ])
    const orders = await ordersResponse.json() as { id: string; status: string }[]
    const foundOrderIds = new Set(orders.map(order => order.id))
    const blocked = new Set<string>(orderIds.filter(id => !foundOrderIds.has(id)))
    const blockedReasons: Record<string, string> = {}
    orderIds.filter(id => !foundOrderIds.has(id)).forEach(id => { blockedReasons[id] = 'Order was not found.' })
    orders.filter(order => order.status !== 'pending').forEach(order => {
      blocked.add(order.id)
      blockedReasons[order.id] = `Order is ${order.status}, not pending.`
    })
    ;(await verificationsResponse.json() as { order_id: string }[]).forEach(item => {
      blocked.add(item.order_id)
      blockedReasons[item.order_id] = 'Payment verification evidence is attached.'
    })
    ;(await auditsResponse.json() as { order_id: string }[]).forEach(item => {
      blocked.add(item.order_id)
      blockedReasons[item.order_id] = 'Payment audit evidence is attached.'
    })
    ;(await eventsResponse.json() as { matched_order_id: string }[]).forEach(item => {
      blocked.add(item.matched_order_id)
      blockedReasons[item.matched_order_id] = 'Webhook evidence is attached.'
    })
    if (blocked.size) return NextResponse.json({ error: 'Some selected orders are paid or have payment evidence and cannot be deleted.', blockedOrderIds: [...blocked], blockedReasons }, { status: 409 })
    const response = await supabaseRequest(`/rest/v1/orders?id=in.(${orderIds.join(',')})&status=eq.pending`, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    })
    return NextResponse.json({ deletedOrderIds: (await response.json() as { id: string }[]).map(order => order.id) })
  } catch (error) {
    console.error('Could not clean up selected test orders.', error)
    return NextResponse.json({ error: 'Selected orders could not be deleted.' }, { status: 500 })
  }
}
