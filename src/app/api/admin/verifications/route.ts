import { NextRequest, NextResponse } from 'next/server'
import { hasAdminSession } from '../../../../lib/admin-auth'
import { getCurrentUser } from '../../../../lib/auth'
import { supabaseRequest } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'Admin access is required.' }, { status: 401 })
  try {
    const [verificationResponse, eventResponse, orderResponse, accountResponse] = await Promise.all([
      supabaseRequest('/rest/v1/payment_verifications?select=*&order=created_at.desc'),
      supabaseRequest('/rest/v1/webhook_events?select=id,external_event_id,raw_message,received_at,processed_at,verification_status,verification_reason_code,verification_reason,trusted_source,trusted_receiving_account'),
      supabaseRequest('/rest/v1/orders?select=id,payment_method,customer_phone,amount_bdt,status,payment_account_id'),
      supabaseRequest('/rest/v1/payment_accounts?select=id,account_number,method'),
    ])
    const [verifications, events, orders, accounts] = await Promise.all([
      verificationResponse.json() as Promise<Record<string, unknown>[]>,
      eventResponse.json() as Promise<Record<string, unknown>[]>,
      orderResponse.json() as Promise<{ id: string; payment_method: string; customer_phone: string; amount_bdt: number; status: string; payment_account_id: string | null }[]>,
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
    }, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch (error) {
    console.error('Could not load payment verification evidence.', error)
    return NextResponse.json({ error: 'Verification evidence could not be loaded.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'Admin access is required.' }, { status: 401 })
  const body = await request.json().catch(() => null) as { verificationId?: unknown; reason?: unknown } | null
  if (!body || typeof body.verificationId !== 'string' || typeof body.reason !== 'string' || body.reason.trim().length < 10 || body.reason.length > 1000) {
    return NextResponse.json({ error: 'Evidence-based approval details are required.' }, { status: 400 })
  }
  const admin = await getCurrentUser()
  try {
    const response = await supabaseRequest('/rest/v1/rpc/approve_payment_verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_verification_id: body.verificationId, p_admin_user_id: admin?.id ?? null, p_reason: body.reason.trim() }),
    })
    return NextResponse.json({ approvedOrderId: await response.json() })
  } catch (error) {
    console.error('Could not approve payment verification evidence.', error)
    return NextResponse.json({ error: 'Evidence did not satisfy the payment approval requirements.' }, { status: 409 })
  }
}
