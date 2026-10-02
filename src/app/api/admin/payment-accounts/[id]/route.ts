import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { hasAdminSession } from '../../../../../lib/admin-auth'
import { getCurrentUserRole } from '../../../../../lib/auth'
import { isSameOriginRequest } from '../../../../../lib/admin-auth'
import { supabaseRequest } from '../../../../../lib/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Payment account request was rejected.' }, { status: 403 })
  if (!hasAdminSession(request as NextRequest) && (await getCurrentUserRole()) !== 'admin') return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 })
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'Payment account not found.' }, { status: 404 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || Object.keys(body).some(key => key !== 'isActive') || typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'Only the active state can be changed.' }, { status: 400 })
  }

  if (body.isActive) {
    const response = await supabaseRequest('/rest/v1/rpc/activate_payment_account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ p_account_id: id }),
    })
    const account = await response.json()
    return NextResponse.json({ account })
  }

  const response = await supabaseRequest(`/rest/v1/payment_accounts?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ is_active: body.isActive, updated_at: new Date().toISOString() }),
  })
  const accounts = await response.json()
  if (!accounts.length) return NextResponse.json({ error: 'Payment account not found.' }, { status: 404 })
  return NextResponse.json({ account: accounts[0] })
}
