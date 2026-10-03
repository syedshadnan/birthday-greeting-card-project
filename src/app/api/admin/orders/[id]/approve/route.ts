import { NextRequest, NextResponse } from 'next/server'
import { hasAdminSession, isSameOriginRequest } from '../../../../../../lib/admin-auth'
import { getCurrentUser } from '../../../../../../lib/auth'
import { supabaseRequest } from '../../../../../../lib/supabase/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasAdminSession(request)) return NextResponse.json({ error: 'Admin access is required.' }, { status: 401 })
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Payment approval request was rejected.' }, { status: 403 })

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'A valid order is required.' }, { status: 400 })
  const body = await request.json().catch(() => null) as { reason?: unknown } | null
  if (!body || typeof body.reason !== 'string' || body.reason.trim().length < 10 || body.reason.length > 2000) {
    return NextResponse.json({ error: 'A manual approval reason of at least 10 characters is required.' }, { status: 400 })
  }

  try {
    const admin = await getCurrentUser()
    const response = await supabaseRequest('/rest/v1/rpc/approve_manual_payment_order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_order_id: id, p_admin_user_id: admin?.id ?? null, p_reason: body.reason.trim() }),
    })
    return NextResponse.json({ approvedOrderId: await response.json() })
  } catch (error) {
    console.error('Could not manually approve payment order.', error)
    const message = error instanceof Error && error.message.includes('already paid')
      ? 'Order is already paid.'
      : 'The pending order could not be manually approved.'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
