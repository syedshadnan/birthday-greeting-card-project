import { NextRequest, NextResponse } from 'next/server'
import { hasAdminSession, isSameOriginRequest } from '../../../../lib/admin-auth'
import { getCurrentUser } from '../../../../lib/auth'
import { supabaseRequest } from '../../../../lib/supabase/server'
import { approvePaymentWithEvidence, isUuid } from '../../../../lib/payment-approval'

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'Admin access is required.' }, { status: 401 })
  try {
    const [verificationResponse, eventResponse, orderResponse, accountResponse] = await Promise.all([
      supabaseRequest('/rest/v1/payment_verifications?select=*&order=created_at.desc'),
      supabaseRequest('/rest/v1/webhook_events?select=id,external_event_id,raw_message,received_at,processed_at,verification_status,verification_reason_code,verification_reason,trusted_source,trusted_receiving_account'),
      supabaseRequest('/rest/v1/orders?select=id,payment_method,customer_phone,amount_bdt,status,payment_account_id,payment_verification_source,paid_at'),
      supabaseRequest('/rest/v1/payment_accounts?select=id,account_number,method'),
    ])
    const [verifications, events, orders, accounts] = await Promise.all([
      verificationResponse.json() as Promise<Record<string, unknown>[]>,
      eventResponse.json() as Promise<Record<string, unknown>[]>,
      orderResponse.json() as Promise<{ id: string; payment_method: string; customer_phone: string; amount_bdt: number; status: string; payment_account_id: string | null; payment_verification_source: string | null; paid_at: string | null }[]>,
      accountResponse.json() as Promise<{ id: string; account_number: string; method: string }[]>,
    ])
    const eventsById = new Map(events.map(event => [String(event.id), event]))
    const ordersById = new Map(orders.map(order => [order.id, order]))
    const accountsById = new Map(accounts.map(account => [account.id, account]))
    return NextResponse.json({
      verifications: verifications.map(verification => {
        const event = eventsById.get(String(verification.webhook_event_id))
        const order = verification.order_id ? ordersById.get(String(verification.order_id)) : null
        return {
          ...verification,
          event,
          order,
          receiving_account: order?.payment_account_id ? accountsById.get(order.payment_account_id) ?? null : null,
        }
      }),
      paidOrders: orders.filter(order => order.status === 'paid').map(order => ({
        id: order.id,
        payment_method: order.payment_method,
        amount_bdt: order.amount_bdt,
        payment_verification_source: order.payment_verification_source,
        paid_at: order.paid_at,
      })),
    }, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch (error) {
    console.error('Could not load payment verification evidence.', error)
    return NextResponse.json({ error: 'Verification evidence could not be loaded.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'Admin access is required.' }, { status: 401 })
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Verification approval request was rejected.' }, { status: 403 })
  const body = await request.json().catch(() => null) as { verificationId?: unknown; orderId?: unknown; reason?: unknown } | null
  if (!body || !isUuid(body.verificationId) || (body.orderId !== undefined && !isUuid(body.orderId)) || typeof body.reason !== 'string' || body.reason.trim().length < 10 || body.reason.length > 1000) {
    return NextResponse.json({ error: 'Evidence-based approval details are required.' }, { status: 400 })
  }
  try {
    let orderId = body.orderId as string | undefined
    if (!orderId) {
      const verificationResponse = await supabaseRequest(`/rest/v1/payment_verifications?id=eq.${body.verificationId}&select=order_id&limit=1`)
      const [verification] = await verificationResponse.json() as { order_id: string | null }[]
      orderId = verification?.order_id ?? undefined
    }
    if (!orderId) {
      return NextResponse.json({ error: 'Choose the pending order this evidence pays for.' }, { status: 409 })
    }
    const admin = await getCurrentUser()
    const result = await approvePaymentWithEvidence(orderId, body.verificationId, admin?.id ?? null, body.reason.trim())
    if (result.error) return NextResponse.json({ error: result.error }, { status: 409 })
    return NextResponse.json({ approvedOrderId: result.approvedOrderId })
  } catch (error) {
    console.error('Could not approve payment verification evidence.', error)
    return NextResponse.json({ error: 'The pending order could not be approved.' }, { status: 500 })
  }
}
