import { NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../../lib/auth'
import { supabaseRequest } from '../../../../../lib/supabase/server'
import { isSameOriginRequest } from '../../../../../lib/admin-auth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Payment submission request was rejected.' }, { status: 403 })
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 })
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })

  const response = await supabaseRequest(`/rest/v1/orders?id=eq.${id}&user_id=eq.${user.id}&status=eq.pending`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ payment_submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  })
  const [order] = await response.json()
  if (!order) return NextResponse.json({ error: 'Pending order not found.' }, { status: 404 })
  return NextResponse.json({ order })
}
